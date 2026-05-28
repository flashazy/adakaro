"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { logAdminActionFromServerAction } from "@/lib/admin-activity-log";
import {
  buildPromotionGradeDebugReport,
  logPromotionGradeDebugReport,
  type PromotionGradeDebugReport,
} from "@/lib/promotions/promotion-grade-debug";
import type { Database } from "@/types/supabase";
import { resolveNextClassId } from "@/lib/promotions/resolve-next-class";
import { resolvePromotionRuleForClass } from "@/lib/promotions/resolve-promotion-rule";
import {
  getCachedTerm2PromotionStats,
  invalidatePromotionStatsCache,
} from "@/lib/promotions/promotion-stats-cache";
import {
  suggestPromotionDecision,
} from "@/lib/promotions/suggest-promotion-decision";
import type {
  ApplyPromotionEntry,
  ApplyPromotionResult,
  LoadClassPromotionStudentsResult,
} from "@/lib/promotions/types";

export type PromotionsActionState = {
  error?: string;
  success?: string;
};

async function requireSchoolAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: schoolIdRpc } = await supabase.rpc("get_my_school_id");
  let schoolId =
    schoolIdRpc != null && String(schoolIdRpc).length > 0
      ? (schoolIdRpc as string)
      : null;
  if (!schoolId) {
    schoolId = await getSchoolIdForUser(supabase, user.id);
  }
  if (!schoolId) throw new Error("No school found.");

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) throw new Error("Only school administrators can manage promotions.");

  return { supabase, schoolId, userId: user.id };
}

/** Prefer service role for gradebook/scores reads (avoids RLS gaps). */
function promotionDataClient(
  sessionClient: SupabaseClient<Database>
): SupabaseClient<Database> {
  try {
    return createAdminClient();
  } catch {
    return sessionClient;
  }
}

export async function debugPromotionGradesAction(
  classId: string,
  academicYear: number,
  studentNameContains?: string
): Promise<{ report: PromotionGradeDebugReport } | { error: string }> {
  try {
    const { supabase, schoolId } = await requireSchoolAdmin();
    const dataClient = promotionDataClient(supabase);

    const report = await buildPromotionGradeDebugReport(dataClient, {
      schoolId,
      classId,
      academicYear,
      studentNameContains: studentNameContains ?? "Feisal",
      maxStudents: 5,
    });

    logPromotionGradeDebugReport(report);

    return { report };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Debug failed." };
  }
}

export async function createProgressionTrackAction(
  trackName: string
): Promise<PromotionsActionState> {
  const name = trackName.trim();
  if (!name) return { error: "Track name is required." };

  try {
    const { supabase, schoolId } = await requireSchoolAdmin();
    const { error } = await supabase.from("class_progression_tracks").insert({
      school_id: schoolId,
      track_name: name,
    } as never);

    if (error) {
      if (error.code === "23505") {
        return { error: `A track named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/promotions");
    return { success: `Track "${name}" created.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function createDefaultProgressionTracksAction(): Promise<PromotionsActionState> {
  const defaults = ["Primary", "Secondary", "A-Level"];
  try {
    const { supabase, schoolId } = await requireSchoolAdmin();
    for (const track_name of defaults) {
      const { error } = await supabase.from("class_progression_tracks").insert({
        school_id: schoolId,
        track_name,
      } as never);
      if (error && error.code !== "23505") {
        return { error: error.message };
      }
    }
    revalidatePath("/dashboard/promotions");
    return { success: "Default tracks added (Primary, Secondary, A-Level)." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function updateClassProgressionAction(
  classId: string,
  trackId: string | null,
  progressionOrder: number | null
): Promise<PromotionsActionState> {
  try {
    const { supabase, schoolId } = await requireSchoolAdmin();

    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id, school_id")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (clsErr || !cls) return { error: "Class not found." };

    if (trackId) {
      const { data: track } = await supabase
        .from("class_progression_tracks")
        .select("id")
        .eq("id", trackId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!track) return { error: "Track not found." };
    }

    const order =
      progressionOrder != null && Number.isFinite(progressionOrder)
        ? Math.max(0, Math.floor(progressionOrder))
        : null;

    const { error } = await supabase
      .from("classes")
      .update({
        track_id: trackId,
        progression_order: order,
      } as never)
      .eq("id", classId)
      .eq("school_id", schoolId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/promotions");
    revalidatePath("/dashboard/classes");
    return { success: "Class progression updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function applyClassPromotionsAction(
  fromClassId: string,
  academicYear: number,
  entries: ApplyPromotionEntry[]
): Promise<ApplyPromotionResult | { error: string }> {
  if (!entries.length) {
    return { error: "No students selected." };
  }

  try {
    const { supabase, schoolId, userId } = await requireSchoolAdmin();

    const { data: fromClass, error: fromErr } = await supabase
      .from("classes")
      .select(
        "id, name, school_id, track_id, progression_order, use_promotion_rules"
      )
      .eq("id", fromClassId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (fromErr || !fromClass) {
      return { error: "Class not found." };
    }

    const { data: allClasses, error: classesErr } = await supabase
      .from("classes")
      .select("id, name, track_id, progression_order")
      .eq("school_id", schoolId);

    if (classesErr) return { error: classesErr.message };

    const classRows = (allClasses ?? []) as {
      id: string;
      name: string;
      track_id: string | null;
      progression_order: number | null;
    }[];

    const { nextClassId } = resolveNextClassId(fromClassId, classRows);

    const promotionRule = await resolvePromotionRuleForClass(
      supabase,
      schoolId,
      fromClassId,
      {
        use_promotion_rules: Boolean(
          (fromClass as { use_promotion_rules?: boolean }).use_promotion_rules
        ),
      }
    );

    const studentIds = entries.map((e) => e.studentId);
    const { data: students, error: stErr } = await supabase
      .from("students")
      .select("id, class_id, status, approval_status")
      .eq("school_id", schoolId)
      .in("id", studentIds);

    if (stErr) return { error: stErr.message };

    const dataClient = promotionDataClient(supabase);
    const { statsByStudentId } = await computeTerm2ReportCardAveragesForStudents(
      dataClient,
      {
        classId: fromClassId,
        academicYear,
        studentIds,
      }
    );

    const studentMap = new Map(
      (students ?? []).map((s) => {
        const row = s as {
          id: string;
          class_id: string;
          status: string;
          approval_status: string;
        };
        return [row.id, row] as const;
      })
    );

    let promoted = 0;
    let repeated = 0;
    let graduated = 0;

    for (const entry of entries) {
      const student = studentMap.get(entry.studentId);
      if (!student) {
        return { error: "One or more students were not found." };
      }
      if (student.class_id !== fromClassId) {
        return { error: "A student is no longer in this class. Refresh and try again." };
      }

      const stats = statsByStudentId.get(entry.studentId);
      const canPromote = stats?.canPromote ?? false;
      let effectiveDecision: typeof entry.decision = entry.decision;
      // Even if the admin selects "promote", do not apply class changes
      // until the Term 2 report card is approved.
      if (entry.decision === "promote" && !canPromote) {
        effectiveDecision = "repeat";
      }

      let toClassId: string | null = fromClassId;
      let newStatus: string | null = null;

      if (effectiveDecision === "promote") {
        if (!nextClassId) {
          return {
            error: `No next class is configured after "${(fromClass as { name: string }).name}". Set progression order on the Classes sequence section.`,
          };
        }
        toClassId = nextClassId;
        promoted += 1;
      } else if (effectiveDecision === "repeat") {
        toClassId = fromClassId;
        repeated += 1;
      } else if (effectiveDecision === "graduate") {
        toClassId = fromClassId;
        newStatus = "graduated";
        graduated += 1;
      } else {
        return { error: "Invalid promotion decision." };
      }

      const updatePayload: Record<string, unknown> = {};
      if (effectiveDecision === "promote") {
        updatePayload.class_id = toClassId;
      }
      if (newStatus === "graduated") {
        updatePayload.status = "graduated";
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: upErr } = await supabase
          .from("students")
          .update(updatePayload as never)
          .eq("id", entry.studentId)
          .eq("school_id", schoolId);

        if (upErr) return { error: upErr.message };
      }

      let adminOverride = false;

      if (
        promotionRule &&
        effectiveDecision !== "graduate"
      ) {
        const avg = stats?.term2AveragePercent ?? null;
        const suggested =
          avg != null ? suggestPromotionDecision(avg, promotionRule) : "repeat";
        if (effectiveDecision === "promote" || effectiveDecision === "repeat") {
          if (effectiveDecision !== suggested) adminOverride = true;
        }
      }

      const { error: logErr } = await supabase.from("student_promotions").insert({
        school_id: schoolId,
        student_id: entry.studentId,
        from_class_id: fromClassId,
        to_class_id: effectiveDecision === "graduate" ? null : toClassId,
        decision: effectiveDecision,
        academic_year: academicYear,
        promoted_by: userId,
        admin_override: adminOverride,
      } as never);

      if (logErr) return { error: logErr.message };
    }

    invalidatePromotionStatsCache(fromClassId, academicYear);
    revalidatePath("/dashboard/promotions");
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");

    void logAdminActionFromServerAction(
      userId,
      "apply_class_promotions",
      {
        from_class_id: fromClassId,
        academic_year: academicYear,
        promoted,
        repeated,
        graduated,
        student_count: entries.length,
      },
      schoolId
    );

    const message = `${promoted} student${promoted === 1 ? "" : "s"} promoted, ${repeated} repeated, ${graduated} graduated.`;

    return {
      ok: true,
      promoted,
      repeated,
      graduated,
      message,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function loadClassStudentsForPromotionAction(
  classId: string,
  academicYear: number
): Promise<LoadClassPromotionStudentsResult | { error: string }> {
  try {
    const { supabase, schoolId } = await requireSchoolAdmin();

    const dataClient = promotionDataClient(supabase);

    const { data: classRow } = await supabase
      .from("classes")
      .select("id, name, use_promotion_rules")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!classRow) return { error: "Class not found." };

    const cluster = await resolveClassCluster(dataClient, classId);
    const studentClassIds =
      cluster.isParent && cluster.childClassIds.length > 0
        ? cluster.classIds
        : [classId];

    const { data: allClasses } = await supabase
      .from("classes")
      .select("id, name, track_id, progression_order")
      .eq("school_id", schoolId);

    const classRows = (allClasses ?? []) as {
      id: string;
      name: string;
      track_id: string | null;
      progression_order: number | null;
    }[];

    const { nextClassId } = resolveNextClassId(classId, classRows);
    const nextName = nextClassId
      ? classRows.find((c) => c.id === nextClassId)?.name ?? null
      : null;

    const { data: rows, error } = await supabase
      .from("students")
      .select("id, full_name, admission_number, class_id")
      .eq("school_id", schoolId)
      .in("class_id", studentClassIds)
      .eq("status", "active")
      .eq("approval_status", "approved")
      .order("full_name");

    if (error) return { error: error.message };

    const students = (rows ?? []) as {
      id: string;
      full_name: string;
      admission_number: string | null;
      class_id: string;
    }[];

    const promotionRule = await resolvePromotionRuleForClass(
      supabase,
      schoolId,
      classId,
      {
        use_promotion_rules: Boolean(
          (classRow as { use_promotion_rules: boolean }).use_promotion_rules
        ),
      }
    );

    const studentIds = students.map((s) => s.id);

    const rulesMode = promotionRule != null ? "auto" : "manual";

    const yearStr = String(academicYear);
    const term = "Term 2";

    const { data: reportCards } = await (dataClient as any)
      .from("report_cards")
      .select("id, student_id, status, average_score, is_complete")
      .eq("school_id", schoolId)
      .eq("academic_year", yearStr)
      .eq("term", term)
      .in("class_id", studentClassIds)
      .in("student_id", studentIds);

    const rcList = (reportCards ?? []) as {
      id: string;
      student_id: string;
      status: "draft" | "pending_review" | "approved" | "changes_requested";
      average_score: number | string | null;
      is_complete: boolean | null;
    }[];

    if (studentIds.length > 0 && rcList.length === 0) {
      return {
        error: `No report cards found for ${term}, ${academicYear}. Generate report cards first before promoting this class.`,
      };
    }

    // Backfill missing summary values for older report cards that were created
    // before `report_cards.average_score` existed (or before it was populated).
    const missingAvgCardIds = rcList
      .filter((r) => r.average_score == null)
      .map((r) => r.id);

    if (missingAvgCardIds.length > 0) {
      const { data: commentRows } = await (dataClient as any)
        .from("teacher_report_card_comments")
        .select("report_card_id, subject, calculated_score, score_percent")
        .in("report_card_id", missingAvgCardIds);

      const rows = (commentRows ?? []) as {
        report_card_id: string;
        subject: string;
        calculated_score?: number | string | null;
        score_percent?: number | string | null;
      }[];

      const byCard = new Map<
        string,
        { subjects: Set<string>; total: number; completed: number }
      >();

      for (const r of rows) {
        const cardId = (r.report_card_id ?? "").trim();
        if (!cardId) continue;
        const subj = (r.subject ?? "").trim();
        const agg =
          byCard.get(cardId) ??
          { subjects: new Set<string>(), total: 0, completed: 0 };
        if (subj) agg.subjects.add(subj);
        const raw = r.calculated_score ?? r.score_percent ?? null;
        if (raw != null && String(raw).trim() !== "") {
          const n = Number(raw);
          if (Number.isFinite(n)) {
            agg.total += n;
            agg.completed += 1;
          }
        }
        byCard.set(cardId, agg);
      }

      const updates = [...byCard.entries()].map(([id, agg]) => {
        const subjectsCount = agg.subjects.size;
        const avg =
          subjectsCount > 0
            ? Math.round((agg.total / subjectsCount) * 10) / 10
            : null;
        const isComplete = subjectsCount > 0 && agg.completed >= subjectsCount;
        return {
          id,
          total_score: subjectsCount > 0 ? Math.round(agg.total * 10) / 10 : null,
          average_score: avg,
          subjects_count: subjectsCount || null,
          completed_subjects_count: agg.completed || null,
          is_complete: isComplete,
          summary_calculated_at: new Date().toISOString(),
        };
      });

      if (updates.length > 0) {
        await (dataClient as any).from("report_cards").upsert(updates);
      }

      // Refresh local list with backfilled values so the modal shows averages immediately.
      for (const rc of rcList) {
        const u = updates.find((x) => x.id === rc.id);
        if (u) {
          (rc as any).average_score = u.average_score;
          (rc as any).is_complete = u.is_complete;
        }
      }
    }

    const rcByStudent = new Map(rcList.map((r) => [r.student_id, r] as const));
    const hasIncomplete = rcList.some((r) => r.is_complete === false);

    return {
      students: students.map((s) => {
        const rc = rcByStudent.get(s.id) ?? null;
        const hasTerm2ReportCard = rc != null;
        const term2AveragePercent =
          rc?.average_score != null && Number.isFinite(Number(rc.average_score))
            ? Math.round(Number(rc.average_score) * 10) / 10
            : null;
        const term2ReportCardStatus =
          rc?.status === "approved"
            ? "approved"
            : rc != null
              ? "pending_approval"
              : "not_generated";
        const canPromote = rc?.status === "approved";

        const suggestedDecision =
          promotionRule && canPromote && term2AveragePercent != null
            ? suggestPromotionDecision(term2AveragePercent, promotionRule)
            : null;

        return {
          id: s.id,
          full_name: s.full_name,
          admission_number: s.admission_number,
          class_id: s.class_id,
          term2AveragePercent,
          hasTerm2ReportCard,
          term2ReportCardStatus,
          canPromote,
          suggestedDecision,
        };
      }),
      nextClassName: nextName,
      rulesMode,
      minAverageGrade: promotionRule?.minAverageGrade ?? null,
      ruleSource: promotionRule?.source ?? null,
      reportCardsIncompleteWarning: hasIncomplete,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

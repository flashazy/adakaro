"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { resolveClassCluster } from "@/lib/class-cluster";
import { logAdminActionFromServerAction } from "@/lib/admin-activity-log";
import {
  buildPromotionGradeDebugReport,
  logPromotionGradeDebugReport,
  type PromotionGradeDebugReport,
} from "@/lib/promotions/promotion-grade-debug";
import { resolveNextClassId } from "@/lib/promotions/resolve-next-class";
import { resolvePromotionRuleForClass } from "@/lib/promotions/resolve-promotion-rule";
import { computeTerm2ReportCardAveragesForStudents } from "@/lib/promotions/compute-term2-report-card-averages";
import { invalidatePromotionStatsCache } from "@/lib/promotions/promotion-stats-cache";
import {
  suggestPromotionDecision,
} from "@/lib/promotions/suggest-promotion-decision";
import { requirePromotionsAccess } from "@/lib/promotions/promotions-access.server";
import type {
  ApplyPromotionEntry,
  ApplyPromotionResult,
  LoadClassPromotionStudentsResult,
  PromotionStudentWithGrades,
} from "@/lib/promotions/types";

export type PromotionsActionState = {
  error?: string;
  success?: string;
};

export async function debugPromotionGradesAction(
  classId: string,
  academicYear: number,
  studentNameContains?: string
): Promise<{ report: PromotionGradeDebugReport } | { error: string }> {
  try {
    const { db, schoolId } = await requirePromotionsAccess();

    const report = await buildPromotionGradeDebugReport(db, {
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
    const { db, schoolId } = await requirePromotionsAccess();
    const { error } = await db.from("class_progression_tracks").insert({
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
    const { db, schoolId } = await requirePromotionsAccess();
    for (const track_name of defaults) {
      const { error } = await db.from("class_progression_tracks").insert({
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
    const { db, schoolId } = await requirePromotionsAccess();

    const { data: cls, error: clsErr } = await db
      .from("classes")
      .select("id, school_id")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (clsErr || !cls) return { error: "Class not found." };

    if (trackId) {
      const { data: track } = await db
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

    const { error } = await db
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
    const { db, schoolId, userId } = await requirePromotionsAccess();

    const { data: fromClass, error: fromErr } = await db
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

    const { data: allClasses, error: classesErr } = await db
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
      db,
      schoolId,
      fromClassId,
      {
        use_promotion_rules: Boolean(
          (fromClass as { use_promotion_rules?: boolean }).use_promotion_rules
        ),
      }
    );

    const studentIds = entries.map((e) => e.studentId);
    const { data: students, error: stErr } = await db
      .from("students")
      .select("id, class_id, status, approval_status")
      .eq("school_id", schoolId)
      .in("id", studentIds);

    if (stErr) return { error: stErr.message };

    const { statsByStudentId } = await computeTerm2ReportCardAveragesForStudents(
      db,
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
      const effectiveDecision: typeof entry.decision = entry.decision;

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
        const { error: upErr } = await db
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

      const { error: logErr } = await db.from("student_promotions").insert({
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
  noStore();
  try {
    const { db, schoolId } = await requirePromotionsAccess();

    const { data: classRow } = await db
      .from("classes")
      .select("id, name, use_promotion_rules")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!classRow) return { error: "Class not found." };

    const cluster = await resolveClassCluster(db, classId);
    const studentClassIds =
      cluster.isParent && cluster.childClassIds.length > 0
        ? cluster.classIds
        : [classId];

    const { data: allClasses } = await db
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

    const { data: rows, error } = await db
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
      db,
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

    const { data: reportCards } = await (db as any)
      .from("report_cards")
      .select(
        "id, student_id, status, average_score, is_complete, subjects_count, completed_subjects_count"
      )
      .eq("school_id", schoolId)
      .eq("academic_year", yearStr)
      .eq("term", term)
      .in("student_id", studentIds);

    const rcList = (reportCards ?? []) as {
      id: string;
      student_id: string;
      status: "draft" | "pending_review" | "approved" | "changes_requested";
      average_score: number | string | null;
      is_complete: boolean | null;
      subjects_count?: number | string | null;
      completed_subjects_count?: number | string | null;
    }[];

    if (studentIds.length > 0 && rcList.length === 0) {
      return {
        error: `No report cards found for ${term}, ${academicYear}. Generate report cards first before promoting this class.`,
      };
    }

    const className =
      (classRow as { name?: string }).name ?? "(unknown class)";

    function explainMissingAverage(rc: (typeof rcList)[number] | null): string {
      if (!rc) return "no_report_card_row_for_student";
      if (rc.average_score == null) return "average_score_is_null";
      const n = Number(rc.average_score);
      if (!Number.isFinite(n)) {
        return `average_score_not_finite (raw=${JSON.stringify(rc.average_score)}, typeof=${typeof rc.average_score})`;
      }
      return "would_display";
    }

    console.log("[promotion-debug] Term 2 report cards query", {
      className,
      classId,
      academicYear,
      yearStr,
      term,
      schoolId,
      activeStudentCount: studentIds.length,
      reportCardsFound: rcList.length,
      reportCardsWithAverageScore: rcList.filter((r) => r.average_score != null)
        .length,
      reportCardsWithNullAverageScore: rcList.filter(
        (r) => r.average_score == null
      ).length,
      averageScoreValues: rcList.map((r) => ({
        student_id: r.student_id,
        average_score: r.average_score,
        typeof: typeof r.average_score,
        subjects_count: r.subjects_count ?? null,
        status: r.status,
      })),
    });

    const rcByStudent = new Map(rcList.map((r) => [r.student_id, r] as const));
    const hasIncomplete = rcList.some((r) => r.is_complete === false);

    const mappedStudents = students.map((s) => {
        const rc = rcByStudent.get(s.id) ?? null;
        const hasTerm2ReportCard = rc != null;

        const readReportCardNumber = (value: unknown): number | null => {
          if (value == null || String(value).trim() === "") return null;
          const n = Number(value);
          return Number.isFinite(n) ? n : null;
        };

        const subjectsCount = readReportCardNumber(rc?.subjects_count);
        const completedCount = readReportCardNumber(rc?.completed_subjects_count);
        const averageScore = readReportCardNumber(rc?.average_score);

        const noSubjectsAssigned = hasTerm2ReportCard && subjectsCount === 0;
        const noScoresEntered = hasTerm2ReportCard && averageScore == null;
        const term2AveragePercent = averageScore;
        const term2ReportCardStatus: PromotionStudentWithGrades["term2ReportCardStatus"] =
          rc?.status === "approved"
            ? "approved"
            : rc != null
              ? "pending_approval"
              : "not_generated";
        const suggestedDecision =
          term2AveragePercent == null
            ? null
            : suggestPromotionDecision(term2AveragePercent, promotionRule);

        return {
          id: s.id,
          full_name: s.full_name,
          admission_number: s.admission_number,
          class_id: s.class_id,
          term2AveragePercent,
          noSubjectsAssigned,
          noScoresEntered,
          hasTerm2ReportCard,
          term2ReportCardStatus,
          suggestedDecision,
        };
      });

    const displayBlockedReasons = mappedStudents.reduce(
      (acc, s) => {
        const rc = rcByStudent.get(s.id) ?? null;
        const reason =
          s.term2AveragePercent != null
            ? "displayed"
            : explainMissingAverage(rc);
        acc[reason] = (acc[reason] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log("[promotion-debug] why average_score is not displayed", {
      className,
      term,
      academicYear,
      studentsWithNoReportAvg: mappedStudents.filter(
        (s) => s.term2AveragePercent == null
      ).length,
      studentsWithDisplayedAvg: mappedStudents.filter(
        (s) => s.term2AveragePercent != null
      ).length,
      displayBlockedReasons,
      perStudentSample: mappedStudents.slice(0, 15).map((s) => {
        const rc = rcByStudent.get(s.id) ?? null;
        return {
          name: s.full_name,
          hasTerm2ReportCard: s.hasTerm2ReportCard,
          average_score: rc?.average_score ?? null,
          term2AveragePercent: s.term2AveragePercent,
          whyNotDisplayed:
            s.term2AveragePercent == null
              ? explainMissingAverage(rc)
              : null,
        };
      }),
    });

    return {
      students: mappedStudents,
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

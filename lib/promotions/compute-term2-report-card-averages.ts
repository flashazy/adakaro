import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  computeReportCardTermAverage,
} from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-grades";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export type Term2ReportCardStatusForPromotion =
  | "not_generated"
  | "pending_approval"
  | "approved";

export interface Term2StudentPromotionStats {
  studentId: string;
  hasTerm2ReportCard: boolean;
  term2ReportCardStatus: Term2ReportCardStatusForPromotion;
  canPromote: boolean;
  /**
   * Overall average (%) calculated from term 2 report card subject averages.
   * Null when the class has no configured subjects.
   */
  term2AveragePercent: number | null;
}

function parseFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeSubjectKey(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

function subjectTermAveragePercentFromComment(row: {
  exam1_score: number | null;
  exam2_score: number | null;
  calculated_score: number | null;
  score_percent: number | null;
}): number | null {
  const calc = parseFiniteNumber(row.calculated_score);
  if (calc != null) return calc;

  const e1 = parseFiniteNumber(row.exam1_score);
  const e2 = parseFiniteNumber(row.exam2_score);
  if (e1 != null && e2 != null) {
    const avg = computeReportCardTermAverage(e1, e2);
    return avg != null ? avg : null;
  }

  const sp = parseFiniteNumber(row.score_percent);
  if (sp != null) return sp;

  return null;
}

type RpcPromotionRow = {
  student_id: string;
  has_term2_report_card: boolean;
  term2_report_card_status: string;
  can_promote: boolean;
  term2_average_percent: number | null;
  subjects_count: number;
};

async function computeTerm2ViaDatabaseFunction(
  admin: SupabaseClient<Database>,
  args: {
    classId: string;
    academicYear: number;
    studentIds: string[];
  }
): Promise<{
  subjectsCount: number;
  statsByStudentId: Map<string, Term2StudentPromotionStats>;
} | null> {
  const { data, error } = await admin.rpc(
    "compute_class_term2_promotion_stats",
    {
      p_class_id: args.classId,
      p_academic_year: String(args.academicYear),
      p_student_ids: args.studentIds,
    } as never
  );

  if (error) {
    console.warn(
      "[promotions] compute_class_term2_promotion_stats RPC failed, using fallback:",
      error.message
    );
    return null;
  }

  if (!Array.isArray(data)) {
    console.warn(
      "[promotions] compute_class_term2_promotion_stats returned non-array, using fallback"
    );
    return null;
  }

  const rows = (data ?? []) as RpcPromotionRow[];
  if (rows.length === 0 && args.studentIds.length > 0) {
    return null;
  }

  const subjectsCount = rows[0]?.subjects_count ?? 0;
  const statsByStudentId = new Map<string, Term2StudentPromotionStats>();

  for (const sid of args.studentIds) {
    statsByStudentId.set(sid, {
      studentId: sid,
      hasTerm2ReportCard: false,
      term2ReportCardStatus: "not_generated",
      canPromote: false,
      term2AveragePercent: null,
    });
  }

  for (const row of rows) {
    if (!row || typeof (row as { student_id?: unknown }).student_id !== "string") {
      continue;
    }
    const statusRaw = row.term2_report_card_status;
    const term2ReportCardStatus: Term2ReportCardStatusForPromotion =
      statusRaw === "approved"
        ? "approved"
        : statusRaw === "pending_approval"
          ? "pending_approval"
          : "not_generated";

    statsByStudentId.set(row.student_id, {
      studentId: row.student_id,
      hasTerm2ReportCard: Boolean(row.has_term2_report_card),
      term2ReportCardStatus,
      canPromote: Boolean(row.can_promote),
      term2AveragePercent:
        row.term2_average_percent != null
          ? parseFiniteNumber(row.term2_average_percent)
          : null,
    });
  }

  return { subjectsCount, statsByStudentId };
}

async function computeTerm2ReportCardAveragesFallback(
  admin: SupabaseClient<Database>,
  args: {
    classId: string;
    academicYear: number;
    studentIds: string[];
  }
): Promise<{
  subjectsCount: number;
  statsByStudentId: Map<string, Term2StudentPromotionStats>;
}> {
  const statsByStudentId = new Map<string, Term2StudentPromotionStats>();
  const yearStr = String(args.academicYear);

  for (const sid of args.studentIds) {
    statsByStudentId.set(sid, {
      studentId: sid,
      hasTerm2ReportCard: false,
      term2ReportCardStatus: "not_generated",
      canPromote: false,
      term2AveragePercent: null,
    });
  }
  if (args.studentIds.length === 0) {
    return { subjectsCount: 0, statsByStudentId };
  }

  const { data: subjectRowsRaw } = await admin
    .from("subject_classes")
    .select("subjects (name)")
    .eq("class_id", args.classId);

  const subjectRows = (subjectRowsRaw ?? []) as {
    subjects: { name: string } | null;
  }[];

  const subjectNames = [
    ...new Set(
      subjectRows
        .map((r) => r.subjects?.name ?? "")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];

  const subjectsCount = subjectNames.length;

  if (subjectsCount === 0) {
    return { subjectsCount: 0, statsByStudentId };
  }

  const subjectByKey = new Map(
    subjectNames.map((n) => [normalizeSubjectKey(n), n] as const)
  );

  const { data: cards } = await admin
    .from("report_cards")
    .select("id, student_id, status")
    .eq("term", "Term 2")
    .eq("academic_year", yearStr)
    .in("student_id", args.studentIds);

  const cardsList = (cards ?? []) as {
    id: string;
    student_id: string;
    status: "draft" | "pending_review" | "approved" | "changes_requested";
  }[];

  const reportCardIds = cardsList.map((c) => c.id);
  const cardIdByStudentId = new Map(
    cardsList.map((c) => [c.student_id, c.id] as const)
  );

  const commentsByCardId = new Map<
    string,
    Map<string, number | null>
  >();

  if (reportCardIds.length > 0) {
    const commentsRows = await fetchAllRows<{
      report_card_id: string;
      subject: string;
      exam1_score: number | null;
      exam2_score: number | null;
      calculated_score: number | null;
      score_percent: number | null;
    }>({
      label: "promotions:term2 report card comments",
      fetchPage: async (from, to) =>
        await admin
          .from("teacher_report_card_comments")
          .select(
            "report_card_id, subject, exam1_score, exam2_score, calculated_score, score_percent"
          )
          .in("report_card_id", reportCardIds)
          .range(from, to),
    });

    for (const row of commentsRows ?? []) {
      const sid = row.report_card_id;
      const subjKey = normalizeSubjectKey(row.subject);
      if (!subjectByKey.has(subjKey)) continue;

      const avg = subjectTermAveragePercentFromComment({
        exam1_score: row.exam1_score,
        exam2_score: row.exam2_score,
        calculated_score: row.calculated_score,
        score_percent: row.score_percent,
      });

      const bySubj = commentsByCardId.get(sid) ?? new Map();
      if (!bySubj.has(subjKey)) bySubj.set(subjKey, avg);
      commentsByCardId.set(sid, bySubj);
    }
  }

  for (const card of cardsList) {
    const base = statsByStudentId.get(card.student_id);
    if (!base) continue;

    base.hasTerm2ReportCard = true;
    const approved = card.status === "approved";
    base.term2ReportCardStatus = approved
      ? "approved"
      : "pending_approval";
    base.canPromote = approved;

    const cardId = cardIdByStudentId.get(card.student_id);
    if (!cardId) continue;

    const bySubjectAvg = commentsByCardId.get(cardId);
    let sum = 0;
    for (const subjectKey of subjectByKey.keys()) {
      const v = bySubjectAvg?.get(subjectKey) ?? 0;
      sum += v ?? 0;
    }
    base.term2AveragePercent = Math.round((sum / subjectsCount) * 10) / 10;
  }

  return { subjectsCount, statsByStudentId };
}

/**
 * Computes the promotion "overall average (%)" for each student from their
 * Term 2 report card comments.
 *
 * Uses `compute_class_term2_promotion_stats` when available (single DB round-trip).
 */
export async function computeTerm2ReportCardAveragesForStudents(
  admin: SupabaseClient<Database>,
  args: {
    classId: string;
    academicYear: number;
    studentIds: string[];
  }
): Promise<{
  subjectsCount: number;
  statsByStudentId: Map<string, Term2StudentPromotionStats>;
}> {
  const viaRpc = await computeTerm2ViaDatabaseFunction(admin, args);
  if (viaRpc) return viaRpc;
  return computeTerm2ReportCardAveragesFallback(admin, args);
}

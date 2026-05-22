import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClassCluster } from "@/lib/class-cluster";
import { checkParentReportEligibility, loadReportCardFeeRuleForClass } from "./eligibility";
import type { ClassSendEligibilityPreview, SendEligibilityStudentRow } from "./types";

type PreviewDb = SupabaseClient;

export async function buildClassSendEligibilityPreview(
  admin: PreviewDb,
  params: {
    classId: string;
    term: string;
    academicYear: string;
  }
): Promise<ClassSendEligibilityPreview> {
  const cluster = await resolveClassCluster(admin, params.classId);
  const rule = await loadReportCardFeeRuleForClass(admin, params.classId);

  const { data: pendingCards } = await admin
    .from("report_cards")
    .select("id, student_id, students ( full_name )")
    .in("class_id", cluster.classIds)
    .eq("term", params.term)
    .eq("academic_year", params.academicYear)
    .eq("status", "pending_review");

  const cards = (pendingCards ?? []) as {
    id: string;
    student_id: string;
    students: { full_name: string | null } | { full_name: string | null }[] | null;
  }[];

  const students: SendEligibilityStudentRow[] = [];

  for (const card of cards) {
    const stu = card.students;
    const nameRow = Array.isArray(stu) ? stu[0] : stu;
    const studentName = nameRow?.full_name?.trim() || "Student";
    const elig = await checkParentReportEligibility(
      card.student_id,
      params.classId,
      admin
    );
    students.push({
      studentId: card.student_id,
      studentName,
      reportCardId: card.id,
      eligible: elig.eligible,
      reason: elig.reason,
      paidAmount: elig.paidAmount,
      requiredAmount: elig.requiredAmount,
      paidPercent: elig.paidPercent,
      requiredPercent: elig.requiredPercent,
      ruleType: elig.ruleType,
    });
  }

  students.sort((a, b) => a.studentName.localeCompare(b.studentName));

  const eligibleCount = students.filter((s) => s.eligible).length;
  const blockedCount = students.length - eligibleCount;

  return {
    ruleEnabled: Boolean(rule?.is_enabled),
    allowAdminOverride: rule?.allow_admin_override ?? true,
    eligibleCount,
    blockedCount,
    totalPending: students.length,
    students,
  };
}

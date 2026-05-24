import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClassCluster } from "@/lib/class-cluster";
import { batchCheckParentReportEligibility } from "./batch-eligibility";
import { resolveReportCardFeeRule } from "./rule-resolution";
import { loadReportCardFeeRulesForClass } from "./rule-resolution-server";
import { currentCalendarMonth } from "./schedule-types";
import type { ClassSendEligibilityPreview, SendEligibilityStudentRow } from "./types";

type PreviewDb = SupabaseClient;

export async function buildClassSendEligibilityPreview(
  admin: PreviewDb,
  params: {
    classId: string;
    term: string;
    academicYear: string;
    sendMonth?: number;
  }
): Promise<ClassSendEligibilityPreview> {
  const cluster = await resolveClassCluster(admin, params.classId);
  const sendMonth = params.sendMonth ?? currentCalendarMonth();

  const [loaded, { data: pendingCards }] = await Promise.all([
    loadReportCardFeeRulesForClass(admin, params.classId),
    admin
      .from("report_cards")
      .select(
        "id, student_id, students ( full_name, admission_number ), class_id"
      )
      .in("class_id", cluster.classIds)
      .eq("term", params.term)
      .eq("academic_year", params.academicYear)
      .eq("status", "pending_review"),
  ]);

  const resolved = loaded
    ? resolveReportCardFeeRule(
        loaded.directRules,
        loaded.allRulesIncludingParent,
        params.classId,
        {
          academicYear: params.academicYear,
          term: params.term,
          sendMonth,
        }
      )
    : null;

  const cards = (pendingCards ?? []) as {
    id: string;
    student_id: string;
    class_id: string;
    students:
      | {
          full_name: string | null;
          admission_number: string | null;
        }
      | {
          full_name: string | null;
          admission_number: string | null;
        }[]
      | null;
  }[];

  if (cards.length === 0) {
    return {
      ruleEnabled: Boolean(resolved),
      allowAdminOverride: resolved?.rule.allow_admin_override ?? true,
      appliedRuleLabel: resolved?.appliedRuleLabel ?? null,
      scheduleType: resolved?.scheduleType ?? null,
      eligibleCount: 0,
      blockedCount: 0,
      totalPending: 0,
      students: [],
    };
  }

  const eligibilityByStudent = await batchCheckParentReportEligibility(
    admin,
    cards.map((card) => ({
      studentId: card.student_id,
      classId: card.class_id || params.classId,
    })),
    {
      academicYear: params.academicYear,
      term: params.term,
      sendMonth,
    }
  );

  const students: SendEligibilityStudentRow[] = cards.map((card) => {
    const stu = card.students;
    const nameRow = Array.isArray(stu) ? stu[0] : stu;
    const studentName = nameRow?.full_name?.trim() || "Student";
    const admissionNumber = nameRow?.admission_number?.trim() || null;
    const elig =
      eligibilityByStudent.get(card.student_id) ?? {
        eligible: true,
        reason: "",
        paidAmount: 0,
        requiredAmount: null,
        paidPercent: 0,
        requiredPercent: null,
        ruleType: null,
        appliedRuleLabel: "",
        remainingAmount: null,
      };
    return {
      studentId: card.student_id,
      studentName,
      admissionNumber,
      reportCardId: card.id,
      eligible: elig.eligible,
      reason: elig.reason,
      paidAmount: elig.paidAmount,
      requiredAmount: elig.requiredAmount,
      paidPercent: elig.paidPercent,
      requiredPercent: elig.requiredPercent,
      ruleType: elig.ruleType,
      appliedRuleLabel: elig.appliedRuleLabel,
      remainingAmount: elig.remainingAmount,
    };
  });

  students.sort((a, b) => a.studentName.localeCompare(b.studentName));

  const eligibleCount = students.filter((s) => s.eligible).length;
  const blockedCount = students.length - eligibleCount;

  const firstBlocked = students.find((s) => !s.eligible);

  return {
    ruleEnabled: Boolean(resolved),
    allowAdminOverride: resolved?.rule.allow_admin_override ?? true,
    appliedRuleLabel:
      resolved?.appliedRuleLabel ?? firstBlocked?.appliedRuleLabel ?? null,
    scheduleType: resolved?.scheduleType ?? null,
    eligibleCount,
    blockedCount,
    totalPending: students.length,
    students,
  };
}

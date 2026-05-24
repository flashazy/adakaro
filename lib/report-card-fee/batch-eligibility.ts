import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getClassAssignedFeeTotal } from "./eligibility";
import { buildEligibleResult, evaluateRuleForStudent } from "./eligibility-eval";
import { loadReportCardFeeRulesForClass } from "./rule-resolution-server";
import {
  resolveReportCardFeeRule,
  type ReportCardEligibilityContext,
} from "./rule-resolution";
import { currentCalendarMonth } from "./schedule-types";
import type { ParentReportEligibilityResult } from "./types";

type FeeDb = SupabaseClient;

export interface BatchEligibilityItem {
  studentId: string;
  classId: string;
}

type LoadedRules = NonNullable<
  Awaited<ReturnType<typeof loadReportCardFeeRulesForClass>>
>;

const NOT_FOUND: ParentReportEligibilityResult = {
  eligible: false,
  reason: "Student not found.",
  paidAmount: 0,
  requiredAmount: null,
  paidPercent: 0,
  requiredPercent: null,
  ruleType: null,
  remainingAmount: null,
  parentMessage: null,
  scheduleType: null,
  appliedRuleLabel: "",
};

async function batchGetStudentFeeTotals(
  db: FeeDb,
  studentIds: string[]
): Promise<Map<string, { totalRequired: number; totalPaid: number }>> {
  const map = new Map<string, { totalRequired: number; totalPaid: number }>();
  for (const id of studentIds) {
    map.set(id, { totalRequired: 0, totalPaid: 0 });
  }
  if (studentIds.length === 0) return map;

  const chunkSize = 200;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const { data } = await db
      .from("student_fee_balances")
      .select("student_id, total_fee, total_paid")
      .in("student_id", chunk);

    for (const row of data ?? []) {
      const r = row as {
        student_id: string;
        total_fee: number;
        total_paid: number;
      };
      const cur = map.get(r.student_id) ?? {
        totalRequired: 0,
        totalPaid: 0,
      };
      cur.totalRequired += Number(r.total_fee) || 0;
      cur.totalPaid += Number(r.total_paid) || 0;
      map.set(r.student_id, cur);
    }
  }
  return map;
}

/**
 * Evaluate parent report eligibility for many students with batched DB reads.
 */
export async function batchCheckParentReportEligibility(
  db: FeeDb,
  items: BatchEligibilityItem[],
  context?: ReportCardEligibilityContext
): Promise<Map<string, ParentReportEligibilityResult>> {
  const out = new Map<string, ParentReportEligibilityResult>();
  if (items.length === 0) return out;

  const eligibilityContext: ReportCardEligibilityContext = {
    academicYear: context?.academicYear ?? null,
    term: context?.term ?? null,
    sendMonth: context?.sendMonth ?? currentCalendarMonth(),
  };

  const classIdByStudent = new Map(
    items.map((i) => [i.studentId, i.classId] as const)
  );
  const studentIds = [...classIdByStudent.keys()];

  const { data: studentRows } = await db
    .from("students")
    .select("id, class_id, school_id")
    .in("id", studentIds);

  const studentsById = new Map<
    string,
    { id: string; class_id: string | null; school_id: string }
  >();
  for (const row of studentRows ?? []) {
    const s = row as {
      id: string;
      class_id: string | null;
      school_id: string;
    };
    studentsById.set(s.id, s);
  }

  const [feeTotals] = await Promise.all([
    batchGetStudentFeeTotals(db, studentIds),
  ]);

  const effectiveClassByStudent = new Map<string, string>();
  const uniqueClassIds = new Set<string>();
  for (const studentId of studentIds) {
    const student = studentsById.get(studentId);
    const effective =
      classIdByStudent.get(studentId) ||
      student?.class_id ||
      "";
    effectiveClassByStudent.set(studentId, effective);
    if (effective) uniqueClassIds.add(effective);
  }

  const rulesByClassId = new Map<string, LoadedRules | null>();
  await Promise.all(
    [...uniqueClassIds].map(async (classId) => {
      const loaded = await loadReportCardFeeRulesForClass(db, classId);
      rulesByClassId.set(classId, loaded);
    })
  );

  const classRequiredCache = new Map<string, number>();
  const classRequiredKeys = new Set<string>();

  for (const studentId of studentIds) {
    const student = studentsById.get(studentId);
    if (!student) continue;
    const effectiveClassId = effectiveClassByStudent.get(studentId) ?? "";
    const loaded = rulesByClassId.get(effectiveClassId) ?? null;
    if (!loaded) continue;
    const resolved = resolveReportCardFeeRule(
      loaded.directRules,
      loaded.allRulesIncludingParent,
      effectiveClassId,
      eligibilityContext
    );
    if (!resolved) continue;
    classRequiredKeys.add(`${student.school_id}:${resolved.rule.class_id}`);
  }

  await Promise.all(
    [...classRequiredKeys].map(async (key) => {
      const [schoolId, ruleClassId] = key.split(":");
      const total = await getClassAssignedFeeTotal(db, schoolId, ruleClassId);
      classRequiredCache.set(key, total);
    })
  );

  for (const studentId of studentIds) {
    const student = studentsById.get(studentId);
    if (!student) {
      out.set(studentId, NOT_FOUND);
      continue;
    }

    const effectiveClassId = effectiveClassByStudent.get(studentId) ?? "";
    const { totalRequired, totalPaid } =
      feeTotals.get(studentId) ?? { totalRequired: 0, totalPaid: 0 };

    const loaded = rulesByClassId.get(effectiveClassId) ?? null;
    if (!loaded) {
      out.set(
        studentId,
        buildEligibleResult(totalPaid, totalRequired, null, "")
      );
      continue;
    }

    const resolved = resolveReportCardFeeRule(
      loaded.directRules,
      loaded.allRulesIncludingParent,
      effectiveClassId,
      eligibilityContext
    );

    if (!resolved) {
      out.set(
        studentId,
        buildEligibleResult(totalPaid, totalRequired, null, "")
      );
      continue;
    }

    const classKey = `${student.school_id}:${resolved.rule.class_id}`;
    const classRequired = classRequiredCache.get(classKey) ?? 0;

    out.set(
      studentId,
      evaluateRuleForStudent(
        resolved.rule,
        resolved.scheduleType,
        resolved.appliedRuleLabel,
        totalPaid,
        totalRequired,
        classRequired
      )
    );
  }

  return out;
}

export async function checkParentReportEligibilityBatched(
  studentId: string,
  classId: string,
  db: FeeDb,
  context?: ReportCardEligibilityContext
): Promise<ParentReportEligibilityResult> {
  const map = await batchCheckParentReportEligibility(
    db,
    [{ studentId, classId }],
    context
  );
  return map.get(studentId) ?? NOT_FOUND;
}

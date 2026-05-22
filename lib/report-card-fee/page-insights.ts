import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkParentReportEligibility } from "./eligibility";
import {
  calculateEligibilityInsight,
  DEFAULT_ALMOST_ELIGIBLE_BUFFER_PERCENT,
} from "./eligibility-insight";
import { classHasEnabledAccessRule } from "./fee-rules-ui";
import type { ReportCardEligibilityContext } from "./rule-resolution";
import { defaultAcademicYear } from "./schedule-types";
import type { ClassFeeRulesConfig } from "./types";

export interface FeeRulesPageInsights {
  classesProtected: number;
  almostReadyCount: number;
  notReadyCount: number;
  collectionOpportunity: number;
  insightsAvailable: boolean;
}

export interface FeeRulesPageInsightRow {
  classId: string;
  feeAssigned: number;
  config: ClassFeeRulesConfig;
}

function eligibilityContextForConfig(
  config: ClassFeeRulesConfig
): ReportCardEligibilityContext {
  const year = config.academicYear?.trim() || defaultAcademicYear();
  if (config.scheduleType === "term_based") {
    return { academicYear: year, term: "Term 1" };
  }
  if (config.scheduleType === "monthly_milestones") {
    return { academicYear: year, sendMonth: new Date().getMonth() + 1 };
  }
  return {};
}

/**
 * School-wide preview metrics for the fee rules command center (display only).
 */
export async function computeFeeRulesPageInsights(
  schoolId: string,
  rows: FeeRulesPageInsightRow[],
  db: SupabaseClient
): Promise<FeeRulesPageInsights> {
  const protectedRows = rows.filter((r) =>
    classHasEnabledAccessRule(r.config)
  );
  const classesProtected = protectedRows.length;

  if (protectedRows.length === 0) {
    return {
      classesProtected: 0,
      almostReadyCount: 0,
      notReadyCount: 0,
      collectionOpportunity: 0,
      insightsAvailable: true,
    };
  }

  const classIds = protectedRows.map((r) => r.classId);

  const { data: students, error } = await db
    .from("students")
    .select("id, full_name, admission_number, class_id")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .in("class_id", classIds);

  if (error) {
    return {
      classesProtected,
      almostReadyCount: 0,
      notReadyCount: 0,
      collectionOpportunity: 0,
      insightsAvailable: false,
    };
  }

  type ActiveStudent = {
    id: string;
    full_name: string | null;
    admission_number: string | null;
    class_id: string;
  };

  const byClass = new Map<string, ActiveStudent[]>();
  for (const raw of students ?? []) {
    const s = raw as ActiveStudent;
    const list = byClass.get(s.class_id) ?? [];
    list.push(s);
    byClass.set(s.class_id, list);
  }

  const perClassInsights = await Promise.all(
    protectedRows.map(async (row) => {
      const classStudents = byClass.get(row.classId) ?? [];
      const ctx = eligibilityContextForConfig(row.config);

      if (classStudents.length === 0) {
        return {
          almost: 0,
          blocked: 0,
          collection: 0,
        };
      }

      const eligibilityResults = await Promise.all(
        classStudents.map(async (st) => {
          const elig = await checkParentReportEligibility(
            st.id,
            row.classId,
            db,
            ctx
          );
          return { st, elig };
        })
      );

      const insightInputs = eligibilityResults.map(({ st, elig }) => ({
        studentName: st.full_name?.trim() || "Student",
        admissionNumber: st.admission_number?.trim() || null,
        paidAmount: elig.paidAmount,
        paidPercent: elig.paidPercent,
        requiredAmount: elig.requiredAmount,
        requiredPercent: elig.requiredPercent,
        ruleType: elig.ruleType,
        appliedRuleLabel: elig.appliedRuleLabel,
        engineEligible: elig.eligible,
      }));

      const insight = calculateEligibilityInsight(insightInputs, {
        bufferPercent: DEFAULT_ALMOST_ELIGIBLE_BUFFER_PERCENT,
        feeAssigned: row.feeAssigned,
        ruleEnabled: true,
      });

      return {
        almost: insight.almostEligibleCount,
        blocked: insight.blockedCount,
        collection: insight.estimatedRemainingCollection,
      };
    })
  );

  let almostReadyCount = 0;
  let notReadyCount = 0;
  let collectionOpportunity = 0;
  for (const slice of perClassInsights) {
    almostReadyCount += slice.almost;
    notReadyCount += slice.blocked;
    collectionOpportunity += slice.collection;
  }

  return {
    classesProtected,
    almostReadyCount,
    notReadyCount,
    collectionOpportunity,
    insightsAvailable: true,
  };
}

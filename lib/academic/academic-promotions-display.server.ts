import "server-only";

import { resolveClassCluster } from "@/lib/class-cluster";
import { resolvePromotionRuleForClass } from "@/lib/promotions/resolve-promotion-rule";
import type { PromotionClassRow } from "@/lib/promotions/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export interface ClassPromotionDisplayStats {
  readyCount: number;
  reviewCount: number;
}

export interface AcademicPromotionDisplayOverview {
  readyForPromotion: number;
  belowRequirement: number;
  awaitingResults: number;
  byClassId: Record<string, ClassPromotionDisplayStats>;
}

function readAverageScore(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Display-only promotion readiness aggregates (same thresholds as the modal).
 * Does not mutate data or apply promotions.
 */
export async function loadAcademicPromotionDisplayOverview(
  db: SupabaseClient<Database>,
  schoolId: string,
  topLevelClasses: PromotionClassRow[],
  academicYear: number
): Promise<AcademicPromotionDisplayOverview> {
  const byClassId: Record<string, ClassPromotionDisplayStats> = {};
  let readyForPromotion = 0;
  let belowRequirement = 0;
  let awaitingResults = 0;

  if (topLevelClasses.length === 0) {
    return {
      readyForPromotion,
      belowRequirement,
      awaitingResults,
      byClassId,
    };
  }

  const yearStr = String(academicYear);
  const term = "Term 2";

  const { data: classMetaRows } = await db
    .from("classes")
    .select("id, use_promotion_rules")
    .eq("school_id", schoolId);

  const useRulesByClassId = new Map(
    ((classMetaRows ?? []) as { id: string; use_promotion_rules: boolean }[]).map(
      (c) => [c.id, c.use_promotion_rules] as const
    )
  );

  for (const classRow of topLevelClasses) {
    const cluster = await resolveClassCluster(db, classRow.id);
    const studentClassIds =
      cluster.isParent && cluster.childClassIds.length > 0
        ? cluster.classIds
        : [classRow.id];

    const { data: studentRows } = await db
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .in("class_id", studentClassIds)
      .eq("status", "active")
      .eq("approval_status", "approved");

    const studentIds = ((studentRows ?? []) as { id: string }[]).map(
      (s) => s.id
    );

    let classReady = 0;
    let classReview = 0;

    if (studentIds.length === 0) {
      byClassId[classRow.id] = { readyCount: 0, reviewCount: 0 };
      continue;
    }

    const promotionRule = await resolvePromotionRuleForClass(
      db,
      schoolId,
      classRow.id,
      {
        use_promotion_rules: Boolean(
          useRulesByClassId.get(classRow.id) ?? false
        ),
      }
    );

    const { data: reportCards } = await db
      .from("report_cards")
      .select("student_id, average_score")
      .eq("school_id", schoolId)
      .eq("academic_year", yearStr)
      .eq("term", term)
      .in("student_id", studentIds);

    const averageByStudent = new Map(
      ((reportCards ?? []) as { student_id: string; average_score: unknown }[]).map(
        (r) => [r.student_id, readAverageScore(r.average_score)] as const
      )
    );

    for (const studentId of studentIds) {
      const average = averageByStudent.get(studentId) ?? null;

      if (promotionRule != null) {
        if (average == null) {
          awaitingResults += 1;
          classReview += 1;
        } else if (average >= promotionRule.minAverageGrade) {
          readyForPromotion += 1;
          classReady += 1;
        } else {
          belowRequirement += 1;
          classReview += 1;
        }
      } else if (average != null) {
        readyForPromotion += 1;
        classReady += 1;
      } else {
        awaitingResults += 1;
        classReview += 1;
      }
    }

    byClassId[classRow.id] = {
      readyCount: classReady,
      reviewCount: classReview,
    };
  }

  return {
    readyForPromotion,
    belowRequirement,
    awaitingResults,
    byClassId,
  };
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export interface ResolvedPromotionRule {
  /** Minimum average exam grade (%) required to promote; null = no threshold. */
  minAverageGrade: number | null;
  /** School default vs class-specific row. */
  source: "school_default" | "class_override";
}

function readMinAverageGrade(
  raw: number | string | null | undefined
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export interface ClassPromotionRuleInput {
  use_promotion_rules: boolean;
}

/**
 * Returns the applicable promotion rule for a class, or null if rules are not configured.
 */
export async function resolvePromotionRuleForClass(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  classId: string,
  classFlags: ClassPromotionRuleInput
): Promise<ResolvedPromotionRule | null> {
  const { data: rules, error } = await supabase
    .from("promotion_rules")
    .select("class_id, min_average_grade")
    .eq("school_id", schoolId);

  if (error) throw new Error(error.message);

  const rows = (rules ?? []) as {
    class_id: string | null;
    min_average_grade: number | string;
  }[];

  const schoolDefault = rows.find((r) => r.class_id == null);
  const classRule = rows.find((r) => r.class_id === classId);

  if (classFlags.use_promotion_rules) {
    if (!classRule) return null;
    return {
      minAverageGrade: readMinAverageGrade(classRule.min_average_grade),
      source: "class_override",
    };
  }

  if (!schoolDefault) return null;
  return {
    minAverageGrade: readMinAverageGrade(schoolDefault.min_average_grade),
    source: "school_default",
  };
}

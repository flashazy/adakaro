import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportCardFeeRuleRow } from "./types";

type FeeDb = SupabaseClient;

export async function loadReportCardFeeRulesForClass(
  db: FeeDb,
  classId: string
): Promise<{
  directRules: ReportCardFeeRuleRow[];
  allRulesIncludingParent: ReportCardFeeRuleRow[];
  schoolId: string;
} | null> {
  const { data: classRow } = await db
    .from("classes")
    .select("id, parent_class_id, school_id")
    .eq("id", classId)
    .maybeSingle();

  if (!classRow) return null;

  const typed = classRow as {
    id: string;
    parent_class_id: string | null;
    school_id: string;
  };

  const classIds = [typed.id];
  if (typed.parent_class_id) classIds.push(typed.parent_class_id);

  const { data: rules } = await db
    .from("report_card_fee_rules")
    .select("*")
    .in("class_id", classIds)
    .order("updated_at", { ascending: false });

  const list = (rules ?? []) as ReportCardFeeRuleRow[];
  const directRules = list.filter((r) => r.class_id === typed.id);
  return {
    directRules,
    allRulesIncludingParent: list,
    schoolId: typed.school_id,
  };
}

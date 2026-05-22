import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  MonthRuleInput,
  ReportCardFeeRuleType,
  TermRuleInput,
} from "./types";
import type { ReportCardFeeScheduleType } from "./schedule-types";

type RulesDb = SupabaseClient;

type RulesInsert = Database["public"]["Tables"]["report_card_fee_rules"]["Insert"];
type RulesUpdate = Database["public"]["Tables"]["report_card_fee_rules"]["Update"];

function devLog(label: string, payload: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[report_card_fee_rules] ${label}`, payload);
  }
}

function rulePayload(
  schoolId: string,
  classId: string,
  userId: string,
  scheduleType: ReportCardFeeScheduleType,
  ruleType: ReportCardFeeRuleType,
  requiredPercentage: number | null,
  requiredAmount: number | null,
  isEnabled: boolean,
  allowAdminOverride: boolean,
  messageToParent: string | null,
  academicYear: string | null,
  term: number | null,
  month: number | null
): RulesInsert {
  return {
    school_id: schoolId,
    class_id: classId,
    schedule_type: scheduleType,
    rule_type: ruleType,
    required_percentage: requiredPercentage,
    required_amount: requiredAmount,
    is_enabled: isEnabled,
    allow_admin_override: allowAdminOverride,
    message_to_parent: messageToParent,
    academic_year: academicYear,
    term,
    month,
    created_by: userId,
  };
}

async function findSimpleRuleId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  schoolId: string,
  classId: string,
  hintId: string | null
): Promise<string | null> {
  if (hintId) return hintId;

  const { data, error } = await db
    .from("report_card_fee_rules")
    .select("id, schedule_type")
    .eq("school_id", schoolId)
    .eq("class_id", classId);

  if (error) {
    devLog("findSimpleRuleId error", error);
    return null;
  }

  const rows = (data ?? []) as { id: string; schedule_type?: string | null }[];
  const simple = rows.find(
    (r) => r.schedule_type === "simple" || r.schedule_type == null
  );
  return simple?.id ?? (rows.length === 1 ? rows[0]?.id ?? null : null);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asRulesDb(rulesDb: RulesDb): any {
  return rulesDb;
}

export async function deleteRulesForOtherSchedules(
  rulesDb: RulesDb,
  schoolId: string,
  classId: string,
  keepSchedule: ReportCardFeeScheduleType
): Promise<string | null> {
  const typesToRemove = (
    ["simple", "term_based", "monthly_milestones"] as ReportCardFeeScheduleType[]
  ).filter((t) => t !== keepSchedule);

  const db = asRulesDb(rulesDb);
  const { error } = await db
    .from("report_card_fee_rules")
    .delete()
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .in("schedule_type", typesToRemove);

  if (error) {
    devLog("deleteRulesForOtherSchedules error", error);
  }
  return error?.message ?? null;
}

export async function upsertSimpleRule(
  rulesDb: RulesDb,
  params: {
    schoolId: string;
    classId: string;
    userId: string;
    existingId: string | null;
    ruleType: ReportCardFeeRuleType;
    requiredPercentage: number | null;
    requiredAmount: number | null;
    isEnabled: boolean;
    allowAdminOverride: boolean;
    messageToParent: string | null;
  }
): Promise<string | null> {
  const db = asRulesDb(rulesDb);
  const ruleId = await findSimpleRuleId(
    db,
    params.schoolId,
    params.classId,
    params.existingId
  );

  const payload = rulePayload(
    params.schoolId,
    params.classId,
    params.userId,
    "simple",
    params.ruleType,
    params.requiredPercentage,
    params.requiredAmount,
    params.isEnabled,
    params.allowAdminOverride,
    params.messageToParent,
    null,
    null,
    null
  );

  devLog("upsertSimpleRule", {
    ruleId,
    is_enabled: params.isEnabled,
    rule_type: params.ruleType,
    required_percentage: params.requiredPercentage,
    required_amount: params.requiredAmount,
  });

  if (ruleId) {
    const update: RulesUpdate = {
      rule_type: payload.rule_type,
      required_percentage: payload.required_percentage,
      required_amount: payload.required_amount,
      is_enabled: params.isEnabled,
      allow_admin_override: payload.allow_admin_override,
      message_to_parent: payload.message_to_parent,
      schedule_type: "simple",
      academic_year: null,
      term: null,
      month: null,
    };
    const { error } = await db
      .from("report_card_fee_rules")
      .update(update)
      .eq("id", ruleId);
    if (error) {
      devLog("upsertSimpleRule update error", error);
      return error.message;
    }
    return null;
  }

  const { error } = await db.from("report_card_fee_rules").insert(payload);
  if (error) {
    devLog("upsertSimpleRule insert error", error);
    return error.message;
  }
  return null;
}

function normalizeTermRow(row: TermRuleInput): TermRuleInput {
  const ruleType = row.ruleType;
  return {
    ...row,
    ruleType,
    requiredPercentage:
      ruleType === "percentage"
        ? row.requiredPercentage != null
          ? Number(row.requiredPercentage)
          : 0
        : null,
    requiredAmount:
      ruleType === "fixed_amount"
        ? row.requiredAmount != null
          ? Number(row.requiredAmount)
          : 0
        : null,
  };
}

export async function upsertTermRules(
  rulesDb: RulesDb,
  params: {
    schoolId: string;
    classId: string;
    userId: string;
    academicYear: string;
    allowAdminOverride: boolean;
    terms: TermRuleInput[];
  }
): Promise<string | null> {
  const db = asRulesDb(rulesDb);

  devLog("upsertTermRules", {
    academicYear: params.academicYear,
    terms: params.terms.map((t) => ({
      term: t.term,
      isEnabled: t.isEnabled,
      ruleType: t.ruleType,
      requiredPercentage: t.requiredPercentage,
      requiredAmount: t.requiredAmount,
    })),
  });

  for (const rawRow of params.terms) {
    const row = normalizeTermRow(rawRow);
    const pct =
      row.ruleType === "percentage" ? row.requiredPercentage : null;
    const amt = row.ruleType === "fixed_amount" ? row.requiredAmount : null;
    const payload = rulePayload(
      params.schoolId,
      params.classId,
      params.userId,
      "term_based",
      row.ruleType,
      pct,
      amt,
      row.isEnabled,
      params.allowAdminOverride,
      row.messageToParent,
      params.academicYear,
      row.term,
      null
    );

    const { data: existing, error: findErr } = await db
      .from("report_card_fee_rules")
      .select("id")
      .eq("school_id", params.schoolId)
      .eq("class_id", params.classId)
      .eq("schedule_type", "term_based")
      .eq("academic_year", params.academicYear)
      .eq("term", row.term)
      .maybeSingle();

    if (findErr) {
      devLog("upsertTermRules find error", findErr);
      return findErr.message;
    }

    const existingId = (existing as { id?: string } | null)?.id;

    if (existingId) {
      const { error } = await db
        .from("report_card_fee_rules")
        .update({
          rule_type: payload.rule_type,
          required_percentage: payload.required_percentage,
          required_amount: payload.required_amount,
          is_enabled: row.isEnabled,
          allow_admin_override: payload.allow_admin_override,
          message_to_parent: payload.message_to_parent,
        })
        .eq("id", existingId);
      if (error) {
        devLog("upsertTermRules update error", { term: row.term, error });
        return error.message;
      }
    } else if (row.isEnabled) {
      const { error } = await db.from("report_card_fee_rules").insert(payload);
      if (error) {
        devLog("upsertTermRules insert error", { term: row.term, error });
        return error.message;
      }
    }
  }
  return null;
}

export async function upsertMonthRules(
  rulesDb: RulesDb,
  params: {
    schoolId: string;
    classId: string;
    userId: string;
    academicYear: string;
    allowAdminOverride: boolean;
    months: MonthRuleInput[];
  }
): Promise<string | null> {
  const db = asRulesDb(rulesDb);

  devLog("upsertMonthRules", {
    academicYear: params.academicYear,
    enabledMonths: params.months
      .filter((m) => m.isEnabled)
      .map((m) => ({
        month: m.month,
        isEnabled: m.isEnabled,
        requiredPercentage: m.requiredPercentage,
      })),
  });

  for (const row of params.months) {
    const { data: existing, error: findErr } = await db
      .from("report_card_fee_rules")
      .select("id")
      .eq("school_id", params.schoolId)
      .eq("class_id", params.classId)
      .eq("schedule_type", "monthly_milestones")
      .eq("academic_year", params.academicYear)
      .eq("month", row.month)
      .maybeSingle();

    if (findErr) {
      devLog("upsertMonthRules find error", findErr);
      return findErr.message;
    }

    const existingId = (existing as { id?: string } | null)?.id;

    if (!row.isEnabled) {
      if (existingId) {
        const { error } = await db
          .from("report_card_fee_rules")
          .update({ is_enabled: false })
          .eq("id", existingId);
        if (error) {
          devLog("upsertMonthRules disable error", { month: row.month, error });
          return error.message;
        }
      }
      continue;
    }

    const pct =
      row.ruleType === "percentage"
        ? row.requiredPercentage != null
          ? Number(row.requiredPercentage)
          : 0
        : null;
    const amt =
      row.ruleType === "fixed_amount"
        ? row.requiredAmount != null
          ? Number(row.requiredAmount)
          : 0
        : null;

    const payload = rulePayload(
      params.schoolId,
      params.classId,
      params.userId,
      "monthly_milestones",
      row.ruleType,
      pct,
      amt,
      true,
      params.allowAdminOverride,
      row.messageToParent,
      params.academicYear,
      null,
      row.month
    );

    if (existingId) {
      const { error } = await db
        .from("report_card_fee_rules")
        .update({
          rule_type: payload.rule_type,
          required_percentage: payload.required_percentage,
          required_amount: payload.required_amount,
          is_enabled: true,
          allow_admin_override: payload.allow_admin_override,
          message_to_parent: payload.message_to_parent,
        })
        .eq("id", existingId);
      if (error) {
        devLog("upsertMonthRules update error", { month: row.month, error });
        return error.message;
      }
    } else {
      const { error } = await db.from("report_card_fee_rules").insert(payload);
      if (error) {
        devLog("upsertMonthRules insert error", { month: row.month, error });
        return error.message;
      }
    }
  }
  return null;
}

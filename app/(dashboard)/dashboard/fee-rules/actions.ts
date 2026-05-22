"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import type { Database } from "@/types/supabase";
import {
  canManageReportCardFeeRules,
} from "@/lib/report-card-fee/permissions";
import { logReportCardFeeAudit } from "@/lib/report-card-fee/audit";
import { getClassAssignedFeeTotal } from "@/lib/report-card-fee/eligibility";
import type { ReportCardFeeRuleType } from "@/lib/report-card-fee/types";

export type FeeRuleActionState =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type FeeRulePreviewState =
  | {
      ok: true;
      eligibleCount: number;
      blockedCount: number;
      totalStudents: number;
    }
  | { ok: false; error: string };

async function requireFinanceAccess(): Promise<
  | { ok: true; userId: string; schoolId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await canManageReportCardFeeRules(supabase, user.id, schoolId))) {
    return { ok: false, error: "You do not have permission to manage fee rules." };
  }

  return { ok: true, userId: user.id, schoolId, supabase };
}

function parseRuleType(raw: string): ReportCardFeeRuleType | null {
  if (raw === "percentage" || raw === "fixed_amount") return raw;
  return null;
}

export async function saveReportCardFeeRuleAction(
  _prev: FeeRuleActionState | null,
  formData: FormData
): Promise<FeeRuleActionState> {
  const gate = await requireFinanceAccess();
  if (!gate.ok) return gate;

  const classId = String(formData.get("class_id") ?? "").trim();
  const ruleType = parseRuleType(String(formData.get("rule_type") ?? ""));
  const isEnabled = formData.get("is_enabled") === "on" || formData.get("is_enabled") === "true";
  const allowAdminOverride =
    formData.get("allow_admin_override") !== "off" &&
    formData.get("allow_admin_override") !== "false";
  const messageToParent = String(formData.get("message_to_parent") ?? "").trim();

  if (!classId) return { ok: false, error: "Missing class." };
  if (!ruleType) return { ok: false, error: "Select a rule type." };

  let requiredPercentage: number | null = null;
  let requiredAmount: number | null = null;

  if (ruleType === "percentage") {
    const pct = Number(String(formData.get("required_percentage") ?? ""));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { ok: false, error: "Enter a percentage between 0 and 100." };
    }
    requiredPercentage = pct;
  } else {
    const amt = Number(String(formData.get("required_amount") ?? ""));
    if (!Number.isFinite(amt) || amt < 0) {
      return { ok: false, error: "Enter a valid fixed amount." };
    }
    requiredAmount = amt;
  }

  const { data: classRow } = await gate.supabase
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .eq("school_id", gate.schoolId)
    .maybeSingle();

  if (!classRow) return { ok: false, error: "Class not found." };

  const { data: existing } = await gate.supabase
    .from("report_card_fee_rules")
    .select("id, is_enabled")
    .eq("class_id", classId)
    .maybeSingle();

  const payload = {
    school_id: gate.schoolId,
    class_id: classId,
    rule_type: ruleType,
    required_percentage: requiredPercentage,
    required_amount: requiredAmount,
    is_enabled: isEnabled,
    allow_admin_override: allowAdminOverride,
    message_to_parent: messageToParent || null,
    created_by: gate.userId,
  };

  const admin = createAdminClient();
  type RulesUpdate = Database["public"]["Tables"]["report_card_fee_rules"]["Update"];
  type RulesInsert = Database["public"]["Tables"]["report_card_fee_rules"]["Insert"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesDb = admin as any;

  if (existing) {
    const updatePayload: RulesUpdate = {
      rule_type: ruleType,
      required_percentage: requiredPercentage,
      required_amount: requiredAmount,
      is_enabled: isEnabled,
      allow_admin_override: allowAdminOverride,
      message_to_parent: messageToParent || null,
    };
    const { error } = await rulesDb
      .from("report_card_fee_rules")
      .update(updatePayload)
      .eq("id", (existing as { id: string }).id);

    if (error) return { ok: false, error: error.message };

    await logReportCardFeeAudit(admin, {
      schoolId: gate.schoolId,
      classId,
      performedBy: gate.userId,
      action: isEnabled ? "rule_changed" : "rule_disabled",
      details: { rule_type: ruleType, is_enabled: isEnabled },
    });
  } else {
    const insertPayload: RulesInsert = payload;
    const { error } = await rulesDb
      .from("report_card_fee_rules")
      .insert(insertPayload);

    if (error) return { ok: false, error: error.message };

    await logReportCardFeeAudit(admin, {
      schoolId: gate.schoolId,
      classId,
      performedBy: gate.userId,
      action: "rule_created",
      details: { rule_type: ruleType, is_enabled: isEnabled },
    });
  }

  revalidatePath("/dashboard/fee-rules");
  revalidatePath("/teacher-dashboard/coordinator");
  return {
    ok: true,
    message: isEnabled ? "Fee rule saved." : "Fee rule saved (disabled).",
  };
}

export async function previewClassFeeEligibilityAction(
  classId: string
): Promise<FeeRulePreviewState> {
  const gate = await requireFinanceAccess();
  if (!gate.ok) return gate;

  const admin = createAdminClient();
  const { data: students } = await admin
    .from("students")
    .select("id")
    .eq("school_id", gate.schoolId)
    .eq("class_id", classId)
    .eq("status", "active");

  const { checkParentReportEligibility } = await import(
    "@/lib/report-card-fee/eligibility"
  );

  let eligibleCount = 0;
  let blockedCount = 0;
  for (const s of students ?? []) {
    const elig = await checkParentReportEligibility(
      (s as { id: string }).id,
      classId,
      admin
    );
    if (elig.eligible) eligibleCount++;
    else blockedCount++;
  }

  return {
    ok: true,
    eligibleCount,
    blockedCount,
    totalStudents: (students ?? []).length,
  };
}

export async function loadClassAssignedFeeForRules(
  schoolId: string,
  classId: string
): Promise<number> {
  const supabase = await createClient();
  return getClassAssignedFeeTotal(supabase, schoolId, classId);
}

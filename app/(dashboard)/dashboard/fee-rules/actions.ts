"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, normalizeServiceRoleKey } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  canManageReportCardFeeRules,
} from "@/lib/report-card-fee/permissions";
import { logReportCardFeeAudit } from "@/lib/report-card-fee/audit";
import { getClassAssignedFeeTotal } from "@/lib/report-card-fee/eligibility";
import {
  calculateEligibilityInsight,
  DEFAULT_ALMOST_ELIGIBLE_BUFFER_PERCENT,
  type EligibilityInsightStudentRow,
} from "@/lib/report-card-fee/eligibility-insight";
import { resolveReportCardFeeRule } from "@/lib/report-card-fee/rule-resolution";
import { loadReportCardFeeRulesForClass } from "@/lib/report-card-fee/rule-resolution-server";
import {
  deleteRulesForOtherSchedules,
  upsertMonthRules,
  upsertSimpleRule,
  upsertTermRules,
} from "@/lib/report-card-fee/persist-rules";
import type {
  MonthRuleInput,
  ReportCardFeeRuleType,
  TermRuleInput,
} from "@/lib/report-card-fee/types";
import type { ReportCardFeeScheduleType } from "@/lib/report-card-fee/schedule-types";
export type FeeRuleActionState =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type FeeRulePreviewParams = {
  academicYear?: string;
  term?: string;
  month?: number;
};

export type FeeRulePreviewState =
  | {
      ok: true;
      className: string;
      feeAssigned: number;
      scheduleType: ReportCardFeeScheduleType | null;
      ruleEnabled: boolean;
      ruleType: ReportCardFeeRuleType | null;
      requiredPercentage: number | null;
      requiredAmount: number | null;
      appliedRuleLabel: string | null;
      eligibleCount: number;
      almostEligibleCount: number;
      blockedCount: number;
      totalStudents: number;
      bufferPercent: number;
      blockedSample: EligibilityInsightStudentRow[];
      almostEligibleSample: EligibilityInsightStudentRow[];
      blockedMoreCount: number;
      almostEligibleMoreCount: number;
      collectionOpportunityCount: number;
      estimatedRemainingCollection: number;
    }
  | { ok: false; error: string };

async function requireFinanceAccess(): Promise<
  | {
      ok: true;
      userId: string;
      schoolId: string;
      supabase: Awaited<ReturnType<typeof createClient>>;
    }
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
    return {
      ok: false,
      error: "You do not have permission to manage fee rules.",
    };
  }

  return { ok: true, userId: user.id, schoolId, supabase };
}

function parseRuleType(raw: string): ReportCardFeeRuleType | null {
  if (raw === "percentage" || raw === "fixed_amount") return raw;
  return null;
}

function parseScheduleType(raw: string): ReportCardFeeScheduleType | null {
  if (
    raw === "simple" ||
    raw === "term_based" ||
    raw === "monthly_milestones"
  ) {
    return raw;
  }
  return null;
}

export async function saveReportCardFeeRuleAction(
  _prev: FeeRuleActionState | null,
  formData: FormData
): Promise<FeeRuleActionState> {
  const gate = await requireFinanceAccess();
  if (!gate.ok) return gate;

  const classId = String(formData.get("class_id") ?? "").trim();
  const scheduleType = parseScheduleType(
    String(formData.get("schedule_type") ?? "simple")
  );
  const allowAdminOverride =
    formData.get("allow_admin_override") === "true" ||
    formData.get("allow_admin_override") === "on";

  if (!classId) return { ok: false, error: "Missing class." };
  if (!scheduleType) return { ok: false, error: "Select a schedule type." };

  const { data: classRow } = await gate.supabase
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .eq("school_id", gate.schoolId)
    .maybeSingle();

  if (!classRow) return { ok: false, error: "Class not found." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Server configuration error. Contact support." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesDb = admin as any;

  const savePayload = {
    classId,
    scheduleType,
    allowAdminOverride,
    academicYear: String(formData.get("academic_year") ?? "").trim(),
    rulesJson: String(formData.get("rules_json") ?? "").trim(),
    isEnabled: String(formData.get("is_enabled") ?? ""),
    ruleType: String(formData.get("rule_type") ?? ""),
    simpleRuleId: String(formData.get("simple_rule_id") ?? "").trim() || null,
  };
  if (process.env.NODE_ENV === "development") {
    console.log("[saveReportCardFeeRuleAction] payload", savePayload);
  }

  let persistError: string | null = null;

  if (scheduleType === "simple") {
    const ruleType = parseRuleType(String(formData.get("rule_type") ?? ""));
    const isEnabled =
      formData.get("is_enabled") === "on" ||
      formData.get("is_enabled") === "true";
    const messageToParent = String(formData.get("message_to_parent") ?? "").trim();
    const existingId = String(formData.get("simple_rule_id") ?? "").trim() || null;

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

    persistError = await upsertSimpleRule(rulesDb, {
      schoolId: gate.schoolId,
      classId,
      userId: gate.userId,
      existingId,
      ruleType,
      requiredPercentage,
      requiredAmount,
      isEnabled,
      allowAdminOverride,
      messageToParent: messageToParent || null,
    });
  } else {
    const academicYear = String(formData.get("academic_year") ?? "").trim();
    if (!/^\d{4}$/.test(academicYear)) {
      return { ok: false, error: "Enter a valid academic year (e.g. 2026)." };
    }

    const rulesJson = String(formData.get("rules_json") ?? "").trim();
    if (!rulesJson) return { ok: false, error: "Missing rule configuration." };

    let parsed: { terms?: TermRuleInput[]; months?: MonthRuleInput[] };
    try {
      parsed = JSON.parse(rulesJson) as {
        terms?: TermRuleInput[];
        months?: MonthRuleInput[];
      };
    } catch {
      return { ok: false, error: "Invalid rule data." };
    }

    if (scheduleType === "term_based") {
      const terms = parsed.terms ?? [];
      if (terms.length === 0) {
        return { ok: false, error: "Configure at least one term." };
      }
      persistError = await upsertTermRules(rulesDb, {
        schoolId: gate.schoolId,
        classId,
        userId: gate.userId,
        academicYear,
        allowAdminOverride,
        terms,
      });
    } else {
      const months = parsed.months ?? [];
      persistError = await upsertMonthRules(rulesDb, {
        schoolId: gate.schoolId,
        classId,
        userId: gate.userId,
        academicYear,
        allowAdminOverride,
        months,
      });
    }
  }

  if (persistError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[saveReportCardFeeRuleAction] persist failed", persistError);
    }
    return { ok: false, error: persistError };
  }

  const delErr = await deleteRulesForOtherSchedules(
    admin,
    gate.schoolId,
    classId,
    scheduleType
  );
  if (delErr) {
    if (process.env.NODE_ENV === "development") {
      console.error("[saveReportCardFeeRuleAction] cleanup failed", delErr);
    }
    return { ok: false, error: delErr };
  }

  if (process.env.NODE_ENV === "development") {
    const { data: afterSave } = await admin
      .from("report_card_fee_rules")
      .select(
        "id, schedule_type, term, month, is_enabled, rule_type, required_percentage, academic_year"
      )
      .eq("school_id", gate.schoolId)
      .eq("class_id", classId);
    console.log("[saveReportCardFeeRuleAction] saved rows", afterSave);
  }

  await logReportCardFeeAudit(admin, {
    schoolId: gate.schoolId,
    classId,
    performedBy: gate.userId,
    action: "rule_changed",
    details: { schedule_type: scheduleType },
  });

  revalidatePath("/dashboard/fee-rules");
  revalidatePath("/teacher-dashboard/coordinator");
  return { ok: true, message: "Report card access rules saved." };
}

const PREVIEW_LOAD_ERROR = "Could not load preview. Please try again.";

export async function previewClassFeeEligibilityAction(
  classId: string,
  params?: FeeRulePreviewParams
): Promise<FeeRulePreviewState> {
  const logPreview = (step: string, detail?: Record<string, unknown>) => {
    console.error("[fee-rules/preview]", step, detail ?? {});
  };

  try {
    logPreview("start", {
      classId: classId?.trim() || classId,
      params: params ?? null,
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      hasServiceRoleKey: Boolean(
        normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
      ),
      vercel: process.env.VERCEL ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
    });

    const gate = await requireFinanceAccess();
    if (!gate.ok) {
      logPreview("finance_access_denied", { reason: gate.error });
      return { ok: false, error: PREVIEW_LOAD_ERROR };
    }

    const trimmedClassId = classId?.trim();
    if (!trimmedClassId) {
      logPreview("invalid_class_id", { classId });
      return { ok: false, error: PREVIEW_LOAD_ERROR };
    }

    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch (adminErr) {
      logPreview("createAdminClient_failed", {
        message:
          adminErr instanceof Error ? adminErr.message : String(adminErr),
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
        hasServiceRoleKey: Boolean(
          normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
        ),
      });
      return { ok: false, error: PREVIEW_LOAD_ERROR };
    }

    const academicYear = params?.academicYear?.trim() || null;
    const term = params?.term?.trim() || null;
    const sendMonth =
      params?.month != null && params.month >= 1 && params.month <= 12
        ? params.month
        : null;

    const [{ data: classRow }, feeAssigned, loaded] = await Promise.all([
      admin
        .from("classes")
        .select("name")
        .eq("id", trimmedClassId)
        .eq("school_id", gate.schoolId)
        .maybeSingle(),
      getClassAssignedFeeTotal(admin, gate.schoolId, trimmedClassId),
      loadReportCardFeeRulesForClass(admin, trimmedClassId),
    ]);

    if (!classRow) {
      logPreview("class_not_found", {
        classId: trimmedClassId,
        schoolId: gate.schoolId,
      });
      return { ok: false, error: PREVIEW_LOAD_ERROR };
    }

    const className =
      (classRow as { name?: string } | null)?.name?.trim() || "Class";

    const resolved = loaded
      ? resolveReportCardFeeRule(
          loaded.directRules,
          loaded.allRulesIncludingParent,
          trimmedClassId,
          {
            academicYear,
            term,
            sendMonth: sendMonth ?? undefined,
          }
        )
      : null;

    const ruleEnabled = Boolean(resolved);
    const rule = resolved?.rule ?? null;

    const { data: students } = await admin
      .from("students")
      .select("id, full_name, admission_number")
      .eq("school_id", gate.schoolId)
      .eq("class_id", trimmedClassId)
      .eq("status", "active");

    const totalStudents = (students ?? []).length;

    const { checkParentReportEligibility } = await import(
      "@/lib/report-card-fee/eligibility"
    );

    const eligibilityResults = await Promise.all(
      (students ?? []).map(async (s) => {
        const st = s as {
          id: string;
          full_name: string | null;
          admission_number: string | null;
        };
        const elig = await checkParentReportEligibility(
          st.id,
          trimmedClassId,
          admin,
          {
            academicYear,
            term,
            sendMonth: sendMonth ?? undefined,
          }
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
      feeAssigned,
      ruleEnabled,
    });

    return {
      ok: true,
      className,
      feeAssigned,
      scheduleType: resolved?.scheduleType ?? null,
      ruleEnabled,
      ruleType: rule?.rule_type ?? null,
      requiredPercentage:
        rule?.required_percentage != null
          ? Number(rule.required_percentage)
          : null,
      requiredAmount:
        rule?.required_amount != null ? Number(rule.required_amount) : null,
      appliedRuleLabel: resolved?.appliedRuleLabel ?? null,
      eligibleCount: insight.eligibleCount,
      almostEligibleCount: insight.almostEligibleCount,
      blockedCount: insight.blockedCount,
      totalStudents,
      bufferPercent: insight.bufferPercent,
      blockedSample: insight.sampleBlocked,
      almostEligibleSample: insight.sampleAlmostEligible,
      blockedMoreCount: insight.blockedMoreCount,
      almostEligibleMoreCount: insight.almostEligibleMoreCount,
      collectionOpportunityCount: insight.collectionOpportunityCount,
      estimatedRemainingCollection: insight.estimatedRemainingCollection,
    };
  } catch (err) {
    logPreview("unexpected_error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined,
    });
    return { ok: false, error: PREVIEW_LOAD_ERROR };
  }
}

export async function loadClassAssignedFeeForRules(
  schoolId: string,
  classId: string
): Promise<number> {
  const supabase = await createClient();
  return getClassAssignedFeeTotal(supabase, schoolId, classId);
}

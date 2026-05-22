import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency } from "@/lib/currency";
import { canManageReportCardFeeRules } from "@/lib/report-card-fee/permissions";
import { getClassAssignedFeeTotal } from "@/lib/report-card-fee/eligibility";
import { buildClassFeeRulesConfig } from "@/lib/report-card-fee/build-class-rules-config";
import { normalizeReportCardFeeRuleRow } from "@/lib/report-card-fee/normalize-rule-row";
import {
  computeFeeRulesPageInsights,
  type FeeRulesPageInsights,
} from "@/lib/report-card-fee/page-insights";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { FeeRulesClient, type FeeRulesClassRow } from "./fee-rules-client";
import { FeeRulesCommandCenter } from "./fee-rules-command-center";
import { FeeRulesPageHeader } from "./fee-rules-page-header";
import type { ReportCardFeeRuleRow } from "@/lib/report-card-fee/types";

export const metadata = {
  title: "Report Card Access Rules",
};

const EMPTY_INSIGHTS: FeeRulesPageInsights = {
  classesProtected: 0,
  almostReadyCount: 0,
  notReadyCount: 0,
  collectionOpportunity: 0,
  insightsAvailable: true,
};

export default async function ReportCardFeeRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const profileRole = (profileRow as { role?: string } | null)?.role ?? "";

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  const canManageFeeRules = schoolId
    ? await canManageReportCardFeeRules(supabase, user.id, schoolId)
    : false;
  const homeHref =
    profileRole === "teacher" && canManageFeeRules
      ? "/dashboard/payments"
      : profileRole === "teacher"
        ? "/teacher-dashboard"
        : "/dashboard";

  if (!schoolId) redirect(homeHref);

  if (!canManageFeeRules) {
    redirect(homeHref);
  }

  const display = await resolveSchoolDisplay(user.id, supabase);
  const currency = normalizeSchoolCurrency(display?.currency);

  let rulesRaw: Record<string, unknown>[] = [];
  let rulesError: string | null = null;
  let adminClient: ReturnType<typeof createAdminClient> | null = null;

  try {
    const admin = createAdminClient();
    adminClient = admin;
    const { data, error } = await admin
      .from("report_card_fee_rules")
      .select("*")
      .eq("school_id", schoolId);

    if (error) {
      rulesError = error.message;
      const fallback = await supabase
        .from("report_card_fee_rules")
        .select("*")
        .eq("school_id", schoolId);
      if (fallback.error) {
        rulesError = fallback.error.message;
      } else {
        rulesRaw = (fallback.data ?? []) as Record<string, unknown>[];
        rulesError = null;
      }
    } else {
      rulesRaw = (data ?? []) as Record<string, unknown>[];
    }
  } catch (err) {
    rulesError = err instanceof Error ? err.message : "Failed to load rules.";
    const { data, error } = await supabase
      .from("report_card_fee_rules")
      .select("*")
      .eq("school_id", schoolId);
    if (!error) {
      rulesRaw = (data ?? []) as Record<string, unknown>[];
      rulesError = null;
    }
  }

  const normalizedRules = rulesRaw.map(normalizeReportCardFeeRuleRow);

  if (process.env.NODE_ENV === "development") {
    console.log("[fee-rules page] load", {
      schoolId,
      rulesError,
      ruleCount: normalizedRules.length,
      sample: normalizedRules.slice(0, 5).map((r) => ({
        class_id: r.class_id,
        schedule_type: r.schedule_type,
        term: r.term,
        month: r.month,
        is_enabled: r.is_enabled,
      })),
    });
  }

  const rulesByClass = new Map<string, ReportCardFeeRuleRow[]>();
  for (const r of normalizedRules) {
    const list = rulesByClass.get(r.class_id) ?? [];
    list.push(r);
    rulesByClass.set(r.class_id, list);
  }

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, parent_class_id")
    .eq("school_id", schoolId)
    .order("name");

  const typedClasses = (classes ?? []) as {
    id: string;
    name: string;
    parent_class_id: string | null;
  }[];

  const topLevel = typedClasses.filter((c) => !c.parent_class_id);
  const rows: FeeRulesClassRow[] = [];

  for (const cls of topLevel) {
    const feeAssigned = await getClassAssignedFeeTotal(
      supabase,
      schoolId,
      cls.id
    );
    const classRules = rulesByClass.get(cls.id) ?? [];
    const config = buildClassFeeRulesConfig(classRules);

    if (process.env.NODE_ENV === "development" && classRules.length > 0) {
      console.log("[fee-rules page] class config", {
        classId: cls.id,
        className: cls.name,
        scheduleType: config.scheduleType,
        simpleEnabled: config.simple?.isEnabled,
        termsEnabled: config.terms
          .filter((t) => t.isEnabled)
          .map((t) => t.term),
      });
    }

    rows.push({
      classId: cls.id,
      className: cls.name,
      feeAssigned,
      config,
    });
  }

  let insights: FeeRulesPageInsights = EMPTY_INSIGHTS;
  if (adminClient) {
    try {
      insights = await computeFeeRulesPageInsights(schoolId, rows, adminClient);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[fee-rules page] insights", err);
      }
      insights = { ...EMPTY_INSIGHTS, insightsAvailable: false };
    }
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 px-1 sm:px-0">
        <header className="space-y-4">
          <FeeRulesPageHeader
            classes={rows}
            rulesError={rulesError}
            backHref={homeHref}
          />

          <FeeRulesCommandCenter
            classes={rows}
            currency={currency}
            insights={insights}
          />
        </header>

        <FeeRulesClient classes={rows} currency={currency} />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

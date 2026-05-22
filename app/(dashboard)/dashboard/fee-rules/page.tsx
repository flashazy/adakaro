import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency } from "@/lib/currency";
import { canManageReportCardFeeRules } from "@/lib/report-card-fee/permissions";
import { getClassAssignedFeeTotal } from "@/lib/report-card-fee/eligibility";
import { BackButton } from "@/components/dashboard/back-button";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { FeeRulesClient, type FeeRulesClassRow } from "./fee-rules-client";
import type { ReportCardFeeRuleRow } from "@/lib/report-card-fee/types";

export const metadata = {
  title: "Report card fee rules",
};

export default async function ReportCardFeeRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  if (!(await canManageReportCardFeeRules(supabase, user.id, schoolId))) {
    redirect("/dashboard");
  }

  const display = await resolveSchoolDisplay(user.id, supabase);
  const currency = normalizeSchoolCurrency(display?.currency);

  const [{ data: classes }, { data: rules }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, parent_class_id")
      .eq("school_id", schoolId)
      .order("name"),
    supabase.from("report_card_fee_rules").select("*").eq("school_id", schoolId),
  ]);

  const ruleByClass = new Map(
    ((rules ?? []) as ReportCardFeeRuleRow[]).map((r) => [r.class_id, r])
  );

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
    const rule = ruleByClass.get(cls.id);
    rows.push({
      classId: cls.id,
      className: cls.name,
      feeAssigned,
      rule: rule
        ? {
            id: rule.id,
            ruleType: rule.rule_type,
            requiredPercentage:
              rule.required_percentage != null
                ? Number(rule.required_percentage)
                : null,
            requiredAmount:
              rule.required_amount != null ? Number(rule.required_amount) : null,
            isEnabled: rule.is_enabled,
            allowAdminOverride: rule.allow_admin_override,
            messageToParent: rule.message_to_parent ?? "",
          }
        : null,
    });
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <BackButton href="/dashboard">Back</BackButton>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Report card fee rules
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Control when parents can access report cards based on fee payment.
              Teachers and coordinators are not affected.
            </p>
          </div>
        </div>

        <FeeRulesClient classes={rows} currency={currency} />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

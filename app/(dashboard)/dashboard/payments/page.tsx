import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency } from "@/lib/currency";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { canManageReportCardFeeRules } from "@/lib/report-card-fee/permissions";
import { canAccessFeature } from "@/lib/plans";
import {
  getSchoolPlanRow,
  resolveSchoolPlanIdForFeatures,
} from "@/lib/plan-limits";
import { QueryErrorBanner } from "../query-error-banner";
import { PaymentClient } from "./payment-client";
import { FinanceToolsLink } from "./finance-tools-link";
import { FinanceFeeManagement } from "./finance-fee-management";
import { FinanceHubSection } from "./finance-hub-section";
import { BackButton } from "@/components/dashboard/back-button";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";
import { ReportsClient } from "../reports/reports-client";
import { FinanceCommandCenter } from "./finance-command-center";
import { FinanceReportsSummaryStrip } from "./finance-reports-summary-strip";
import { FinanceSectionLabel } from "./finance-section-label";
import {
  buildFinanceInsight,
  buildFinanceSummaryFromBalanceLines,
  type FinanceBalanceLine,
} from "@/lib/finance/finance-dashboard-summaries";

export const metadata = {
  title: "Finance",
};

export default async function PaymentsPage() {
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
  const backHref =
    profileRole === "teacher" ? "/teacher-dashboard" : "/dashboard";

  const display = await resolveSchoolDisplay(user.id, supabase);
  if (!display?.schoolId) redirect("/dashboard");
  const schoolId = display.schoolId;
  const currencyCode = normalizeSchoolCurrency(display.currency);
  const showFinanceTools = await canManageReportCardFeeRules(
    supabase,
    user.id,
    schoolId
  );
  const schoolName = display.name?.trim() || "School";

  // Fetch students (no status filter — column may not exist)
  const { data: students, error: studentsError } =
    await orderStudentsByGenderThenName(
      supabase
        .from("students")
        .select("id, full_name, admission_number, class_id, class:classes(name)")
        .eq("school_id", schoolId)
    );

  const typedStudents = (students ?? []) as {
    id: string;
    full_name: string;
    admission_number: string | null;
    class_id: string | null;
    class: { name: string } | null;
  }[];
  const studentIds = typedStudents.map((s) => s.id);
  const studentIdFilter = studentIds.length > 0 ? studentIds : [""];

  const [
    balancesRes,
    paymentsRes,
    reportBalancesRes,
    reportPaymentsRes,
    classesRes,
    feeTypesRes,
    feeStructuresRes,
  ] = await Promise.all([
      studentIds.length > 0
        ? supabase
            .from("student_fee_balances")
            .select("*")
            .in("student_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length > 0
        ? supabase
            .from("payments")
            .select(
              "id, student_id, amount, payment_method, payment_date, reference_number, notes, fee_structure_id, receipt:receipts(id, receipt_number)"
            )
            .in("student_id", studentIds)
            .order("payment_date", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
      showFinanceTools
        ? supabase
            .from("student_fee_balances")
            .select(
              "student_id, student_name, fee_structure_id, fee_name, total_fee, total_paid, balance, due_date"
            )
            .in("student_id", studentIdFilter)
        : Promise.resolve({ data: [], error: null }),
      showFinanceTools
        ? supabase
            .from("payments")
            .select(
              "id, student_id, amount, payment_method, payment_date, reference_number, student:students(full_name, admission_number)"
            )
            .in("student_id", studentIdFilter)
            .order("payment_date", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      showFinanceTools
        ? supabase
            .from("classes")
            .select("id, name")
            .eq("school_id", schoolId)
            .order("name")
        : Promise.resolve({ data: [], error: null }),
      showFinanceTools
        ? supabase
            .from("fee_types")
            .select("name, updated_at")
            .eq("school_id", schoolId)
            .order("name")
        : Promise.resolve({ data: [], error: null }),
      showFinanceTools
        ? supabase
            .from("fee_structures")
            .select("id, class_id, class:classes(name)")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .not("class_id", "is", null)
            .is("student_id", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  let canAdvancedReports = false;
  if (showFinanceTools) {
    const planRow = await getSchoolPlanRow(supabase, schoolId);
    const planId = await resolveSchoolPlanIdForFeatures(
      supabase,
      schoolId,
      planRow?.plan
    );
    canAdvancedReports = canAccessFeature(planId, "advancedReports");
  }

  const fetchError = combineSupabaseErrors([
    studentsError,
    balancesRes.error,
    paymentsRes.error,
    reportBalancesRes.error,
    reportPaymentsRes.error,
    classesRes.error,
  ]);
  if (fetchError) {
    console.error("[payments] error:", fetchError);
  }

  const typedBalances = (balancesRes.data ?? []) as {
    student_id: string;
    fee_structure_id: string;
    fee_name: string;
    total_fee: number;
    total_paid: number;
    balance: number;
    due_date: string | null;
  }[];
  const reportBalanceLines = (reportBalancesRes.data ?? []) as FinanceBalanceLine[];
  const reportClasses = (classesRes.data ?? []) as { id: string; name: string }[];

  let financeSummary = buildFinanceSummaryFromBalanceLines([]);
  let financeInsight = buildFinanceInsight([], {}, {});
  if (showFinanceTools) {
    const classRecord: Record<string, string> = {};
    for (const c of reportClasses) classRecord[c.id] = c.name;
    const studentClassRecord: Record<string, string> = {};
    for (const s of typedStudents) {
      if (s.class_id) studentClassRecord[s.id] = s.class_id;
    }
    financeSummary = buildFinanceSummaryFromBalanceLines(reportBalanceLines);
    financeInsight = buildFinanceInsight(
      reportBalanceLines,
      classRecord,
      studentClassRecord
    );
  }

  const feeTypeRows = (feeTypesRes.data ?? []) as {
    name: string;
    updated_at: string;
  }[];
  const feeStructureRows = (feeStructuresRes.data ?? []) as {
    id: string;
    class_id: string | null;
    class: { name: string } | null;
  }[];
  const feeTypesCount = showFinanceTools ? feeTypeRows.length : undefined;
  const feeStructuresCount = showFinanceTools
    ? feeStructureRows.length
    : undefined;

  let feeTypesLastUpdated: string | undefined;
  if (showFinanceTools) {
    if (feeTypeRows.length === 0) {
      feeTypesLastUpdated = "Not configured yet";
    } else {
      let latestMs = 0;
      for (const row of feeTypeRows) {
        const ms = new Date(row.updated_at).getTime();
        if (!Number.isNaN(ms) && ms > latestMs) latestMs = ms;
      }
      if (latestMs > 0) {
        feeTypesLastUpdated = `Last updated ${new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(latestMs))}`;
      }
    }
  }

  const configuredClassesCount = showFinanceTools
    ? new Set(
        feeStructureRows
          .map((r) => r.class_id)
          .filter((id): id is string => Boolean(id))
      ).size
    : undefined;

  const reportPaymentsForTrend = (
    (reportPaymentsRes.data ?? []) as { payment_date: string; amount: number }[]
  ).map((p) => ({
    payment_date: p.payment_date,
    amount: Number(p.amount) || 0,
  }));

  const typedPayments = (paymentsRes.data ?? []) as {
    id: string;
    student_id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    reference_number: string | null;
    notes: string | null;
    fee_structure_id: string | null;
    receipt: { id: string; receipt_number: string } | null;
  }[];

  return (
    <>
      <header className="border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white dark:border-zinc-800 dark:from-zinc-900/95 dark:to-zinc-900">
        <div
          className={`mx-auto flex items-center justify-between px-4 py-4 sm:px-0 ${showFinanceTools ? "max-w-6xl" : "max-w-3xl"}`}
        >
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Finance
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {showFinanceTools
                ? "Manage school fees, payments, balances, and financial reporting."
                : "Select a student, view balances, and record a payment."}
            </p>
          </div>
          <BackButton
            href={backHref}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </BackButton>
        </div>
      </header>

      <main
        className={`mx-auto space-y-8 py-8 sm:space-y-10 sm:py-10 ${showFinanceTools ? "max-w-6xl px-4 sm:px-0" : "max-w-3xl px-4 sm:px-0"}`}
      >
        {fetchError ? (
          <QueryErrorBanner
            title="Could not load payment data"
            message={fetchError}
          >
            <p className="text-xs text-red-800 dark:text-red-200">
              Apply migrations{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00018_get_my_school_id
              </code>{" "}
              and{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                00019_admin_rls_is_school_admin
              </code>{" "}
              if school-scoped reads fail.
            </p>
          </QueryErrorBanner>
        ) : null}

        {showFinanceTools ? (
          <>
            <FinanceCommandCenter
              summary={financeSummary}
              insight={financeInsight}
              currencyCode={currencyCode}
              paymentsForTrend={reportPaymentsForTrend}
            />

            <div className="space-y-5">
              <FinanceSectionLabel>Operations</FinanceSectionLabel>
              <FinanceFeeManagement
                feeTypesCount={feeTypesCount}
                feeStructuresCount={feeStructuresCount}
                feeTypesLastUpdated={feeTypesLastUpdated}
                configuredClassesCount={configuredClassesCount}
              />

              <FinanceHubSection
              id="finance-record-payment"
              title="Record Payment"
              description="Find a student to record payments and review balances."
            >
              <PaymentClient
                students={typedStudents}
                balances={typedBalances}
                payments={typedPayments}
                currencyCode={currencyCode}
              />
            </FinanceHubSection>
            </div>

            <div className="space-y-5">
              <FinanceSectionLabel>Access control</FinanceSectionLabel>
              <FinanceHubSection
              id="finance-report-access"
              title="Report Card Access Rules"
              description="Control when parents can open report cards based on fee payment."
            >
              <FinanceToolsLink />
            </FinanceHubSection>
            </div>

            <div className="space-y-5">
              <FinanceSectionLabel>Reporting</FinanceSectionLabel>
              <FinanceHubSection
              id="finance-reports"
              title="Financial Reports"
              description="Student fees, class totals, balances, and income trend — export and print."
              className="border-t border-slate-200 pt-8 dark:border-zinc-800 sm:pt-10"
            >
              <FinanceReportsSummaryStrip
                summary={financeSummary}
                insight={financeInsight}
                currencyCode={currencyCode}
              />
              <ReportsClient
              balances={(reportBalancesRes.data ?? []) as {
                student_id: string;
                student_name: string;
                fee_structure_id: string;
                fee_name: string;
                total_fee: number;
                total_paid: number;
                balance: number;
                due_date: string | null;
              }[]}
              payments={(reportPaymentsRes.data ?? []) as {
                id: string;
                student_id: string;
                amount: number;
                payment_method: string | null;
                payment_date: string;
                reference_number: string | null;
                student: {
                  full_name: string;
                  admission_number: string | null;
                } | null;
              }[]}
              classes={reportClasses}
              studentClasses={typedStudents.map((s) => ({
                id: s.id,
                class_id: s.class_id ?? "",
              }))}
              schoolName={schoolName}
              currencyCode={currencyCode}
              canAdvancedReports={canAdvancedReports}
              financeTablePolish
            />
            </FinanceHubSection>
            </div>
          </>
        ) : (
          <PaymentClient
            students={typedStudents}
            balances={typedBalances}
            payments={typedPayments}
            currencyCode={currencyCode}
          />
        )}
      </main>
      <SmartFloatingScrollButton
        sectionIds={
          showFinanceTools
            ? [
                "finance-command-center",
                "finance-fee-management",
                "finance-record-payment",
                "finance-report-access",
                "finance-reports",
              ]
            : []
        }
      />
    </>
  );
}

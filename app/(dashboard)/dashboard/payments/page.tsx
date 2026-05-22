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
import { BackButton } from "@/components/dashboard/back-button";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { orderStudentsByGenderThenName } from "@/lib/student-list-order";
import { ReportsClient } from "../reports/reports-client";

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

  const [balancesRes, paymentsRes, reportBalancesRes, reportPaymentsRes, classesRes] =
    await Promise.all([
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
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div
          className={`mx-auto flex items-center justify-between py-4 ${showFinanceTools ? "max-w-6xl px-1 sm:px-0" : "max-w-3xl"}`}
        >
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Finance
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {showFinanceTools
                ? "Manage school payments, balances, report access rules, and financial reports."
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
        className={`mx-auto space-y-6 py-10 ${showFinanceTools ? "max-w-6xl px-1 sm:px-0" : "max-w-3xl"}`}
      >
        {showFinanceTools ? (
          <section aria-label="Report card access rules">
            <FinanceToolsLink />
          </section>
        ) : null}
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
        <PaymentClient
          students={typedStudents}
          balances={typedBalances}
          payments={typedPayments}
          currencyCode={currencyCode}
        />

        {showFinanceTools ? (
          <section
            aria-label="Financial Reports"
            className="border-t border-slate-200 pt-10 dark:border-zinc-800"
          >
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Financial Reports
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Student fees, class totals, outstanding balances, and monthly
                income — same data as Reports, with export and print.
              </p>
            </div>
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
              classes={(classesRes.data ?? []) as { id: string; name: string }[]}
              studentClasses={typedStudents.map((s) => ({
                id: s.id,
                class_id: s.class_id ?? "",
              }))}
              schoolName={schoolName}
              currencyCode={currencyCode}
              canAdvancedReports={canAdvancedReports}
            />
          </section>
        ) : null}
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}

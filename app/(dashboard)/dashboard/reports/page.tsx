import { redirect } from "next/navigation";
import Link from "next/link";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency } from "@/lib/currency";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { canAccessFeature } from "@/lib/plans";
import {
  getSchoolPlanRow,
  resolveSchoolPlanIdForFeatures,
} from "@/lib/plan-limits";
import { QueryErrorBanner } from "../query-error-banner";
import { ReportsClient } from "./reports-client";

interface BalanceRow {
  student_id: string;
  student_name: string;
  fee_structure_id: string;
  fee_name: string;
  total_fee: number;
  total_paid: number;
  balance: number;
  due_date: string | null;
}

interface PaymentRow {
  id: string;
  student_id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  reference_number: string | null;
  student: { full_name: string; admission_number: string | null } | null;
}

interface ClassRow {
  id: string;
  name: string;
}

interface StudentClassRow {
  id: string;
  class_id: string;
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const display = await resolveSchoolDisplay(user.id, supabase);
  if (!display?.schoolId) redirect("/dashboard");
  const schoolId = display.schoolId;

  // Get student IDs for this school first (needed for payments filter)
  const { data: schoolStudents, error: schoolStudentsError } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId);

  const typedSchoolStudents = (schoolStudents ?? []) as { id: string; class_id: string }[];
  const studentIds = typedSchoolStudents.map((s) => s.id);

  const [balancesRes, paymentsRes, classesRes] = await Promise.all([
    supabase
      .from("student_fee_balances")
      .select(
        "student_id, student_name, fee_structure_id, fee_name, total_fee, total_paid, balance, due_date"
      )
      .in("student_id", studentIds.length > 0 ? studentIds : [""]),
    supabase
      .from("payments")
      .select(
        "id, student_id, amount, payment_method, payment_date, reference_number, student:students(full_name, admission_number)"
      )
      .in("student_id", studentIds.length > 0 ? studentIds : [""])
      .order("payment_date", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name"),
  ]);

  const balances = (balancesRes.data ?? []) as BalanceRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const classes = (classesRes.data ?? []) as ClassRow[];
  const studentClasses = typedSchoolStudents as StudentClassRow[];
  const schoolName = display.name?.trim() || "School";
  const currencyCode = normalizeSchoolCurrency(display.currency);

  const planRow = await getSchoolPlanRow(supabase, schoolId);
  const planId = await resolveSchoolPlanIdForFeatures(
    supabase,
    schoolId,
    planRow?.plan
  );
  const canAdvancedReports = canAccessFeature(planId, "advancedReports");

  const fetchError = combineSupabaseErrors([
    schoolStudentsError,
    balancesRes.error,
    paymentsRes.error,
    classesRes.error,
  ]);
  if (fetchError) {
    console.error("[reports] error:", fetchError);
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-none items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Reports
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {schoolName} ({currencyCode}) — Generate and export school reports
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-none space-y-6 py-10">
        {fetchError ? (
          <QueryErrorBanner
            title="Could not load report data"
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
              if reads are blocked by RLS.
            </p>
          </QueryErrorBanner>
        ) : null}
        <ReportsClient
          balances={balances}
          payments={payments}
          classes={classes}
          studentClasses={studentClasses}
          schoolName={schoolName}
          currencyCode={currencyCode}
          canAdvancedReports={canAdvancedReports}
        />
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { normalizeSchoolCurrency } from "@/lib/currency";
import { combineSupabaseErrors } from "@/lib/dashboard/supabase-error";
import { QueryErrorBanner } from "../query-error-banner";
import { PaymentClient } from "./payment-client";
import Link from "next/link";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const display = await resolveSchoolDisplay(user.id, supabase);
  if (!display?.schoolId) redirect("/dashboard");
  const schoolId = display.schoolId;
  const currencyCode = normalizeSchoolCurrency(display.currency);

  // Fetch students (no status filter — column may not exist)
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, admission_number, class:classes(name)")
    .eq("school_id", schoolId)
    .order("full_name");


  const typedStudents = (students ?? []) as { id: string; full_name: string; admission_number: string | null; class: { name: string } | null }[];
  const studentIds = typedStudents.map((s) => s.id);

  // Fetch balances — query by student_id list instead of school_id
  const balancesRes = studentIds.length > 0
    ? await supabase
        .from("student_fee_balances")
        .select("*")
        .in("student_id", studentIds)
    : { data: [], error: null };

  // Fetch recent payments — no join to fee_structures (FK may not exist)
  const paymentsRes = studentIds.length > 0
    ? await supabase
        .from("payments")
        .select("id, student_id, amount, payment_method, payment_date, reference_number, notes, fee_structure_id, receipt:receipts(id, receipt_number)")
        .in("student_id", studentIds)
        .order("payment_date", { ascending: false })
        .limit(50)
    : { data: [], error: null };

  const fetchError = combineSupabaseErrors([
    studentsError,
    balancesRes.error,
    paymentsRes.error,
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
        <div className="mx-auto flex max-w-3xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Record Payment
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Select a student, view balances, and record a payment.
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

      <main className="mx-auto max-w-3xl space-y-6 py-10">
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
      </main>
    </>
  );
}

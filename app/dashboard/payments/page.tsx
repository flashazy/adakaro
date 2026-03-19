import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaymentClient } from "./payment-client";
import Link from "next/link";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/dashboard/setup");

  const schoolId = membership.school_id;

  // Fetch students (no status filter — column may not exist)
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, admission_number, class:classes(name)")
    .eq("school_id", schoolId)
    .order("full_name");


  // Get student IDs for sub-queries
  const studentIds = (students ?? []).map((s) => s.id);

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

  if (balancesRes.error) {
    console.log("[payments] balances error:", balancesRes.error);
  }
  if (paymentsRes.error) {
    console.log("[payments] payments error:", paymentsRes.error);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <PaymentClient
          students={students ?? []}
          balances={balancesRes.data ?? []}
          payments={paymentsRes.data ?? []}
        />
      </main>
    </div>
  );
}

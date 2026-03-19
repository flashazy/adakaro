import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  const { data: membership } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/dashboard/setup");
  const membershipTyped = membership as { school_id: string };
  const schoolId = membershipTyped.school_id;

  // Get student IDs for this school first (needed for payments filter)
  const { data: schoolStudents } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId);

  const typedSchoolStudents = (schoolStudents ?? []) as { id: string; class_id: string }[];
  const studentIds = typedSchoolStudents.map((s) => s.id);

  const [balancesRes, paymentsRes, classesRes, schoolRes] = await Promise.all([
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
    supabase.from("schools").select("name").eq("id", schoolId).single(),
  ]);

  const balances = (balancesRes.data ?? []) as BalanceRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const classes = (classesRes.data ?? []) as ClassRow[];
  const studentClasses = typedSchoolStudents as StudentClassRow[];
  const schoolData = schoolRes.data as { name: string } | null;
  const schoolName = schoolData?.name ?? "School";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Reports
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {schoolName} — Generate and export school reports
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

      <main className="mx-auto max-w-7xl px-6 py-10">
        <ReportsClient
          balances={balances}
          payments={payments}
          classes={classes}
          studentClasses={studentClasses}
          schoolName={schoolName}
        />
      </main>
    </div>
  );
}

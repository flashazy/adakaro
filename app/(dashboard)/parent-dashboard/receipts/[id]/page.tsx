import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "../../../dashboard/receipts/[id]/print-button";
import Link from "next/link";
import {
  DEFAULT_SCHOOL_CURRENCY,
  formatCurrency,
  normalizeSchoolCurrency,
} from "@/lib/currency";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ParentReceiptPage({ params }: PageProps) {
  const { id: paymentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "*, student:students(full_name, admission_number, school_id, class:classes(name)), fee_structure:fee_structures(name)"
    )
    .eq("id", paymentId)
    .single();

  if (!payment) notFound();

  const paymentTyped = payment as {
    amount: number;
    status: string;
    payment_method: string;
    payment_date: string;
    reference_number: string | null;
    notes: string | null;
    student: {
      full_name: string;
      admission_number: string | null;
      school_id: string;
      class: { name: string } | null;
    } | null;
    fee_structure: { name: string } | null;
  };

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("payment_id", paymentId)
    .limit(1)
    .maybeSingle();

  const receiptTyped = receipt as { receipt_number: string; issued_at: string } | null;
  const student = paymentTyped.student;
  const feeStructure = paymentTyped.fee_structure;

  let currencyCode = DEFAULT_SCHOOL_CURRENCY;
  if (student?.school_id) {
    const { data: schoolCur } = await supabase
      .from("schools")
      .select("currency")
      .eq("id", student.school_id)
      .maybeSingle();
    currencyCode = normalizeSchoolCurrency(
      (schoolCur as { currency: string | null } | null)?.currency
    );
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-xl items-center justify-between py-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Payment Receipt
          </h1>
          <Link
            href="/parent-dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl py-10">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Receipt header */}
          <div className="border-b border-slate-200 px-6 py-5 text-center dark:border-zinc-800">
            {receiptTyped && (
              <p className="text-xs font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                {receiptTyped.receipt_number}
              </p>
            )}
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(Number(paymentTyped.amount), currencyCode)}
            </p>
            <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {paymentTyped.status}
            </span>
          </div>

          {/* Details */}
          <div className="divide-y divide-slate-200 px-6 dark:divide-zinc-800">
            <Row label="Student" value={student?.full_name ?? "—"} />
            {student?.admission_number && (
              <Row label="Admission #" value={student.admission_number} />
            )}
            {student?.class && (
              <Row label="Class" value={student.class.name} />
            )}
            <Row label="Fee" value={feeStructure?.name ?? "—"} />
            <Row
              label="Method"
              value={
                paymentTyped.payment_method?.replace("_", " ") ?? "—"
              }
            />
            <Row label="Date" value={paymentTyped.payment_date} />
            {paymentTyped.reference_number && (
              <Row label="Reference" value={paymentTyped.reference_number} />
            )}
            {paymentTyped.notes && <Row label="Notes" value={paymentTyped.notes} />}
            {receiptTyped && (
              <Row
                label="Issued"
                value={new Date(receiptTyped.issued_at).toLocaleString()}
              />
            )}
          </div>

          {/* Print */}
          <div className="px-6 py-5">
            <PrintButton />
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-3">
      <span className="text-sm text-slate-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

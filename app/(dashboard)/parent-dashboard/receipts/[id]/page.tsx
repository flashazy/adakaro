import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getSchoolCurrencyById,
  resolveSchoolDisplay,
} from "@/lib/dashboard/resolve-school-display";
import { PrintButton } from "../../../dashboard/receipts/[id]/print-button";
import Link from "next/link";
import { Building2 } from "lucide-react";
import {
  DEFAULT_SCHOOL_CURRENCY,
  formatCurrency,
  normalizeSchoolCurrency,
} from "@/lib/currency";

function LogoPlaceholder({ schoolName }: { schoolName: string }) {
  const ch = schoolName.trim().charAt(0);
  if (ch && /\S/.test(ch)) {
    return (
      <span
        className="flex h-full w-full items-center justify-center bg-indigo-50 text-xl font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
        aria-hidden
      >
        {ch.toUpperCase()}
      </span>
    );
  }
  return (
    <Building2
      className="h-8 w-8 text-gray-400 dark:text-zinc-500"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id: paymentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: "Payment Receipt" };
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("student_id, student:students(school_id)")
    .eq("id", paymentId)
    .maybeSingle();

  const paymentRow = payment as {
    student_id: string;
    student: { school_id: string } | null;
  } | null;

  if (!paymentRow) {
    return { title: "Payment Receipt" };
  }

  const { data: parentLink } = await supabase
    .from("parent_students")
    .select("id")
    .eq("parent_id", user.id)
    .eq("student_id", paymentRow.student_id)
    .maybeSingle();

  if (!parentLink) {
    return { title: "Payment Receipt" };
  }

  const schoolId = paymentRow.student?.school_id;
  if (!schoolId) {
    return { title: "Payment Receipt" };
  }

  const schoolDisplay = await resolveSchoolDisplay(user.id, supabase);
  let name: string | null =
    schoolDisplay?.schoolId === schoolId
      ? schoolDisplay.name?.trim() || null
      : null;

  if (!name) {
    const { data: schoolRow } = await supabase
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle();
    name = (schoolRow as { name: string } | null)?.name?.trim() || null;
  }

  if (name) {
    return { title: `${name} — Payment Receipt` };
  }
  return { title: "Payment Receipt" };
}

function formatLongDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatPaymentDateDisplay(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function paymentStatusBadgeLabel(status: string): string {
  const s = status.trim().toLowerCase();
  if (
    s === "completed" ||
    s === "paid" ||
    s === "success" ||
    s === "succeeded"
  ) {
    return "Payment Completed";
  }
  return status.replace(/_/g, " ");
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
    student_id: string;
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

  const { data: parentLink } = await supabase
    .from("parent_students")
    .select("id")
    .eq("parent_id", user.id)
    .eq("student_id", paymentTyped.student_id)
    .maybeSingle();

  if (!parentLink) notFound();

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("payment_id", paymentId)
    .limit(1)
    .maybeSingle();

  const receiptTyped = receipt as { receipt_number: string; issued_at: string } | null;
  const student = paymentTyped.student;
  const feeStructure = paymentTyped.fee_structure;

  const schoolDisplay = await resolveSchoolDisplay(user.id, supabase);

  let currencyCode = DEFAULT_SCHOOL_CURRENCY;
  let schoolName = "School";
  let schoolLogoUrl: string | null = null;

  if (student?.school_id) {
    const displayMatches =
      schoolDisplay != null &&
      schoolDisplay.schoolId === student.school_id;

    if (displayMatches) {
      const n = schoolDisplay.name?.trim();
      if (n) schoolName = n;
      schoolLogoUrl = schoolDisplay.logo_url?.trim() || null;
    }

    const { data: schoolRow } = await supabase
      .from("schools")
      .select("currency, name, logo_url")
      .eq("id", student.school_id)
      .maybeSingle();

    const row = schoolRow as {
      currency: string | null;
      name: string | null;
      logo_url: string | null;
    } | null;

    if ((!displayMatches || schoolName === "School") && row?.name?.trim()) {
      schoolName = row.name.trim();
    }
    if (!schoolLogoUrl && row?.logo_url?.trim()) {
      schoolLogoUrl = row.logo_url.trim();
    }

    let raw: string | null = null;
    if (
      displayMatches &&
      schoolDisplay.currency != null &&
      String(schoolDisplay.currency).trim() !== ""
    ) {
      raw = schoolDisplay.currency;
    } else {
      raw = row?.currency ?? null;
    }
    if (raw == null || String(raw).trim() === "") {
      raw = await getSchoolCurrencyById(student.school_id);
    }
    currencyCode = normalizeSchoolCurrency(raw);
  }

  const dateIssuedSource =
    receiptTyped?.issued_at ?? paymentTyped.payment_date;
  const dateIssuedFormatted = formatLongDate(dateIssuedSource);

  const methodDisplay =
    paymentTyped.payment_method?.replace(/_/g, " ") ?? "—";

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 print:hidden">
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

      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:px-0 print:py-4">
        <div
          className="receipt-print relative overflow-hidden rounded-xl border border-gray-200 bg-white font-sans text-gray-900 shadow-[0_10px_25px_rgba(0,0,0,0.05)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 print:overflow-visible print:rounded-lg print:border-gray-200 print:bg-white print:text-black print:shadow-none"
          aria-label="Payment receipt"
        >
          {/* PAID watermark */}
          <div
            className="receipt-print-watermark pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
            aria-hidden
          >
            <span className="-rotate-[25deg] text-[6.5rem] font-black uppercase leading-none tracking-wider text-gray-200/40 sm:text-[7rem] dark:text-zinc-600/25">
              PAID
            </span>
          </div>

          <div className="relative z-10 break-inside-avoid px-5 py-8 sm:px-8 print:px-6 print:py-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
                {schoolLogoUrl ? (
                  <img
                    src={schoolLogoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    width={60}
                    height={60}
                  />
                ) : (
                  <LogoPlaceholder schoolName={schoolName} />
                )}
              </div>
              <h2 className="mt-4 max-w-md text-center text-xl font-bold uppercase leading-snug tracking-tight text-gray-900 dark:text-white">
                {schoolName}
              </h2>
              <p className="mt-2 text-xs font-medium uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                Official Payment Receipt
              </p>
            </div>

            <div className="my-6 border-t border-dashed border-gray-300 dark:border-zinc-600 print:border-gray-300" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 text-left">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                  Receipt Number
                </p>
                {receiptTyped ? (
                  <p className="mt-0.5 font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {receiptTyped.receipt_number}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-gray-400">—</p>
                )}
              </div>
              <div className="min-w-0 text-left sm:text-right">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                  Date Issued
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-zinc-200">
                  {dateIssuedFormatted}
                </p>
              </div>
            </div>

            <div className="my-6 border-t border-dashed border-gray-300 dark:border-zinc-600 print:border-gray-300" />

            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400">
                Total Amount Paid
              </p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(Number(paymentTyped.amount), currencyCode)}
              </p>
              <div className="mt-4 flex justify-center">
                <span className="receipt-print-status inline-flex rounded-full border border-transparent bg-green-100 px-4 py-1 text-xs font-semibold text-green-700 dark:border-green-800/30 dark:bg-green-950/50 dark:text-green-300">
                  {paymentStatusBadgeLabel(paymentTyped.status)}
                </span>
              </div>
            </div>

            <div className="my-6 border-t border-dashed border-gray-300 dark:border-zinc-600 print:border-gray-300" />

            <div className="space-y-0">
              <Row
                label="Student Name"
                value={student?.full_name ?? "—"}
              />
              {student?.admission_number ? (
                <Row
                  label="Admission No."
                  value={student.admission_number}
                />
              ) : null}
              {student?.class ? (
                <Row label="Class/Grade" value={student.class.name} />
              ) : null}
              <Row
                label="Fee Description"
                value={feeStructure?.name ?? "—"}
              />
              <Row label="Payment Method" value={methodDisplay} />
              <Row
                label="Payment Date"
                value={formatPaymentDateDisplay(paymentTyped.payment_date)}
              />
              {paymentTyped.reference_number ? (
                <Row
                  label="Reference"
                  value={paymentTyped.reference_number}
                />
              ) : null}
              {paymentTyped.notes ? (
                <Row label="Notes" value={paymentTyped.notes} />
              ) : null}
            </div>

            <p className="mt-8 border-t border-dashed border-gray-300 pt-6 text-center text-[10px] italic leading-relaxed text-gray-400 dark:border-zinc-600 dark:text-zinc-500 print:border-gray-300">
              This is a computer-generated receipt. No signature is required.
              <br />
              Generated via Adakaro Web App.
            </p>

            <div className="mt-6 print:hidden">
              <PrintButton />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="break-inside-avoid flex flex-col gap-0.5 border-b border-gray-100 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 dark:border-zinc-800">
      <span className="shrink-0 text-xs text-gray-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-semibold text-gray-800 dark:text-zinc-100 sm:max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

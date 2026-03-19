"use client";

import { useState, useEffect, useMemo, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { recordPayment, type PaymentActionState } from "./actions";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string | null;
  class: { name: string } | null;
}

interface BalanceRow {
  student_id: string;
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
  payment_method: string;
  payment_date: string;
  reference_number: string | null;
  fee_structure_id: string | null;
  receipt: { id: string; receipt_number: string } | null;
}

interface Props {
  students: StudentOption[];
  balances: BalanceRow[];
  payments: PaymentRow[];
}

// ─── Helpers ─────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "azampay", label: "AzamPay" },
] as const;

// ─── Submit button ───────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Recording…" : "Record payment"}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────

const initialState: PaymentActionState = {};

export function PaymentClient({ students, balances, payments }: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [state, formAction] = useActionState(recordPayment, initialState);

  // Reset fee selection when student changes
  useEffect(() => {
    setSelectedFeeId("");
  }, [selectedStudentId]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.admission_number?.toLowerCase().includes(q) ?? false) ||
        (s.class?.name.toLowerCase().includes(q) ?? false)
    );
  }, [students, studentSearch]);

  // Balances for the selected student with outstanding amounts
  const studentBalances = useMemo(
    () =>
      balances.filter(
        (b) => b.student_id === selectedStudentId && b.balance > 0
      ),
    [balances, selectedStudentId]
  );

  // Recent payments for the selected student
  const studentPayments = useMemo(
    () => payments.filter((p) => p.student_id === selectedStudentId),
    [payments, selectedStudentId]
  );

  // Selected balance row
  const selectedBalance = studentBalances.find(
    (b) => b.fee_structure_id === selectedFeeId
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-8">
      {/* ─── Student selector ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Select a student
        </h2>
        <input
          type="text"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          placeholder="Search by name, admission # or class…"
          className="mt-3 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
        />
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-300 dark:border-zinc-700">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStudentId(s.id)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedStudentId === s.id
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
                    : "text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-zinc-800"
                }`}
              >
                <span>
                  {s.full_name}
                  {s.admission_number ? ` (${s.admission_number})` : ""}
                </span>
                {s.class && (
                  <span className="ml-2 shrink-0 text-xs text-slate-500 dark:text-zinc-400">
                    {s.class.name}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-zinc-400">
              No students found
            </p>
          )}
        </div>
      </div>

      {/* ─── Outstanding fees ─── */}
      {selectedStudentId && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Outstanding fees for {selectedStudent?.full_name}
            </h2>
          </div>

          {studentBalances.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {studentBalances.map((b) => (
                <button
                  key={b.fee_structure_id}
                  type="button"
                  onClick={() => setSelectedFeeId(b.fee_structure_id)}
                  className={`flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800 ${
                    selectedFeeId === b.fee_structure_id
                      ? "bg-indigo-50 dark:bg-indigo-950/20"
                      : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {b.fee_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Total: {formatCurrency(Number(b.total_fee))} · Paid:{" "}
                      {formatCurrency(Number(b.total_paid))}
                      {b.due_date ? ` · Due: ${b.due_date}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {formatCurrency(Number(b.balance))}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              No outstanding fees for this student.
            </p>
          )}
        </div>
      )}

      {/* ─── Payment form ─── */}
      {selectedFeeId && selectedBalance && (
        <form
          action={formAction}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Record payment — {selectedBalance.fee_name}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Balance: {formatCurrency(Number(selectedBalance.balance))}
          </p>

          <input type="hidden" name="student_id" value={selectedStudentId} />
          <input type="hidden" name="fee_structure_id" value={selectedFeeId} />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                max={Number(selectedBalance.balance)}
                defaultValue={Number(selectedBalance.balance)}
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="payment_method"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Payment method <span className="text-red-500">*</span>
              </label>
              <select
                id="payment_method"
                name="payment_method"
                required
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reference_number"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Reference number
              </label>
              <input
                id="reference_number"
                name="reference_number"
                type="text"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="e.g. MPesa code"
              />
            </div>

            <div>
              <label
                htmlFor="payment_date"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Payment date
              </label>
              <input
                id="payment_date"
                name="payment_date"
                type="date"
                defaultValue={today}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="Optional notes"
              />
            </div>
          </div>

          <div className="mt-5">
            <SubmitButton />
          </div>

          {state.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          {state.success && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {state.success}
              </p>
              {state.paymentId && (
                <Link
                  href={`/dashboard/receipts/${state.paymentId}`}
                  className="mt-1 inline-block text-sm font-medium text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400"
                >
                  View receipt →
                </Link>
              )}
            </div>
          )}
        </form>
      )}

      {/* ─── Recent payments ─── */}
      {selectedStudentId && studentPayments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent payments
            </h2>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {studentPayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {formatCurrency(Number(p.amount))}
                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-zinc-400">
                      {p.payment_method?.replace("_", " ") ?? "N/A"} · {p.payment_date}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {p.reference_number ? `Ref: ${p.reference_number}` : "Payment"}
                  </p>
                </div>
                {p.receipt && (
                  <Link
                    href={`/dashboard/receipts/${p.id}`}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {p.receipt.receipt_number}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

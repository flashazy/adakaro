"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordPayment, type PaymentActionState } from "@/app/(dashboard)/dashboard/payments/actions";
import { formatCurrency } from "@/lib/currency";
import type { StudentFeeBalance } from "@/types/supabase";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "clickpesa", label: "ClickPesa (online)" },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Recording…" : "Record payment"}
    </button>
  );
}

const initialState: PaymentActionState = {};

export interface RecordStudentPaymentModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  /** Same rows as the profile “Current fee balance” list. */
  profileFeeBalances: StudentFeeBalance[];
  currencyCode: string;
}

export function RecordStudentPaymentModal({
  open,
  onClose,
  studentId,
  profileFeeBalances,
  currencyCode,
}: RecordStudentPaymentModalProps) {
  const router = useRouter();
  const money = (n: number) => formatCurrency(n, currencyCode);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [state, formAction] = useActionState(recordPayment, initialState);

  const outstanding = useMemo(
    () => profileFeeBalances.filter((b) => Number(b.balance) > 0),
    [profileFeeBalances]
  );
  const selectedBalance = useMemo(
    () => outstanding.find((b) => b.fee_structure_id === selectedFeeId),
    [outstanding, selectedFeeId]
  );
  const today = new Date().toISOString().split("T")[0] ?? "";
  const successHandled = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    successHandled.current = false;
    if (outstanding.length === 1) {
      setSelectedFeeId(outstanding[0]!.fee_structure_id);
    } else {
      setSelectedFeeId("");
    }
  }, [open, studentId, outstanding]);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  useEffect(() => {
    if (state.success && !successHandled.current) {
      successHandled.current = true;
      toast.success("Payment recorded.");
      router.refresh();
      onClose();
    }
  }, [state.success, onClose, router]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2
            id="record-payment-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Record payment
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Same flow as the admin Record payment page. Receipt is created when
          the payment is saved.
        </p>

        {outstanding.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-zinc-300">
            There is no fee line with an outstanding balance. Record a
            different fee on the main{" "}
            <a
              href="/dashboard/payments"
              className="font-medium text-school-primary hover:opacity-90"
            >
              Record payment
            </a>{" "}
            page if needed, or add fee assignments first.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                Select fee
              </p>
              <div className="mt-1 space-y-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-700">
                {outstanding.map((b) => (
                  <button
                    key={`${b.fee_structure_id}-${b.term}`}
                    type="button"
                    onClick={() => setSelectedFeeId(b.fee_structure_id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      selectedFeeId === b.fee_structure_id
                        ? "bg-[rgb(var(--school-primary-rgb)/0.10)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.14)]"
                        : "text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span>
                      {b.fee_name}
                      <span className="text-slate-500"> · {b.term}</span>
                    </span>
                    <span className="shrink-0 font-mono text-amber-600 dark:text-amber-400">
                      {money(Number(b.balance))}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {selectedFeeId && selectedBalance && (
              <form
                action={formAction}
                className="space-y-4 border-t border-slate-200 pt-4 dark:border-zinc-700"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Record payment — {selectedBalance.fee_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Balance: {money(Number(selectedBalance.balance))}
                </p>

                <input type="hidden" name="student_id" value={studentId} />
                <input
                  type="hidden"
                  name="fee_structure_id"
                  value={selectedFeeId}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="rsp-amount"
                      className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                    >
                      Amount ({currencyCode}) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="rsp-amount"
                      name="amount"
                      type="number"
                      min="1"
                      step="0.01"
                      max={Number(selectedBalance.balance)}
                      defaultValue={Number(selectedBalance.balance)}
                      required
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rsp-method"
                      className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                    >
                      Payment method <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="rsp-method"
                      name="payment_method"
                      required
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
                      htmlFor="rsp-ref"
                      className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                    >
                      Reference number
                    </label>
                    <input
                      id="rsp-ref"
                      name="reference_number"
                      type="text"
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      placeholder="e.g. MPesa code"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rsp-date"
                      className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                    >
                      Payment date
                    </label>
                    <input
                      id="rsp-date"
                      name="payment_date"
                      type="date"
                      defaultValue={today}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="rsp-notes"
                      className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                    >
                      Notes
                    </label>
                    <textarea
                      id="rsp-notes"
                      name="notes"
                      rows={2}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      placeholder="Optional notes"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <SubmitButton />
                </div>
              </form>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

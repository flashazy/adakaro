"use client";

import { useActionState } from "react";
import { initiateAzamPayPayment } from "./azampay-actions";

interface PayOnlineModalProps {
  studentId: string;
  feeStructureId: string;
  feeName: string;
  amount: number;
  onClose: () => void;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PayOnlineModal({
  studentId,
  feeStructureId,
  feeName,
  amount,
  onClose,
}: PayOnlineModalProps) {
  const [state, formAction, isPending] = useActionState(initiateAzamPayPayment, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Pay online
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form action={formAction} className="p-6">
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="fee_structure_id" value={feeStructureId} />
          <input type="hidden" name="amount" value={amount} />
          <p className="mb-4 text-sm text-slate-600 dark:text-zinc-400">
            Pay <strong>{formatCurrency(amount)}</strong> for <strong>{feeName}</strong> via mobile money.
          </p>

          <label htmlFor="mobile" className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
            Mobile number
          </label>
          <input
            id="mobile"
            type="tel"
            name="mobile_number"
            placeholder="e.g. 255712345678"
            className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            required
            disabled={isPending}
            autoComplete="tel"
          />

          {state?.error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              {state.success}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? "Initiating…" : "Pay now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

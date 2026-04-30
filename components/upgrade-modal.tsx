"use client";

import Link from "next/link";
import type { PlanId } from "@/lib/plans";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Kept in the prop signature for backwards compatibility with existing
   * call sites (student import / advanced reports). The new UI no longer
   * shows tier-specific copy — every paid plan unlocks every feature, so
   * the modal just nudges the school admin toward upgrading to "Paid".
   */
  requiredPlan?: PlanId;
  featureName: string;
}

export function UpgradeModal({
  open,
  onClose,
  featureName,
}: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2
          id="upgrade-modal-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Upgrade to Paid
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          {featureName} is a paid feature. Free schools are limited to 20
          students; upgrading to <strong>Paid</strong> unlocks unlimited
          students, unlimited admins, and every feature.
        </p>

        <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-700 dark:text-zinc-300">Free</span>
            <span className="text-right font-medium text-slate-900 dark:text-white">
              Up to 20 students
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-slate-200 pt-2 dark:border-zinc-800">
            <span className="text-slate-700 dark:text-zinc-300">Paid</span>
            <span className="text-right font-medium text-slate-900 dark:text-white">
              Unlimited + every feature
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/pricing"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white hover:brightness-90 sm:flex-none"
            onClick={onClose}
          >
            View pricing
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

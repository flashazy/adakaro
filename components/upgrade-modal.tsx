"use client";

import Link from "next/link";
import { PLANS, planDisplayName, type PlanId } from "@/lib/plans";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  requiredPlan: PlanId;
  featureName: string;
}

const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];

export function UpgradeModal({
  open,
  onClose,
  requiredPlan,
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
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2
          id="upgrade-modal-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Upgrade to {planDisplayName(requiredPlan)}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
          {featureName} is available on the{" "}
          <strong className="text-slate-800 dark:text-zinc-200">
            {planDisplayName(requiredPlan)}
          </strong>{" "}
          plan or higher. Compare plans and upgrade when you are ready.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
          <table className="w-full min-w-[280px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                  Plan
                </th>
                <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                  Students
                </th>
                <th className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-300">
                  Admins
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {PLAN_ORDER.map((id) => {
                const p = PLANS[id];
                const highlight =
                  id === requiredPlan ? "bg-[rgb(var(--school-primary-rgb)/0.10)]/80 dark:bg-[rgb(var(--school-primary-rgb)/0.14)]" : "";
                return (
                  <tr key={id} className={highlight}>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                      {p.name}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                      {p.studentLimit == null ? "Unlimited" : p.studentLimit}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                      {p.adminLimit == null ? "Custom" : p.adminLimit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

import Link from "next/link";
import { Shield } from "lucide-react";

/** Finance dashboard entry to report card access rules (permission checked by parent page). */
export function FinanceToolsLink() {
  return (
    <Link
      href="/dashboard/fee-rules"
      className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[rgb(var(--school-primary-rgb)/0.35)] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-[rgb(var(--school-primary-rgb)/0.45)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--school-primary-rgb)/0.10)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.14)]">
        <Shield className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-school-primary dark:text-white dark:group-hover:text-school-primary">
          Report Card Access Rules
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          Control when parents can open report cards based on fee payment.
        </p>
      </div>
    </Link>
  );
}

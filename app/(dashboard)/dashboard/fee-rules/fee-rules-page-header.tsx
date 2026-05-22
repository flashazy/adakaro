import { CircleCheck, FileText, Shield } from "lucide-react";
import { BackButton } from "@/components/dashboard/back-button";
import { cn } from "@/lib/utils";
import { deriveFinanceRulesStatus } from "@/lib/report-card-fee/fee-rules-ui";
import { FinanceRulesStatusBadge } from "./fee-rules-command-center";
import type { FeeRulesClassRow } from "./fee-rules-client";

const TRUST_CHIPS = [
  { label: "Parent only", icon: Shield },
  { label: "Staff not blocked", icon: FileText },
  { label: "Auto fee checks", icon: CircleCheck },
] as const;

export function FeeRulesPageHeader({
  classes,
  rulesError,
  backHref = "/dashboard",
}: {
  classes: FeeRulesClassRow[];
  rulesError: string | null;
  backHref?: string;
}) {
  const financeStatus = deriveFinanceRulesStatus(classes);

  return (
    <div className="space-y-3">
      <BackButton
        href={backHref}
        className={cn(
          "inline-flex min-h-[44px] items-center text-xs font-medium text-slate-500 transition-colors",
          "hover:text-slate-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary/40 focus-visible:ring-offset-2",
          "dark:text-zinc-500 dark:hover:text-zinc-300 dark:focus-visible:ring-offset-zinc-950",
          "sm:min-h-0"
        )}
      >
        ← Back
      </BackButton>

      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Report Card Access Rules
          </h1>
          <FinanceRulesStatusBadge status={financeStatus} />
        </div>

        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          Set when parents can open report cards based on school fee payment.
        </p>

        <ul className="flex flex-wrap gap-2" aria-label="How these rules work">
          {TRUST_CHIPS.map(({ label, icon: Icon }) => (
            <li key={label}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1",
                  "text-[11px] font-medium text-slate-600 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:text-zinc-400"
                )}
              >
                <Icon
                  className="h-3 w-3 shrink-0 text-slate-400 dark:text-zinc-500"
                  aria-hidden
                />
                {label}
              </span>
            </li>
          ))}
        </ul>

        {rulesError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            Could not load saved rules: {rulesError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Layers, TableProperties } from "lucide-react";

function StatChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-[rgb(var(--school-primary-rgb)/0.10)] px-2.5 py-1 text-xs font-semibold text-school-primary ring-1 ring-inset ring-[rgb(var(--school-primary-rgb)/0.18)] dark:bg-[rgb(var(--school-primary-rgb)/0.14)] dark:ring-[rgb(var(--school-primary-rgb)/0.22)]">
      {children}
    </span>
  );
}

function FeeManagementCard({
  href,
  title,
  description,
  statChip,
  metaHint,
  buttonLabel,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  statChip?: ReactNode;
  metaHint?: string;
  buttonLabel: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--school-primary-rgb)/0.10)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.14)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
            {statChip}
          </div>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400">
            {description}
          </p>
          {metaHint ? (
            <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
              {metaHint}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        href={href}
        className="mt-4 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.01] hover:shadow-md hover:brightness-105 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
      >
        {buttonLabel}
      </Link>
    </div>
  );
}

interface FinanceFeeManagementProps {
  feeTypesCount?: number;
  feeStructuresCount?: number;
  feeTypesLastUpdated?: string;
  configuredClassesCount?: number;
}

/** Fee Types and Fee Structures entry points from the Finance hub. */
export function FinanceFeeManagement({
  feeTypesCount,
  feeStructuresCount,
  feeTypesLastUpdated,
  configuredClassesCount,
}: FinanceFeeManagementProps = {}) {
  const [mobileOpen, setMobileOpen] = useState(true);

  return (
    <section
      id="finance-fee-management"
      aria-labelledby="finance-fee-management-heading"
      className="rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-zinc-700/80 dark:bg-zinc-900/30"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5 md:pointer-events-none md:cursor-default"
        aria-expanded={mobileOpen}
        aria-controls="finance-fee-management-panel"
        onClick={() => setMobileOpen((o) => !o)}
      >
        <div>
          <h2
            id="finance-fee-management-heading"
            className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg"
          >
            Fee Management
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-zinc-400">
            Set up fee categories and class fee amounts.
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform md:hidden ${mobileOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <div
        id="finance-fee-management-panel"
        className={`border-t border-slate-200/80 px-4 pb-4 pt-4 dark:border-zinc-700/80 sm:px-5 sm:pb-5 ${mobileOpen ? "block" : "hidden"} md:block`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <FeeManagementCard
            href="/dashboard/fee-types"
            title="Fee Types"
            description="Create and organize school fee categories."
            statChip={
              feeTypesCount != null ? (
                <StatChip>
                  {feeTypesCount} {feeTypesCount === 1 ? "Category" : "Categories"}
                </StatChip>
              ) : undefined
            }
            metaHint={feeTypesLastUpdated}
            buttonLabel="Open Fee Types"
            icon={<Layers className="h-5 w-5" aria-hidden />}
          />
          <FeeManagementCard
            href="/dashboard/fee-structures"
            title="Fee Structures"
            description="Configure fee amounts and class fee setup."
            statChip={
              feeStructuresCount != null ? (
                <StatChip>
                  {feeStructuresCount} Active Structures
                </StatChip>
              ) : undefined
            }
            metaHint={
              configuredClassesCount != null
                ? `${configuredClassesCount} configured class${configuredClassesCount === 1 ? "" : "es"}`
                : undefined
            }
            buttonLabel="Open Fee Structures"
            icon={<TableProperties className="h-5 w-5" aria-hidden />}
          />
        </div>
      </div>
    </section>
  );
}

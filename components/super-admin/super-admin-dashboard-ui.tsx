"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Premium KPI card shell */
export const saKpiCard =
  "rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md";
export const saKpiCardHighlighted =
  "rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-md transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lg";
export const saKpiLabel = "text-sm font-medium text-slate-500";
export const saKpiValue =
  "mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-slate-950";
export const saKpiValueHighlighted =
  "mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-slate-950";
export const saKpiCaption = "mt-1.5 text-xs text-slate-500";

/** Section panel */
export const saSection =
  "rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm";

export const saSectionTitle =
  "text-lg font-semibold tracking-tight text-slate-900";

export const saSectionSubtitle = "mt-1 text-sm text-slate-500";

/** Buttons */
export const saBtnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50";

export const saBtnPrimarySm =
  "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50";

export const saBtnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50";

export const saBtnSecondarySm =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50";

export const saBtnActionMenu =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow disabled:opacity-50";

export const saBtnArchiveOutline =
  "inline-flex items-center justify-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm transition-colors hover:bg-amber-50 disabled:opacity-50";

export const saBtnDangerOutline =
  "inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50";

export const saInput =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";

/** Schools Directory unified toolbar */
export const saDirectoryToolbar =
  "flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm";

export const saSearchInput =
  "w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export const saFilterTabActive =
  "scale-[1.02] bg-indigo-600 text-white shadow-md";

export const saFilterTabInactive =
  "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

export const saChipCalm =
  "inline-flex h-5 items-center rounded-full px-2.5 text-[11px] font-medium ring-1 ring-inset";

/** Interactive list / table card hover */
export const saInteractiveCard =
  "transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md";

export const saTableHeadRow =
  "border-b border-slate-300 bg-slate-200/90 shadow-sm";

export const saTableHeadCell =
  "px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-800";

export const saTableRowHover =
  "cursor-pointer transition-all duration-200 hover:bg-indigo-50/50 hover:shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const saStatusBadge =
  "inline-flex h-5 items-center rounded-full px-2.5 text-[11px] font-semibold ring-1 ring-inset";

/** Shared mobile KPI shell — identical sizing for standard + highlighted cards. */
const saMobileKpiShell =
  "flex h-full min-h-0 flex-col max-md:h-[4.5rem] max-md:rounded-lg max-md:border max-md:border-slate-200 max-md:bg-white max-md:px-2.5 max-md:py-2.5 max-md:shadow-sm max-md:hover:translate-y-0 max-md:hover:shadow-sm";

const saMobileKpiLabel =
  "max-md:min-h-[1.625rem] max-md:text-[11px] max-md:font-medium max-md:leading-tight max-md:text-slate-400";

const saMobileKpiValue =
  "max-md:mt-auto max-md:text-3xl max-md:font-extrabold max-md:leading-none max-md:text-slate-950";

/** Executive section anchor spacing + typography (mobile). */
export const saMobileSectionLead = "max-md:mt-8";
export const saMobileSectionLeadFirst = "max-md:mt-6";
export const saMobileSectionContentGap = "max-md:mt-2";
export const saMobileExecutiveTitle =
  "max-md:font-bold max-md:tracking-tight max-md:text-slate-950";

export const saMobileSectionAnchor = cn(
  "max-md:mb-1 max-md:text-[10px] max-md:font-bold max-md:tracking-[0.2em] max-md:text-slate-600"
);

const saMobileKpiValueEmphasis =
  "max-md:!text-[1.75rem] max-md:!font-black max-md:!text-slate-950";

export function SaKpiCard({
  label,
  value,
  className,
  emphasizeMobile = false,
}: {
  label: string;
  value: string | number;
  className?: string;
  /** Stronger value weight for business-critical metrics on mobile. */
  emphasizeMobile?: boolean;
}) {
  return (
    <div
      className={cn(
        saKpiCard,
        saMobileKpiShell,
        className
      )}
    >
      <p
        className={cn(
          saKpiLabel,
          saMobileKpiLabel,
          emphasizeMobile && "max-md:font-semibold max-md:text-slate-500"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          saKpiValue,
          saMobileKpiValue,
          emphasizeMobile && saMobileKpiValueEmphasis
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function SaKpiCardHighlighted({
  label,
  value,
  caption,
  className,
}: {
  label: string;
  value: string | number;
  caption: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        saKpiCardHighlighted,
        saMobileKpiShell,
        "max-md:shadow-sm",
        className
      )}
    >
      <p className={cn(saKpiLabel, saMobileKpiLabel)}>{label}</p>
      <p
        className={cn(
          saKpiValueHighlighted,
          saMobileKpiValue,
          "max-md:font-black"
        )}
      >
        {value}
      </p>
      <p className={cn(saKpiCaption, "max-md:hidden")}>{caption}</p>
    </div>
  );
}

export function SaEmptyState({
  message = "No schools currently match this condition.",
  actionLabel,
  onAction,
  className,
}: {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center",
        className
      )}
    >
      <p className="text-sm text-slate-500">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={cn(saBtnSecondarySm, "mt-4")}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function SaTooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  return (
    <span className="group/tooltip relative inline-flex cursor-help">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg group-hover/tooltip:block group-focus-within/tooltip:block"
      >
        {content}
      </span>
    </span>
  );
}

export function SaSectionAnchor({
  label,
  id,
  className,
}: {
  label: string;
  id?: string;
  className?: string;
}) {
  return (
    <p
      id={id}
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500",
        saMobileSectionAnchor,
        className
      )}
    >
      {label}
    </p>
  );
}

function SaExecutiveHeaderChips({
  dateLabel,
  totalSchools,
  paidSchools,
  className,
}: {
  dateLabel: string;
  totalSchools: number;
  paidSchools: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs tabular-nums text-slate-600 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
        {dateLabel}
      </span>
      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
        <span className="text-slate-500">Schools</span>{" "}
        <span className="font-semibold tabular-nums text-slate-900">
          {totalSchools}
        </span>
      </span>
      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
        <span className="text-slate-500">Paid</span>{" "}
        <span className="font-semibold tabular-nums text-slate-900">
          {paidSchools}
        </span>
      </span>
    </div>
  );
}

export function SaExecutiveHeader({
  title,
  subtitle,
  dateLabel,
  totalSchools,
  paidSchools,
  children,
}: {
  title: string;
  subtitle: string;
  dateLabel: string;
  totalSchools: number;
  paidSchools: number;
  children?: ReactNode;
}) {
  return (
    <header className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:rounded-2xl sm:px-5 sm:py-5 lg:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 sm:mt-1.5">
            {subtitle}
          </p>
          {children ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4 sm:gap-3">
              {children}
            </div>
          ) : null}
          <SaExecutiveHeaderChips
            dateLabel={dateLabel}
            totalSchools={totalSchools}
            paidSchools={paidSchools}
            className="mt-3 lg:hidden"
          />
        </div>
        <SaExecutiveHeaderChips
          dateLabel={dateLabel}
          totalSchools={totalSchools}
          paidSchools={paidSchools}
          className="hidden shrink-0 lg:flex lg:justify-end"
        />
      </div>
    </header>
  );
}

export function SaSectionHeader({
  title,
  subtitle,
  className,
  subtitleClassName,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  subtitleClassName?: string;
}) {
  return (
    <div>
      <h2 className={cn(saSectionTitle, className)}>{title}</h2>
      {subtitle ? (
        <p className={cn(saSectionSubtitle, subtitleClassName)}>{subtitle}</p>
      ) : null}
    </div>
  );
}

export function SaRankBadge({ rank }: { rank: number }) {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-200"
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

export function SaHealthScoreCell({
  score,
  label,
  badgeClassName,
  scoreColorClassName,
}: {
  score: number;
  label: string;
  badgeClassName: string;
  scoreColorClassName: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-1 leading-none">
        <span
          className={cn(
            "text-2xl font-bold tabular-nums",
            scoreColorClassName
          )}
        >
          {score}
        </span>
        <span className="pb-0.5 text-[10px] font-normal text-slate-400">/100</span>
      </div>
      <span
        className={cn(
          "inline-flex h-5 w-fit items-center rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset",
          badgeClassName
        )}
      >
        {label}
      </span>
    </div>
  );
}

export {
  SuperAdminCopyButton,
  SuperAdminExportLink,
  SuperAdminLoadingAnchor,
  SuperAdminLoadingButton,
  SuperAdminNavLink,
  SuperAdminSpinner,
  useCopyWithFeedback,
  useExportDownload,
} from "@/components/super-admin/super-admin-loading-action";

export { SuperAdminBackLink } from "@/components/super-admin/super-admin-back-link";

export function SaTopSchoolBadge() {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-amber-300/90 bg-gradient-to-r from-amber-50 to-yellow-50 px-2 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200/80">
      🏆 Top School
    </span>
  );
}

"use client";

import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import { binaryPlanLabel } from "@/lib/plans";
import {
  schoolLifecycleStatusLabel,
} from "@/lib/super-admin/school-lifecycle";
import type { SchoolIntelligenceContextPayload } from "@/lib/super-admin/smart-intelligence-navigation";
import { intelligenceDashboardHref } from "@/lib/super-admin/smart-intelligence-navigation";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

export interface SchoolIntelligenceContextBannerProps {
  schoolName: string;
  context: SchoolIntelligenceContextPayload["school"] | null;
  loading?: boolean;
  onClearFilter?: () => void;
  onChangeSchool?: () => void;
  showIntelligenceReturn?: boolean;
  /** e.g. contacts — shows "Showing contacts for:" under the school name */
  filterMode?: "contacts" | "broadcast" | "default";
  className?: string;
}

export function SchoolIntelligenceContextBanner({
  schoolName,
  context,
  loading = false,
  onClearFilter,
  onChangeSchool,
  showIntelligenceReturn = false,
  filterMode = "default",
  className,
}: SchoolIntelligenceContextBannerProps) {
  const displayName = context?.name || schoolName || "Selected school";
  const plan = context ? binaryPlanLabel(context.plan) : null;
  const status = context
    ? schoolLifecycleStatusLabel(
        context.status as Parameters<typeof schoolLifecycleStatusLabel>[0]
      )
    : null;
  const students =
    context?.studentCount !== undefined
      ? context.studentCount.toLocaleString()
      : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-50/50 via-white to-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            School context
          </p>
          <div className="mt-2 flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
                {loading && !displayName ? "Loading school…" : displayName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filterMode === "contacts" ? (
                  <>
                    Showing contacts for:{" "}
                    <span className="font-medium text-slate-700">{displayName}</span>
                  </>
                ) : filterMode === "broadcast" ? (
                  <>
                    Preparing follow-up for:{" "}
                    <span className="font-medium text-slate-700">{displayName}</span>
                  </>
                ) : showIntelligenceReturn ? (
                  "Opened from Smart Intelligence — context is preserved for this workflow."
                ) : (
                  "Showing records for this school only."
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {plan ? (
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {plan} Plan
                  </span>
                ) : null}
                {status ? (
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {status}
                  </span>
                ) : null}
                {students !== null ? (
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {students} Students
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:shrink-0">
          {showIntelligenceReturn ? (
            <SuperAdminNavLink
              href={intelligenceDashboardHref()}
              loadingLabel="Returning…"
              className={cn(saBtnSecondarySm, "bg-white")}
            >
              Back to Intelligence
            </SuperAdminNavLink>
          ) : null}
          {onChangeSchool ? (
            <button
              type="button"
              className={cn(saBtnSecondarySm, "bg-white")}
              onClick={onChangeSchool}
            >
              Change school
            </button>
          ) : null}
          {onClearFilter ? (
            <button
              type="button"
              className={cn(saBtnSecondarySm, "bg-white")}
              onClick={onClearFilter}
            >
              Clear filter
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

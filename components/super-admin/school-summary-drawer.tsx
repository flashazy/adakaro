"use client";

import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { binaryPlanLabel } from "@/lib/plans";
import {
  formatSchoolLastActivity,
  schoolHealthBadgeClass,
} from "@/lib/super-admin/school-health";
import { getSchoolRecommendedNextAction } from "@/lib/super-admin/dashboard-insights";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import {
  schoolLifecycleStatusBadgeClass,
  schoolLifecycleStatusLabel,
} from "@/lib/super-admin/school-lifecycle";
import {
  saBtnPrimary,
  saBtnSecondarySm,
  saSection,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";

export interface SchoolSummaryDrawerProps {
  school: SuperAdminSchoolRow | null;
  onClose: () => void;
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function SchoolSummaryDrawer({ school, onClose }: SchoolSummaryDrawerProps) {
  if (!school) return null;

  const nextAction = getSchoolRecommendedNextAction(school);

  return (
    <>
      <button
        type="button"
        aria-label="Close school summary"
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed z-50 flex flex-col bg-white shadow-2xl",
          "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border border-slate-200",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:max-h-none",
          "sm:w-[420px] sm:max-w-md sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="school-summary-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              School summary
            </p>
            <h2
              id="school-summary-title"
              className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
            >
              {school.name}
            </h2>
          </div>
          <button type="button" onClick={onClose} className={saBtnSecondarySm}>
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                schoolLifecycleStatusBadgeClass(school.school_status)
              )}
            >
              {schoolLifecycleStatusLabel(school.school_status)}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                schoolHealthBadgeClass(school.health_category)
              )}
            >
              {school.health_score} / 100 · {school.health_label}
            </span>
          </div>

          <div className={cn(saSection, "px-4 py-1 shadow-none")}>
            <StatRow label="Plan" value={binaryPlanLabel(school.plan)} />
            <div className="border-t border-slate-100">
              <StatRow label="Students" value={school.student_count} />
            </div>
            <div className="border-t border-slate-100">
              <StatRow label="Admins" value={school.admin_count} />
            </div>
            <div className="border-t border-slate-100">
              <StatRow label="Teachers" value={school.teacher_count ?? 0} />
            </div>
            <div className="border-t border-slate-100">
              <StatRow label="Payments" value={school.payment_count ?? 0} />
            </div>
            <div className="border-t border-slate-100">
              <StatRow
                label="Last activity"
                value={formatSchoolLastActivity(school.last_activity_at)}
              />
            </div>
            <div className="border-t border-slate-100">
              <StatRow label="Created" value={formatDate(school.created_at)} />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Recommended next action
            </p>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-900">
              {nextAction}
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
          <Link
            href={`/super-admin/schools/${school.id}`}
            className={cn(saBtnPrimary, "w-full")}
          >
            Open full school page
          </Link>
        </div>
      </aside>
    </>
  );
}

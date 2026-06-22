"use client";

import { cn } from "@/lib/utils";
import type { CopilotSnapshot } from "@/lib/ai/copilot/types";
import { formatSnapshotFees } from "@/lib/ai/copilot/snapshot";

export function CopilotSnapshotCard({
  snapshot,
  onAction,
  disabled = false,
  className,
}: {
  snapshot: CopilotSnapshot | null;
  onAction: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (!snapshot) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 px-4 py-3.5 dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-violet-950/20",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
        Today&apos;s School Snapshot
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
        {snapshot.schoolName}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/70 px-2.5 py-2 dark:bg-zinc-900/60">
          <p className="text-slate-500">Students</p>
          <p className="font-bold tabular-nums text-slate-900 dark:text-white">
            {snapshot.studentCount}
          </p>
        </div>
        <div className="rounded-lg bg-white/70 px-2.5 py-2 dark:bg-zinc-900/60">
          <p className="text-slate-500">Attendance</p>
          <p className="font-bold tabular-nums text-slate-900 dark:text-white">
            {snapshot.attendanceRate}%
          </p>
        </div>
        <div className="col-span-2 rounded-lg bg-white/70 px-2.5 py-2 dark:bg-zinc-900/60">
          <p className="text-slate-500">Outstanding Fees</p>
          <p className="font-bold tabular-nums text-slate-900 dark:text-white">
            {formatSnapshotFees(snapshot.outstandingFees)}
          </p>
        </div>
      </div>

      {snapshot.syllabusAlerts > 0 ? (
        <p className="mt-2.5 text-xs text-amber-800 dark:text-amber-200">
          Alerts: {snapshot.syllabusAlerts} syllabus items need attention.
        </p>
      ) : null}

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Recommended actions
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {snapshot.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            onClick={() => onAction(action.prompt)}
            className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition-all duration-200 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

import { format, parseISO } from "date-fns";
import { ArrowDown, CalendarDays } from "lucide-react";
import type { HistoricalAttendanceClassGroup } from "@/lib/class-attendance/load-historical-attendance-for-class-teacher";
import { cn } from "@/lib/utils";

export type HistoricalAttendanceStatusKey =
  | "present"
  | "absent"
  | "late"
  | "sick"
  | "permitted"
  | "unknown";

const STATUS_BADGE_STYLES: Record<HistoricalAttendanceStatusKey, string> = {
  present:
    "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900",
  absent:
    "bg-red-100 text-red-900 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900",
  late: "bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
  sick: "bg-sky-100 text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
  permitted:
    "bg-violet-100 text-violet-900 ring-1 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900",
  unknown:
    "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
};

export function statusKeyFromLabel(label: string): HistoricalAttendanceStatusKey {
  const normalized = label.trim().toLowerCase();
  if (normalized === "present") return "present";
  if (normalized === "absent") return "absent";
  if (normalized === "late") return "late";
  if (normalized === "sick") return "sick";
  if (normalized === "permitted") return "permitted";
  return "unknown";
}

export function HistoricalAttendanceStatusBadge({ label }: { label: string }) {
  const key = statusKeyFromLabel(label);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_BADGE_STYLES[key]
      )}
    >
      {label}
    </span>
  );
}

export function formatHistoricalAttendanceDate(date: string): string {
  try {
    return format(parseISO(date), "MMM d, yyyy");
  } catch {
    return date;
  }
}

export interface HistoricalAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  sick: number;
  permitted: number;
}

export function computeHistoricalAttendanceSummary(
  groups: HistoricalAttendanceClassGroup[]
): HistoricalAttendanceSummary {
  const summary: HistoricalAttendanceSummary = {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    sick: 0,
    permitted: 0,
  };

  for (const group of groups) {
    for (const entry of group.entries) {
      summary.total += 1;
      const key = statusKeyFromLabel(entry.statusLabel);
      if (key !== "unknown") {
        summary[key] += 1;
      }
    }
  }

  return summary;
}

function SummaryStatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: HistoricalAttendanceStatusKey | "total";
}) {
  const accentRing =
    accent === "total"
      ? "border-slate-200/90 dark:border-zinc-700"
      : accent === "present"
        ? "border-emerald-200/80 dark:border-emerald-900/50"
        : accent === "absent"
          ? "border-red-200/80 dark:border-red-900/50"
          : accent === "late"
            ? "border-amber-200/80 dark:border-amber-900/50"
            : accent === "sick"
              ? "border-sky-200/80 dark:border-sky-900/50"
              : accent === "permitted"
                ? "border-violet-200/80 dark:border-violet-900/50"
                : "border-slate-200/90 dark:border-zinc-700";

  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-3 py-2.5 shadow-sm dark:bg-zinc-900/80",
        accentRing
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export function HistoricalAttendanceSummaryCards({
  summary,
}: {
  summary: HistoricalAttendanceSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-6">
      <SummaryStatCard label="Total records" value={summary.total} accent="total" />
      <SummaryStatCard label="Present" value={summary.present} accent="present" />
      <SummaryStatCard label="Absent" value={summary.absent} accent="absent" />
      <SummaryStatCard label="Late" value={summary.late} accent="late" />
      <SummaryStatCard label="Sick" value={summary.sick} accent="sick" />
      <SummaryStatCard
        label="Permitted"
        value={summary.permitted}
        accent="permitted"
      />
    </div>
  );
}

export function HistoricalAttendanceJourneyTimeline({
  groups,
  currentClassName,
}: {
  groups: HistoricalAttendanceClassGroup[];
  currentClassName: string;
}) {
  if (groups.length === 0) return null;

  const currentLabel = currentClassName.trim() || "Current class";

  return (
    <div
      className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/40"
      aria-label="Class journey"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Class journey
      </p>
      <ol className="mt-2 space-y-1">
        {groups.map((group, index) => (
          <li key={group.classId}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                {group.className}
              </span>
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">
                Previous
              </span>
            </div>
            {index < groups.length - 1 || currentLabel ? (
              <div
                className="flex items-center gap-1 py-1 text-slate-400 dark:text-zinc-500"
                aria-hidden
              >
                <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
            ) : null}
          </li>
        ))}
        <li>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200/90 bg-emerald-50/80 px-2.5 py-1.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              {currentLabel}
            </span>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              Current
            </span>
          </div>
        </li>
      </ol>
    </div>
  );
}

export function HistoricalAttendanceEmptyState({
  message = "This student has no attendance records from previous classes.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800/30">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
        aria-hidden
      >
        <CalendarDays className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="mt-3 max-w-xs text-sm text-slate-600 dark:text-zinc-300">
        {message}
      </p>
    </div>
  );
}

function recordCountLabel(count: number): string {
  return `${count} attendance record${count !== 1 ? "s" : ""}`;
}

export function historicalAttendanceHasNotes(
  groups: HistoricalAttendanceClassGroup[]
): boolean {
  return groups.some((group) =>
    group.entries.some((entry) => Boolean(entry.note?.trim()))
  );
}

export function HistoricalAttendanceNoteSnippet({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-2.5 py-2 dark:border-zinc-700/90 dark:bg-zinc-800/50">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
        Note
      </p>
      <p className="mt-0.5 text-sm leading-snug text-slate-700 dark:text-zinc-300">
        {note}
      </p>
    </div>
  );
}

export function HistoricalAttendanceRichClassGroups({
  groups,
}: {
  groups: HistoricalAttendanceClassGroup[];
}) {
  const showNotesColumn = historicalAttendanceHasNotes(groups);
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <article
          key={group.classId}
          className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
        >
          <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-3 py-3 dark:border-zinc-800 dark:from-zinc-800/80 dark:to-zinc-900/80 sm:px-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {group.className}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              {recordCountLabel(group.entries.length)}
            </p>
          </header>

          <div className="hidden sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  {showNotesColumn ? (
                    <th className="px-4 py-2.5 font-semibold">Note</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {group.entries.map((entry) => (
                  <tr
                    key={`${group.classId}-${entry.attendanceDate}`}
                    className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700 dark:text-zinc-300">
                      {formatHistoricalAttendanceDate(entry.attendanceDate)}
                    </td>
                    <td className="px-4 py-2.5">
                      <HistoricalAttendanceStatusBadge label={entry.statusLabel} />
                    </td>
                    {showNotesColumn ? (
                      <td className="max-w-[14rem] px-4 py-2.5">
                        {entry.note?.trim() ? (
                          <HistoricalAttendanceNoteSnippet note={entry.note} />
                        ) : (
                          <span className="text-sm text-slate-300 dark:text-zinc-600">
                            —
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 sm:hidden dark:divide-zinc-800">
            {group.entries.map((entry) => (
              <li
                key={`${group.classId}-${entry.attendanceDate}-mobile`}
                className="space-y-2 px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                    {formatHistoricalAttendanceDate(entry.attendanceDate)}
                  </span>
                  <HistoricalAttendanceStatusBadge label={entry.statusLabel} />
                </div>
                {entry.note?.trim() ? (
                  <HistoricalAttendanceNoteSnippet note={entry.note} />
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

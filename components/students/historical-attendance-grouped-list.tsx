import type { HistoricalAttendanceClassGroup } from "@/lib/class-attendance/load-historical-attendance-for-class-teacher";
import {
  formatHistoricalAttendanceDate,
  HistoricalAttendanceEmptyState,
  HistoricalAttendanceNoteSnippet,
  HistoricalAttendanceStatusBadge,
} from "@/components/students/historical-attendance-display";

function recordCountLabel(count: number): string {
  return `${count} attendance record${count !== 1 ? "s" : ""}`;
}

export function HistoricalAttendanceGroupedList({
  groups,
}: {
  groups: HistoricalAttendanceClassGroup[];
}) {
  if (groups.length === 0) {
    return <HistoricalAttendanceEmptyState />;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <article
          key={group.classId}
          className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
        >
          <header className="border-b border-slate-100 bg-slate-50/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/80 sm:px-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {group.className}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              {recordCountLabel(group.entries.length)}
            </p>
          </header>
          <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
            {group.entries.map((entry) => (
              <li
                key={`${group.classId}-${entry.attendanceDate}`}
                className="space-y-2 px-3 py-3 sm:px-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm tabular-nums text-slate-700 dark:text-zinc-300">
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

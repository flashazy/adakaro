import { ClipboardList } from "lucide-react";
import { formatHistoricalAttendanceDate } from "@/components/students/historical-attendance-display";
import type { HistoricalClassListClassGroup } from "@/lib/teacher-attendance/load-historical-class-list-for-class-teacher";

function recordCountLabel(count: number): string {
  return `${count} record${count !== 1 ? "s" : ""}`;
}

export function HistoricalClassRecordsEmptyState({
  message = "No previous class records found.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800/30">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
        aria-hidden
      >
        <ClipboardList className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="mt-3 max-w-xs text-sm text-slate-600 dark:text-zinc-300">
        {message}
      </p>
    </div>
  );
}

export function HistoricalClassRecordsGroupedList({
  groups,
}: {
  groups: HistoricalClassListClassGroup[];
}) {
  if (groups.length === 0) {
    return <HistoricalClassRecordsEmptyState />;
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

          <div className="hidden sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Subject</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {group.entries.map((entry, idx) => (
                  <tr
                    key={`${group.classId}-${entry.attendanceDate}-${entry.subjectName}-${idx}`}
                    className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700 dark:text-zinc-300">
                      {formatHistoricalAttendanceDate(entry.attendanceDate)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-zinc-300">
                      {entry.subjectName}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-slate-700 dark:text-zinc-300">
                      {entry.statusLabel}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-zinc-400">
                      {entry.recordedByName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-zinc-800 sm:hidden">
            {group.entries.map((entry, idx) => (
              <li
                key={`${group.classId}-mobile-${entry.attendanceDate}-${idx}`}
                className="space-y-1.5 px-3 py-3 sm:px-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm tabular-nums text-slate-700 dark:text-zinc-300">
                    {formatHistoricalAttendanceDate(entry.attendanceDate)}
                  </span>
                  <span className="text-sm capitalize text-slate-700 dark:text-zinc-300">
                    {entry.statusLabel}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {entry.subjectName}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  Recorded by {entry.recordedByName ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

import { format, parseISO } from "date-fns";
import { ArrowRightLeft } from "lucide-react";
import type { StudentMovementHistoryRow } from "@/lib/student-class-history/load-student-movement-history";
import { formatPaymentRecordedAtInSchoolZone } from "@/lib/school-timezone";

function formatMovedAt(iso: string, timeZone: string): string {
  const formatted = formatPaymentRecordedAtInSchoolZone(iso, timeZone);
  if (formatted !== "—") return formatted;
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}

export function StudentMovementHistoryPanel({
  rows,
  loadError,
  displayTimezone,
}: {
  rows: StudentMovementHistoryRow[];
  loadError: string | null;
  displayTimezone: string;
}) {
  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
      aria-labelledby="student-movement-history-heading"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          aria-hidden
        >
          <ArrowRightLeft className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="student-movement-history-heading"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Class movement history
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
            When and how this student moved between classes or streams. Attendance,
            marks, and report cards stay with the class where they were recorded.
          </p>
        </div>
      </div>

      {loadError ? (
        <p
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          Could not load movement history ({loadError}).
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-zinc-400">
          No class movements recorded for this student yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-700">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-zinc-800/80 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-3 py-2.5">
                  From
                </th>
                <th scope="col" className="px-3 py-2.5">
                  To
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Date moved
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Source
                </th>
                <th scope="col" className="px-3 py-2.5">
                  By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
                    {row.fromClassName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
                    {row.toClassName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-300">
                    {formatMovedAt(row.effectiveAt, displayTimezone)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-zinc-300">
                    {row.sourceLabel}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-zinc-300">
                    {row.actorName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

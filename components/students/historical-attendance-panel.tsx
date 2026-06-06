import { CalendarDays } from "lucide-react";
import { HistoricalAttendanceGroupedList } from "@/components/students/historical-attendance-grouped-list";
import type { HistoricalAttendanceClassGroup } from "@/lib/class-attendance/load-historical-attendance-for-class-teacher";

export function HistoricalAttendancePanel({
  groups,
  loadError,
}: {
  groups: HistoricalAttendanceClassGroup[];
  loadError: string | null;
}) {
  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5"
      aria-labelledby="historical-attendance-heading"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          aria-hidden
        >
          <CalendarDays className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="historical-attendance-heading"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Historical attendance
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
            Official class attendance from previous classes before this student
            moved. Read-only — contact the former class teacher to change past
            records.
          </p>
        </div>
      </div>

      {loadError ? (
        <p
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          Could not load historical attendance ({loadError}).
        </p>
      ) : (
        <div className="mt-4">
          <HistoricalAttendanceGroupedList groups={groups} />
        </div>
      )}
    </section>
  );
}

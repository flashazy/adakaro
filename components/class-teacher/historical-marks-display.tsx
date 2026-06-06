import { format, parseISO } from "date-fns";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  HistoricalMarkEntry,
  HistoricalMarksClassGroup,
} from "@/lib/gradebook/load-historical-marks-for-class-teacher";

export interface HistoricalMarksSummary {
  totalRecords: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  subjectsRepresented: number;
}

export function computeHistoricalMarksSummary(
  groups: HistoricalMarksClassGroup[]
): HistoricalMarksSummary {
  const percents: number[] = [];
  const subjects = new Set<string>();

  for (const group of groups) {
    for (const entry of group.entries) {
      if (entry.scorePercent != null) {
        percents.push(entry.scorePercent);
      }
      if (entry.subject.trim()) {
        subjects.add(entry.subject.trim().toLowerCase());
      }
    }
  }

  const totalRecords = groups.reduce((n, g) => n + g.entries.length, 0);

  if (percents.length === 0) {
    return {
      totalRecords,
      averageScore: null,
      highestScore: null,
      lowestScore: null,
      subjectsRepresented: subjects.size,
    };
  }

  const sum = percents.reduce((a, b) => a + b, 0);
  return {
    totalRecords,
    averageScore: Math.round((sum / percents.length) * 10) / 10,
    highestScore: Math.max(...percents),
    lowestScore: Math.min(...percents),
    subjectsRepresented: subjects.size,
  };
}

function formatRecordedDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

function SummaryStatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export function HistoricalMarksSummaryCards({
  summary,
}: {
  summary: HistoricalMarksSummary;
}) {
  const formatScore = (n: number | null) =>
    n != null ? `${n}%` : "—";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <SummaryStatCard label="Total Records" value={summary.totalRecords} />
      <SummaryStatCard
        label="Average Score"
        value={formatScore(summary.averageScore)}
      />
      <SummaryStatCard
        label="Highest Score"
        value={formatScore(summary.highestScore)}
      />
      <SummaryStatCard
        label="Lowest Score"
        value={formatScore(summary.lowestScore)}
      />
      <SummaryStatCard
        label="Subjects Represented"
        value={summary.subjectsRepresented}
      />
    </div>
  );
}

export function HistoricalMarksEmptyState({
  message = "No previous academic records found.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800/30">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
        aria-hidden
      >
        <GraduationCap className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="mt-3 max-w-xs text-sm text-slate-600 dark:text-zinc-300">
        {message}
      </p>
    </div>
  );
}

function HistoricalMarkCard({ entry }: { entry: HistoricalMarkEntry }) {
  return (
    <li className="space-y-1.5 border-b border-slate-100 px-3 py-3 last:border-b-0 dark:border-zinc-800 sm:px-4">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        {entry.subject}
      </p>
      <p className="text-sm text-slate-700 dark:text-zinc-300">
        {entry.assignmentTitle}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {entry.scoreDisplay ? (
          <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-zinc-200">
            {entry.scoreDisplay}
          </span>
        ) : (
          <span className="text-sm text-slate-500 dark:text-zinc-400">—</span>
        )}
        {entry.gradeLabel ? (
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
              "bg-violet-100 text-violet-900 ring-1 ring-violet-200",
              "dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900"
            )}
          >
            Grade {entry.gradeLabel}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500 dark:text-zinc-500">
        Recorded by {entry.recordedByName ?? "—"} ·{" "}
        {formatRecordedDate(entry.recordedDate)}
      </p>
    </li>
  );
}

function recordCountLabel(count: number): string {
  return `${count} mark${count !== 1 ? "s" : ""}`;
}

export function HistoricalMarksGroupedList({
  groups,
}: {
  groups: HistoricalMarksClassGroup[];
}) {
  if (groups.length === 0) {
    return <HistoricalMarksEmptyState />;
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
          <ul>
            {group.entries.map((entry, idx) => (
              <HistoricalMarkCard
                key={`${group.classId}-${entry.assignmentTitle}-${entry.recordedDate}-${idx}`}
                entry={entry}
              />
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

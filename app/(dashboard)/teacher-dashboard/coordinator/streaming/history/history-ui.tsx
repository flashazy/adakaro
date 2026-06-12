import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import type { StreamingHistoryRow } from "@/lib/student-streaming/types";

export type PlacementType = "Manual Override" | "Recommended" | "Bulk Placement";

export type MovementDirection = "up" | "down" | "unchanged";

export function resolvePlacementType(
  row: StreamingHistoryRow,
  bulkRowIds: Set<string>
): PlacementType {
  if (bulkRowIds.has(row.id)) {
    return "Bulk Placement";
  }
  return row.isManualChange ? "Manual Override" : "Recommended";
}

export function resolveMovementDirection(
  previous: string,
  next: string
): MovementDirection {
  const from = previous.trim();
  const to = next.trim();
  if (!from || !to) return "unchanged";
  if (from.localeCompare(to, undefined, { sensitivity: "base" }) === 0) {
    return "unchanged";
  }
  const comparison = to.localeCompare(from, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (comparison < 0) return "up";
  if (comparison > 0) return "down";
  return "unchanged";
}

export function buildBulkRowIds(rows: StreamingHistoryRow[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const key = [
      row.createdAt,
      row.coordinatorName,
      row.newClassName,
      row.parentClassName,
    ].join("|");
    const ids = groups.get(key) ?? [];
    ids.push(row.id);
    groups.set(key, ids);
  }
  const bulkRowIds = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length >= 2) {
      for (const id of ids) bulkRowIds.add(id);
    }
  }
  return bulkRowIds;
}

/** Desktop table row leading edge — transparent for types without accent. */
export function placementTypeRowLeadingClass(type: PlacementType): string {
  switch (type) {
    case "Recommended":
      return "border-l-[3px] border-l-emerald-400/55 dark:border-l-emerald-500/40";
    case "Manual Override":
      return "border-l-[3px] border-l-violet-400/55 dark:border-l-violet-500/40";
    default:
      return "border-l-[3px] border-l-transparent";
  }
}

export function PlacementTypeBadge({ type }: { type: PlacementType }) {
  const classes =
    type === "Manual Override"
      ? "border-violet-200/80 bg-violet-50/90 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200"
      : type === "Bulk Placement"
        ? "border-slate-200/90 bg-slate-100/90 text-slate-700 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200"
        : "border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight ${classes}`}
    >
      {type}
    </span>
  );
}

function StreamBadge({
  name,
  direction = "neutral",
  emphasized = false,
}: {
  name: string;
  direction?: MovementDirection | "neutral";
  emphasized?: boolean;
}) {
  const directionClass =
    direction === "up"
      ? "border-emerald-200/70 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/35 dark:bg-emerald-950/25 dark:text-emerald-200"
      : direction === "down"
        ? "border-amber-200/70 bg-amber-50/60 text-amber-900 dark:border-amber-900/35 dark:bg-amber-950/25 dark:text-amber-200"
        : "border-slate-200/90 bg-slate-50 text-slate-700 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200";

  const sizeClass = emphasized
    ? "min-h-[1.875rem] px-2.5 py-1 text-xs font-semibold"
    : "min-h-[1.375rem] px-2 py-0.5 text-[11px] font-medium";

  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border leading-tight ${sizeClass} ${directionClass}`}
      title={name}
    >
      {name}
    </span>
  );
}

function HistoryCardField({
  label,
  children,
  tone = "default",
}: {
  label: string;
  children: ReactNode;
  tone?: "default" | "muted";
}) {
  const isMuted = tone === "muted";

  return (
    <div className="space-y-1">
      <p
        className={
          isMuted
            ? "text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-zinc-500"
            : "text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400"
        }
      >
        {label}
      </p>
      <div
        className={
          isMuted
            ? "text-sm text-slate-600 dark:text-zinc-400"
            : "text-sm text-slate-800 dark:text-zinc-200"
        }
      >
        {children}
      </div>
    </div>
  );
}

export function StreamingHistoryRecordCard({
  row,
  placementType,
  dateLine,
  timeLine,
  coordinatorName,
  onViewDetails,
}: {
  row: StreamingHistoryRow;
  placementType: PlacementType;
  dateLine: string;
  timeLine: string;
  coordinatorName: string;
  onViewDetails: () => void;
}) {
  const assessmentLabel = row.academicYear
    ? `${row.examLabel} ${row.academicYear}`
    : row.examLabel;

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/50">
      <header>
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-50">
          {row.studentName}
        </h3>
        {row.admissionNumber ? (
          <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-zinc-400">
            {row.admissionNumber}
          </p>
        ) : null}
      </header>

      <div className="mt-3 space-y-2.5">
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3.5 dark:border-zinc-700/70 dark:bg-zinc-800/35">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Movement
          </p>
          <div className="overflow-x-auto">
            <MovementCell
              previous={row.previousClassName}
              next={row.newClassName}
              emphasized
            />
          </div>
        </div>

        <HistoryCardField label="Placement Type">
          <PlacementTypeBadge type={placementType} />
        </HistoryCardField>
      </div>

      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-zinc-800">
        <HistoryCardField label="Score">
          <span className="font-medium tabular-nums text-slate-900 dark:text-zinc-100">
            {row.performanceValue}
          </span>
        </HistoryCardField>

        <HistoryCardField label="Assessment" tone="muted">
          <span>{assessmentLabel}</span>
        </HistoryCardField>

        <HistoryCardField label="Coordinator" tone="muted">
          <span>{coordinatorName}</span>
        </HistoryCardField>

        <HistoryCardField label="Date" tone="muted">
          <span className="tabular-nums">
            {dateLine} • {timeLine}
          </span>
        </HistoryCardField>
      </div>

      <button
        type="button"
        onClick={onViewDetails}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        aria-label={`View details for ${row.studentName}`}
      >
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        View Details
      </button>
    </article>
  );
}

export function MovementCell({
  previous,
  next,
  emphasized = false,
  spacious = false,
}: {
  previous: string;
  next: string;
  emphasized?: boolean;
  /** Desktop table: wider badge spacing without larger badges. */
  spacious?: boolean;
}) {
  const direction = resolveMovementDirection(previous, next);
  const directionLabel =
    direction === "up"
      ? "Moved to a higher stream"
      : direction === "down"
        ? "Moved to a lower stream"
        : "No stream change";

  const gapClass = emphasized ? "gap-2.5" : spacious ? "gap-3" : "gap-2";

  return (
    <div
      className={`inline-flex w-max items-center whitespace-nowrap ${gapClass}`}
      title={directionLabel}
    >
      <StreamBadge
        name={previous}
        direction="neutral"
        emphasized={emphasized}
      />
      <span
        className={`inline-flex shrink-0 items-center justify-center ${
          emphasized
            ? "text-base text-slate-400 dark:text-zinc-500"
            : spacious
              ? "min-w-[1.125rem] px-0.5 text-sm font-medium text-slate-500 dark:text-zinc-400"
              : "text-sm text-slate-400 dark:text-zinc-500"
        }`}
        aria-hidden
      >
        →
      </span>
      <StreamBadge name={next} direction={direction} emphasized={emphasized} />
    </div>
  );
}

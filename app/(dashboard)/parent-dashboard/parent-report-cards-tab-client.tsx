"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ReportCardPreview } from "@/app/(dashboard)/teacher-dashboard/report-cards/components/ReportCardPreview";
import type { ChildTabData } from "./parent-child-tab-data";
import { sortParentReportCardsByRecency } from "@/lib/parent-report-card-order";

type Row = ChildTabData["reportCards"][number];

function formatReportCardOptionLabel(r: Row): string {
  const t = r.term.trim();
  const y = r.academic_year.trim();
  const base = `${t} ${y}`.replace(/\s+/g, " ").trim();
  return r.status === "pending_review" ? `${base} (pending review)` : base;
}

export function ParentReportCardsTabClient({ rows }: { rows: Row[] }) {
  const idBase = useId();
  const sortedRows = useMemo(
    () => sortParentReportCardsByRecency([...rows]),
    [rows]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (sortedRows.length === 0) return;
    setSelectedId((prev) => {
      if (prev && sortedRows.some((r) => r.id === prev)) return prev;
      return sortedRows[0]!.id;
    });
  }, [sortedRows]);

  const selected = useMemo(
    () => sortedRows.find((r) => r.id === selectedId) ?? sortedRows[0],
    [sortedRows, selectedId]
  );

  if (sortedRows.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No report card available
        </p>
      </div>
    );
  }

  const showInteractiveDropdown = sortedRows.length > 1;

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <label
          htmlFor={`${idBase}-rc`}
          className="shrink-0 text-sm font-medium text-slate-600 dark:text-zinc-300"
        >
          Term / year
        </label>
        {showInteractiveDropdown ? (
          <select
            id={`${idBase}-rc`}
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            aria-label="Select report card term and year"
          >
            {sortedRows.map((r) => (
              <option key={r.id} value={r.id}>
                {formatReportCardOptionLabel(r)}
              </option>
            ))}
          </select>
        ) : (
          <select
            id={`${idBase}-rc`}
            value={selected?.id ?? ""}
            disabled
            className="w-full max-w-md cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 opacity-90 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
            aria-label="Report card term and year"
          >
            <option value={selected?.id ?? ""}>
              {formatReportCardOptionLabel(selected!)}
            </option>
          </select>
        )}
      </div>
      {selected ? (
        <div className="max-h-[70vh] overflow-y-auto md:max-h-[min(500px,60vh)]">
          <ReportCardPreview
            key={selected.id}
            data={selected.previewData}
            viewer="parent"
            reportCardStatus={selected.status}
          />
        </div>
      ) : null}
    </div>
  );
}

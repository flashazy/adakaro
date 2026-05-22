"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ReportCardPreview } from "@/app/(dashboard)/teacher-dashboard/report-cards/components/ReportCardPreview";
import type { ChildTabData } from "./parent-child-tab-data";
import { sortParentReportCardsByRecency } from "@/lib/parent-report-card-order";
import { PARENT_NO_REPORT_CARDS_AVAILABLE } from "@/lib/parent-academic-from-enrollment";
import { ParentReportCardFeeLocked } from "@/components/parent/parent-report-card-fee-locked";
import type { ParentReportEligibilityResult } from "@/lib/report-card-fee/types";
import type { ParentReportCardsLoadDebug } from "@/lib/parent-report-cards-load";

type Row = ChildTabData["reportCards"][number];

function formatReportCardOptionLabel(r: Row): string {
  const t = r.term.trim();
  const y = r.academic_year.trim();
  return `${t} ${y}`.replace(/\s+/g, " ").trim();
}

function ParentReportCardsDebugPanel({
  debug,
}: {
  debug: ParentReportCardsLoadDebug | null;
}) {
  if (!debug) return null;
  return (
    <details className="mx-4 mb-4 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-left dark:border-amber-900/50 dark:bg-amber-950/30">
      <summary className="cursor-pointer text-xs font-semibold text-amber-900 dark:text-amber-100">
        Report cards debug
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-amber-950 dark:text-amber-100">
        {JSON.stringify(debug, null, 2)}
      </pre>
    </details>
  );
}

export function ParentReportCardsTabClient({
  rows,
  loadDebug,
}: {
  rows: Row[];
  loadDebug: ParentReportCardsLoadDebug | null;
}) {
  const idBase = useId();
  const sortedRows = useMemo(
    () => sortParentReportCardsByRecency([...rows]),
    [rows]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loadDebug) return;
    console.log("[parent-dashboard/report-cards] tab", {
      displayRowCount: sortedRows.length,
      loadDebug,
    });
  }, [sortedRows.length, loadDebug]);

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
      <div className="space-y-2 py-6">
        <p className="px-6 text-center text-sm text-slate-500 dark:text-zinc-400">
          {PARENT_NO_REPORT_CARDS_AVAILABLE}
        </p>
        <ParentReportCardsDebugPanel debug={loadDebug} />
      </div>
    );
  }

  const showInteractiveDropdown = sortedRows.length > 1;

  return (
    <div className="space-y-4 px-4 py-4">
      {process.env.NODE_ENV !== "production" ? (
        <ParentReportCardsDebugPanel debug={loadDebug} />
      ) : null}
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
          {(selected as { feeBlocked?: boolean }).feeBlocked &&
          (selected as { feeEligibility?: ParentReportEligibilityResult })
            .feeEligibility ? (
            <ParentReportCardFeeLocked
              eligibility={
                (selected as { feeEligibility: ParentReportEligibilityResult })
                  .feeEligibility
              }
            />
          ) : selected.previewData ? (
            <ReportCardPreview
              key={selected.id}
              data={selected.previewData}
              viewer="parent"
              reportCardStatus={selected.status}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

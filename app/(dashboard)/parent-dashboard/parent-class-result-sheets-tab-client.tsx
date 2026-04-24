"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { ClassResultSheetPdfInput } from "@/lib/class-result-sheet-noticeboard-tables";
import { classResultSheetToNoticeboardView } from "@/lib/class-result-sheet-noticeboard-tables";

type Row = {
  id: string;
  label: string;
  term: string;
  academicYear: string;
  sheet: ClassResultSheetPdfInput;
};

function NoData() {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm text-slate-500 dark:text-zinc-400">
        No class result sheet yet. When report cards for this class are released
        to parents (approved), the full class sheet will appear here (same as the
        noticeboard printout).
      </p>
    </div>
  );
}

export function ParentClassResultSheetsTabClient({ rows }: { rows: Row[] }) {
  const idBase = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordered = rows;

  useEffect(() => {
    if (ordered.length === 0) return;
    setSelectedId((prev) => {
      if (prev && ordered.some((r) => r.id === prev)) return prev;
      return ordered[0]!.id;
    });
  }, [ordered]);

  const selected = useMemo(
    () => ordered.find((r) => r.id === selectedId) ?? ordered[0],
    [ordered, selectedId]
  );

  if (ordered.length === 0) return <NoData />;

  const view = useMemo(
    () => (selected ? classResultSheetToNoticeboardView(selected.sheet) : null),
    [selected]
  );

  const showInteractive = ordered.length > 1;

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <label
          htmlFor={`${idBase}-crs`}
          className="shrink-0 text-sm font-medium text-slate-600 dark:text-zinc-300"
        >
          Result period
        </label>
        {showInteractive ? (
          <select
            id={`${idBase}-crs`}
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            aria-label="Select class result period"
          >
            {ordered.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            id={`${idBase}-crs`}
            value={selected?.id ?? ""}
            disabled
            className="w-full max-w-md cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 opacity-90 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
            aria-label="Class result period"
          >
            <option value={selected?.id ?? ""}>{selected?.label}</option>
          </select>
        )}
      </div>

      {view ? (
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-lg border border-slate-200 bg-[rgb(214,234,253)]/40 dark:border-zinc-700 dark:bg-zinc-900/50 md:max-h-[min(500px,60vh)]">
          <div className="min-w-[min(100%,48rem)] p-4 text-sm text-slate-900 dark:text-zinc-100">
            <header className="border-b border-slate-200/80 pb-3 text-center dark:border-zinc-700">
              <h2 className="text-base font-bold tracking-tight">
                {view.schoolName}
              </h2>
              {view.schoolMotto ? (
                <p className="mt-0.5 text-xs italic text-slate-600 dark:text-zinc-400">
                  {view.schoolMotto}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-bold uppercase text-slate-800 dark:text-zinc-100">
                {view.examTitle}
              </p>
              {view.coordinatorName ? (
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                  Class coordinator: {view.coordinatorName}
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                {view.termDisplayLabel}
              </p>
            </header>

            {view.level === "secondary" ? (
              <>
                <h3
                  className="mt-4 text-xs font-bold uppercase tracking-wide"
                  style={{ color: "rgb(88, 28, 135)" }}
                >
                  Division performance summary
                </h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse border border-slate-300 bg-[rgb(255,251,245)] text-xs dark:border-zinc-600">
                    <thead>
                      <tr>
                        {view.division.head.map((c) => (
                          <th
                            key={c}
                            className="border border-slate-300 px-1.5 py-1.5 text-left font-bold dark:border-zinc-600"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {view.division.body.map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td
                              key={j}
                              className="border border-slate-300 px-1.5 py-1.5 tabular-nums dark:border-zinc-600"
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3
                  className="mt-4 text-xs font-bold uppercase tracking-wide"
                  style={{ color: "rgb(88, 28, 135)" }}
                >
                  Main results
                </h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[36rem] border-collapse border border-slate-300 bg-[rgb(255,251,245)] text-[11px] leading-snug dark:border-zinc-600">
                    <thead>
                      <tr>
                        {view.main.head.map((c) => (
                          <th
                            key={c}
                            className="border border-slate-300 px-1 py-1.5 text-left font-bold dark:border-zinc-600"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {view.main.body.map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td
                              key={j}
                              className="max-w-[20rem] border border-slate-300 px-1 py-1.5 align-top break-words dark:border-zinc-600"
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <h3
                  className="mt-4 text-xs font-bold uppercase tracking-wide"
                  style={{ color: "rgb(88, 28, 135)" }}
                >
                  Overall passing grades summary
                </h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[24rem] border-collapse border border-slate-300 bg-[rgb(255,251,245)] text-xs dark:border-zinc-600">
                    <thead>
                      <tr>
                        {view.overallGrades.head.map((c) => (
                          <th
                            key={c}
                            className="border border-slate-300 px-1.5 py-1.5 text-left font-bold dark:border-zinc-600"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {view.overallGrades.body.map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td
                              key={j}
                              className="border border-slate-300 px-1.5 py-1.5 text-center tabular-nums dark:border-zinc-600"
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3
                  className="mt-4 text-xs font-bold uppercase tracking-wide"
                  style={{ color: "rgb(88, 28, 135)" }}
                >
                  Main results
                </h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse border border-slate-300 bg-[rgb(255,251,245)] text-[11px] leading-snug dark:border-zinc-600">
                    <thead>
                      <tr>
                        {view.main.head.map((c) => (
                          <th
                            key={c}
                            className="border border-slate-300 px-1 py-1.5 text-left font-bold dark:border-zinc-600"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {view.main.body.map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td
                              key={j}
                              className="max-w-[24rem] border border-slate-300 px-1 py-1.5 align-top break-words dark:border-zinc-600"
                            >
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 space-y-1 border-t border-slate-200/80 pt-3 text-xs text-slate-600 dark:border-zinc-700 dark:text-zinc-400">
              {view.footnotes.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { passingThresholdPercent } from "@/lib/tanzania-grades";
import type { ParentMajorExamClassResultsPayload } from "@/lib/parent-major-exam-class-results-types";
import type { PassRateStats, FailRateStats } from "@/lib/gradebook-full-report-compute";
import type { SchoolLevel } from "@/lib/school-level";

function PassRateBlock({
  seg,
  schoolLevel,
}: {
  seg: PassRateStats;
  schoolLevel: SchoolLevel;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950/50">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
        Passing students
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
        Score ≥ {passingThresholdPercent(schoolLevel)}%
      </p>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-800 dark:text-zinc-200">
        <p>
          <span className="font-medium">Pass rate:</span> {seg.passRateLine}
        </p>
        <p>
          <span className="font-medium">Boys pass rate:</span> {seg.boysLine}
        </p>
        <p>
          <span className="font-medium">Girls pass rate:</span> {seg.girlsLine}
        </p>
      </div>
    </div>
  );
}

function FailRateBlock({
  seg,
  schoolLevel,
}: {
  seg: FailRateStats;
  schoolLevel: SchoolLevel;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-600 dark:bg-zinc-950/50">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
        Failing students
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
        Score &lt; {passingThresholdPercent(schoolLevel)}%
      </p>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-800 dark:text-zinc-200">
        <p>
          <span className="font-medium">Fail rate:</span> {seg.failRateLine}
        </p>
        <p>
          <span className="font-medium">Boys fail rate:</span> {seg.boysLine}
        </p>
        <p>
          <span className="font-medium">Girls fail rate:</span> {seg.girlsLine}
        </p>
      </div>
    </div>
  );
}

export function ParentClassResultsTabClient({
  payload,
}: {
  payload: ParentMajorExamClassResultsPayload;
}) {
  const idBase = useId();
  const { options, defaultOptionId } = payload;
  const [selectedId, setSelectedId] = useState<string>(defaultOptionId);

  useEffect(() => {
    if (options.length === 0) return;
    setSelectedId((prev) => {
      if (prev && options.some((o) => o.id === prev)) return prev;
      return defaultOptionId || options[0]!.id;
    });
  }, [options, defaultOptionId]);

  const selected = useMemo(
    () => options.find((o) => o.id === selectedId) ?? options[0],
    [options, selectedId]
  );

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
        new Date()
      ),
    []
  );

  if (options.length === 0 || !selected) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No major exam marks yet. When teachers enter April / June / September
          / December exam scores in Marks, class statistics will appear here.
        </p>
      </div>
    );
  }

  const showDropdown = options.length > 1;
  const sl = selected.schoolLevel;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <label
          htmlFor={`${idBase}-me`}
          className="shrink-0 text-sm font-medium text-slate-600 dark:text-zinc-300"
        >
          Major exam
        </label>
        {showDropdown ? (
          <select
            id={`${idBase}-me`}
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            aria-label="Select major exam report"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            id={`${idBase}-me`}
            value={selected.id}
            disabled
            className="w-full max-w-xl cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 opacity-90 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
            aria-label="Major exam report"
          >
            <option value={selected.id}>{selected.label}</option>
          </select>
        )}
      </div>

      <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40 md:max-h-[min(560px,65vh)]">
        <div className="p-4 text-slate-900 dark:text-zinc-100 sm:p-5">
          <header className="border-b border-slate-200 pb-4 text-center dark:border-zinc-800">
            <h2 className="text-lg font-bold uppercase tracking-tight">
              {selected.meta.schoolName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {selected.meta.className} — {selected.meta.subject}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Teacher: {selected.meta.teacherName}
            </p>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Term: {selected.meta.termLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
              {dateLabel}
            </p>
          </header>

          <p className="mt-3 text-center text-sm font-medium text-slate-700 dark:text-zinc-300">
            Assignment: {selected.assignment.title} (max{" "}
            {selected.assignment.max_score})
          </p>

          <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-zinc-200">
              <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
              Class statistics
              <span className="font-normal normal-case text-slate-500 dark:text-zinc-500">
                ({selected.assignment.title})
              </span>
            </h3>
            <div className="mt-3 space-y-3">
              <PassRateBlock seg={selected.passing} schoolLevel={sl} />
              <FailRateBlock seg={selected.failing} schoolLevel={sl} />
              <div className="rounded-md border border-dashed border-slate-200 bg-white/80 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950/30">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300">
                  Grade distribution (all scored)
                </p>
                <p className="mt-1 tabular-nums text-sm text-slate-800 dark:text-zinc-200">
                  A: {selected.dist.A} · B: {selected.dist.B} · C:{" "}
                  {selected.dist.C} · D: {selected.dist.D} ·{" "}
                  {sl === "primary" ? (
                    <>E: {selected.dist.E}</>
                  ) : (
                    <>F: {selected.dist.F}</>
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-zinc-200">
              Student ranking (highest to lowest)
            </h3>
            {selected.ranking.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">
                No scores entered for this exam yet.
              </p>
            ) : (
              <ol className="mt-3 list-none space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-700">
                {selected.ranking.map((r) => (
                  <li
                    key={`${r.rank}-${r.name}`}
                    className="flex flex-nowrap items-baseline gap-x-2 overflow-x-auto text-sm text-slate-800 dark:text-zinc-200"
                  >
                    <span className="w-7 shrink-0 tabular-nums font-semibold text-slate-600 dark:text-zinc-400">
                      {r.rank}.
                    </span>
                    <span className="min-w-[8rem] flex-1 font-medium">
                      {r.name}
                    </span>
                    <span className="tabular-nums text-slate-700 dark:text-zinc-300">
                      {r.scorePct}{" "}
                      <span className="font-semibold">({r.grade})</span>
                    </span>
                    {r.badge ? (
                      <span className="text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
                        {r.badge}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-zinc-200">
              Student scores &amp; remarks
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
              <table className="w-full min-w-[480px] border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white dark:bg-zinc-800">
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-600">
                      Student
                    </th>
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-600">
                      Gender
                    </th>
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-600">
                      Score
                    </th>
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-600">
                      Grade
                    </th>
                    <th className="min-w-[12rem] border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-600">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.scoreRows.map((row, i) => (
                    <tr
                      key={`${row.name}-${i}`}
                      className="odd:bg-white even:bg-slate-50/90 dark:odd:bg-zinc-950 dark:even:bg-zinc-900/60"
                    >
                      <td className="border border-slate-200 px-2 py-1.5 font-medium dark:border-zinc-700">
                        {row.name}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-700 dark:border-zinc-700 dark:text-zinc-300">
                        {row.genderLabel}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 tabular-nums text-slate-800 dark:border-zinc-700">
                        {row.scoreLabel}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 font-semibold dark:border-zinc-700">
                        {row.grade}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-700 dark:border-zinc-700">
                        {row.remarks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

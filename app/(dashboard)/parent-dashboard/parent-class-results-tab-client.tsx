"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { BarChart3 } from "lucide-react";
import { passingThresholdPercent } from "@/lib/tanzania-grades";
import type {
  ParentMajorExamClassResultOption,
  ParentMajorExamClassResultsPayload,
} from "@/lib/parent-major-exam-class-results-types";
import type { PassRateStats, FailRateStats } from "@/lib/gradebook-full-report-compute";
import type { SchoolLevel } from "@/lib/school-level";
import { subjectTextKey } from "@/lib/subject-text-key";
import type { SubjectResultsUnreadState } from "@/lib/parent-subject-results-unread-types";
import { markSubjectResultAssignmentsViewed } from "@/lib/parent-subject-results-unread-types";
import { loadParentClassResultsForSubjectAction } from "./parent-class-results-actions";
import { recordParentSubjectResultViewedAction } from "./parent-subject-results-view-actions";
import { RankingPaginationBar } from "@/components/report/ranking-pagination-bar";
import { useMinWidthMd } from "@/hooks/use-min-width-md";
import { usePrinting } from "@/hooks/use-printing";

const MOBILE_RANKING_PAGE_SIZE = 10;
const DESKTOP_RANKING_PAGE_OPTIONS = [20, 30, 50] as const;

function ParentClassResultsRankingBody({
  option,
}: {
  option: ParentMajorExamClassResultOption;
}) {
  const isPrinting = usePrinting();
  const isMd = useMinWidthMd();
  const [rankingPage, setRankingPage] = useState(0);
  const [rankingDesktopPageSize, setRankingDesktopPageSize] = useState(20);

  const rankingFull = option.ranking;
  const screenPageSize = isMd
    ? rankingDesktopPageSize
    : MOBILE_RANKING_PAGE_SIZE;

  const maxRankingPage = useMemo(() => {
    const n = rankingFull.length;
    if (n === 0) return 0;
    return Math.max(0, Math.ceil(n / screenPageSize) - 1);
  }, [rankingFull.length, screenPageSize]);

  const effectivePage = Math.min(rankingPage, maxRankingPage);

  const visibleRanking = useMemo(() => {
    if (!rankingFull.length) return [];
    if (isPrinting) return rankingFull;
    const start = effectivePage * screenPageSize;
    return rankingFull.slice(start, start + screenPageSize);
  }, [rankingFull, isPrinting, effectivePage, screenPageSize]);

  const rankingPageCount = useMemo(() => {
    const n = rankingFull.length;
    if (n === 0) return 1;
    return Math.max(1, Math.ceil(n / screenPageSize));
  }, [rankingFull.length, screenPageSize]);

  if (rankingFull.length === 0) {
    return (
      <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">
        No scores entered for this exam yet.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-700">
      <div className="mb-3">
        <RankingPaginationBar
          total={rankingFull.length}
          page={effectivePage}
          pageCount={rankingPageCount}
          pageSize={screenPageSize}
          onPageChange={setRankingPage}
          showRowsPerPage={isMd}
          rowsPerPageOptions={DESKTOP_RANKING_PAGE_OPTIONS}
          rowsPerPage={rankingDesktopPageSize}
          onRowsPerPageChange={(n) => {
            setRankingDesktopPageSize(n);
            setRankingPage(0);
          }}
        />
      </div>
      <ul className="list-none divide-y divide-slate-200 dark:divide-zinc-700">
        {visibleRanking.map((r) => (
          <li
            key={`${r.rank}-${r.name}`}
            className="flex gap-3 py-2 pr-1 text-sm text-slate-800 dark:text-zinc-200"
          >
            <span className="w-9 shrink-0 tabular-nums font-semibold text-slate-600 dark:text-zinc-400">
              {r.rank}.
            </span>
            <span className="min-w-0 flex-1 break-words font-medium text-slate-900 dark:text-zinc-100">
              {r.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  studentId,
  classId,
  classResultSubjects,
  initialPayload,
  subjectResultsUnread,
  onSubjectResultsUnreadChange,
}: {
  studentId: string;
  classId: string;
  classResultSubjects: string[];
  initialPayload: ParentMajorExamClassResultsPayload;
  subjectResultsUnread: SubjectResultsUnreadState;
  onSubjectResultsUnreadChange: Dispatch<
    SetStateAction<SubjectResultsUnreadState>
  >;
}) {
  const idBase = useId();
  const [payload, setPayload] = useState(initialPayload);
  const [selectedSubject, setSelectedSubject] = useState(
    () => classResultSubjects[0] ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const didLogMount = useRef(false);

  useEffect(() => {
    didLogMount.current = false;
  }, [studentId, classId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || didLogMount.current) {
      return;
    }
    didLogMount.current = true;
    // eslint-disable-next-line no-console -- parent Subject results debug
    console.log("[ParentClassResults] mount", {
      initialPayload,
      classResultSubjects: [...classResultSubjects],
      studentId,
      classId,
    });
  }, [classId, classResultSubjects, initialPayload, studentId]);

  useEffect(() => {
    if (classResultSubjects.length === 0) {
      setSelectedSubject("");
    } else {
      setSelectedSubject(classResultSubjects[0]!);
    }
    setPayload(initialPayload);
    setLoadError(null);
  }, [studentId, classId, classResultSubjects, initialPayload]);

  const { options, defaultOptionId } = payload;
  const [selectedId, setSelectedId] = useState(() =>
    initialPayload.defaultOptionId ||
    initialPayload.options[0]?.id ||
    ""
  );

  const onPickSubject = useCallback(
    (subj: string) => {
      setSelectedSubject(subj);
      setLoadError(null);
      startTransition(async () => {
        const r = await loadParentClassResultsForSubjectAction({
          studentId,
          classId,
          subject: subj,
        });
        if (r.ok) {
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console -- parent Subject results debug
            console.log(
              "[ParentClassResults] payload after subject fetch",
              { subject: subj, payload: r.payload }
            );
          }
          setPayload(r.payload);
        } else {
          setLoadError(r.error);
        }
      });
    },
    [studentId, classId, startTransition]
  );

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

  /** When subject results are shown, mark every assignment in the loaded list as viewed (persists + badge). */
  useEffect(() => {
    if (isPending) return;
    if (options.length === 0) return;
    const ids = options
      .map((o) => o.assignment.id)
      .filter((id) => subjectResultsUnread.byAssignmentUnviewed[id] === true);
    if (ids.length === 0) return;

    let cancelled = false;
    void (async () => {
      for (const assignmentId of ids) {
        if (cancelled) return;
        const r = await recordParentSubjectResultViewedAction({
          studentId,
          classId,
          assignmentId,
        });
        if (cancelled) return;
        if (!r.ok) {
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console -- diagnose persist failures
            console.warn(
              "[ParentClassResults] recordParentSubjectResultViewedAction",
              r.error
            );
          }
          return;
        }
      }
      if (cancelled) return;
      onSubjectResultsUnreadChange((prev) =>
        markSubjectResultAssignmentsViewed(prev, ids)
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isPending,
    options,
    studentId,
    classId,
    subjectResultsUnread,
    onSubjectResultsUnreadChange,
  ]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // eslint-disable-next-line no-console -- parent Subject results debug
    console.log("[ParentClassResults] subjects + selection", {
      classResultSubjects,
      optionsCount: options.length,
      defaultOptionId,
      selectedSubject,
      selectedId,
      selectedAssignment: selected
        ? { id: selected.id, label: selected.label, title: selected.assignment.title }
        : null,
    });
  }, [
    classResultSubjects,
    options.length,
    defaultOptionId,
    selectedSubject,
    selectedId,
    selected,
  ]);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
        new Date()
      ),
    []
  );

  /** Empty only when the server provided neither subject keys nor assignment options. */
  const hasAnyClassResultsData =
    classResultSubjects.length > 0 || options.length > 0;

  if (!hasAnyClassResultsData) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No class results yet. When teachers record scores in Marks for an
          assignment, statistics for that exam will appear here.
        </p>
      </div>
    );
  }

  const showSubjectDropdown = classResultSubjects.length > 1;
  const showAssignmentDropdown = options.length > 1;
  const subjectLineLabel =
    classResultSubjects[0] ?? options[0]?.meta?.subject?.trim() ?? "Subject";

  const subjectOptionLine = (s: string) => {
    const dot =
      subjectResultsUnread.bySubjectHasUnviewed[subjectTextKey(s)] === true
        ? "🔵 "
        : "";
    return `${dot}${s}`;
  };

  const assignmentOptionLine = (o: (typeof options)[0]) => {
    const isNew = subjectResultsUnread.byAssignmentUnviewed[o.assignment.id] === true;
    return `${isNew ? "🆕 " : ""}${o.label}`;
  };

  const singleSubjectUnreadDot =
    subjectResultsUnread.bySubjectHasUnviewed[
      subjectTextKey(classResultSubjects[0] ?? selectedSubject)
    ] === true
      ? "🔵 "
      : "";

  if (options.length === 0) {
    return (
      <div className="space-y-3 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor={`${idBase}-subj`}
            className="shrink-0 text-sm font-medium text-slate-600 dark:text-zinc-300"
          >
            Subject
          </label>
          {showSubjectDropdown ? (
            <select
              id={`${idBase}-subj`}
              value={selectedSubject}
              onChange={(e) => onPickSubject(e.target.value)}
              disabled={isPending}
              className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              aria-label="Select subject for class results"
            >
              {classResultSubjects.map((s) => (
                <option key={s} value={s}>
                  {subjectOptionLine(s)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-800 dark:text-zinc-200">
              {singleSubjectUnreadDot}
              {subjectLineLabel}
            </span>
          )}
        </div>
        {loadError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
        ) : null}
        <div className="px-1 py-6 text-center">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {isPending
              ? "Loading…"
              : "No results for this subject yet, or nothing was recorded in Marks for this class."}
          </p>
        </div>
      </div>
    );
  }

  const sl = selected.schoolLevel;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor={`${idBase}-subj`}
            className="shrink-0 text-sm font-medium text-slate-600 dark:text-zinc-300"
          >
            Subject
          </label>
          {showSubjectDropdown ? (
            <select
              id={`${idBase}-subj`}
              value={selectedSubject}
              onChange={(e) => onPickSubject(e.target.value)}
              disabled={isPending}
              className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              aria-label="Select subject for class results"
            >
              {classResultSubjects.map((s) => (
                <option key={s} value={s}>
                  {subjectOptionLine(s)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-800 dark:text-zinc-200">
              {singleSubjectUnreadDot}
              {subjectLineLabel}
            </span>
          )}
        </div>
        {loadError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {loadError}
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor={`${idBase}-asg`}
            className="shrink-0 text-sm font-medium text-slate-600 dark:text-zinc-300"
          >
            Assignment
          </label>
        {showAssignmentDropdown ? (
          <select
            id={`${idBase}-asg`}
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isPending}
            className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            aria-label="Select class assignment report"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {assignmentOptionLine(o)}
              </option>
            ))}
          </select>
        ) : (
          <select
            id={`${idBase}-asg`}
            value={selected.id}
            disabled
            className="w-full max-w-xl cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 opacity-90 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
            aria-label="Class assignment report"
          >
            <option value={selected.id}>
              {assignmentOptionLine(selected)}
            </option>
          </select>
        )}
        </div>
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
            <ParentClassResultsRankingBody key={selected.id} option={selected} />
          </section>

          <section className="mt-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-zinc-200">
              Student scores &amp; remarks
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
              <table className="w-full min-w-[480px] border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white dark:bg-zinc-800 dark:text-gray-200">
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200">
                      Student
                    </th>
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200">
                      Gender
                    </th>
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200">
                      Score
                    </th>
                    <th className="border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200">
                      Grade
                    </th>
                    <th className="min-w-[12rem] border border-slate-600 px-2 py-2 font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.scoreRows.map((row, i) => (
                    <tr
                      key={`${row.name}-${i}`}
                      className="odd:bg-white even:bg-gray-50 dark:odd:bg-zinc-950 dark:even:bg-zinc-800/50"
                    >
                      <td className="border border-slate-200 px-2 py-1.5 font-medium dark:border-zinc-700 dark:text-gray-200">
                        {row.name}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-700 dark:border-zinc-700 dark:text-gray-200">
                        {row.genderLabel}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 tabular-nums text-slate-800 dark:border-zinc-700 dark:text-gray-200">
                        {row.scoreLabel}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 font-semibold dark:border-zinc-700 dark:text-gray-200">
                        {row.grade}
                      </td>
                      <td className="border border-slate-200 px-2 py-1.5 text-slate-700 dark:border-zinc-700 dark:text-gray-200">
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

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  applyClassPromotionsAction,
  loadClassStudentsForPromotionAction,
} from "./actions";
import type { PromotionClassRow, PromotionDecision } from "@/lib/promotions/types";

const DECISION_LABELS: Record<PromotionDecision, string> = {
  promote: "Promote",
  repeat: "Repeat",
  graduate: "Graduate",
};

const DECISION_LABELS_LONG: Record<PromotionDecision, string> = {
  promote: "Promote to next class",
  repeat: "Repeat (same class)",
  graduate: "Graduate",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

interface PromotionModalProps {
  open: boolean;
  onClose: () => void;
  classRow: PromotionClassRow;
  academicYear: number;
  onSuccess: (message: string) => void;
}

type StudentDecision = {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  decision: PromotionDecision;
  term2AveragePercent: number | null;
  term2ReportCardStatus: "not_generated" | "pending_approval" | "approved";
  hasTerm2ReportCard: boolean;
  canPromote: boolean;
  suggestedDecision: PromotionDecision | null;
};

export function PromotionModal({
  open,
  onClose,
  classRow,
  academicYear,
  onSuccess,
}: PromotionModalProps) {
  const titleId = useId();
  const searchId = useId();
  const [students, setStudents] = useState<StudentDecision[]>([]);
  const [nextClassName, setNextClassName] = useState<string | null>(null);
  const [rulesMode, setRulesMode] = useState<"manual" | "auto">("manual");
  const [minAverageGrade, setMinAverageGrade] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [reportCardFilter, setReportCardFilter] = useState<
    "all" | "has" | "missing"
  >("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<PageSizeOption>(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSubmitError(null);
    const result = await loadClassStudentsForPromotionAction(
      classRow.id,
      academicYear
    );
    setLoading(false);
    if ("error" in result) {
      setLoadError(result.error);
      setStudents([]);
      return;
    }
    setNextClassName(result.nextClassName);
    setRulesMode(result.rulesMode);
    setMinAverageGrade(result.minAverageGrade);
    setStudents(
      result.students.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        admission_number: s.admission_number,
        class_id: s.class_id,
        term2AveragePercent: s.term2AveragePercent,
        term2ReportCardStatus: s.term2ReportCardStatus,
        hasTerm2ReportCard: s.hasTerm2ReportCard,
        canPromote: s.canPromote,
        suggestedDecision: s.suggestedDecision,
        decision: s.suggestedDecision ?? "repeat",
      }))
    );
    setSearchQuery("");
    setPage(1);
    setSelectedIds(new Set());
  }, [classRow.id, academicYear]);

  // Load roster when the modal opens (async fetch; not derivable from props alone).
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch on open
    void loadStudents();
  }, [open, loadStudents]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isPending, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const summary = useMemo(() => {
    let promoted = 0;
    let repeated = 0;
    let graduated = 0;
    for (const s of students) {
      if (s.decision === "promote" && s.canPromote) promoted += 1;
      else if (
        s.decision === "repeat" ||
        (s.decision === "promote" && !s.canPromote)
      )
        repeated += 1;
      else graduated += 1;
    }
    return {
      total: students.length,
      promoted,
      repeated,
      graduated,
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = students;
    if (reportCardFilter === "has") {
      list = list.filter((s) => s.hasTerm2ReportCard);
    } else if (reportCardFilter === "missing") {
      list = list.filter((s) => !s.hasTerm2ReportCard);
    }

    if (!q) return list;
    return list.filter((s) => {
      const name = s.full_name.toLowerCase();
      const adm = (s.admission_number ?? "").trim().toLowerCase();
      return name.includes(q) || adm.includes(q);
    });
  }, [students, searchQuery, reportCardFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / rowsPerPage) || 1
  );
  const safePage = Math.min(page, totalPages);

  const pageStudents = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredStudents.slice(start, start + rowsPerPage);
  }, [filteredStudents, safePage, rowsPerPage]);

  const showingFrom =
    filteredStudents.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const showingTo = Math.min(safePage * rowsPerPage, filteredStudents.length);

  const pageAllSelected =
    pageStudents.length > 0 &&
    pageStudents.every((s) => selectedIds.has(s.id));

  function setDecisionForAll(decision: PromotionDecision) {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        decision: decision === "promote" && !s.hasTerm2ReportCard ? "repeat" : decision,
      }))
    );
  }

  function setDecision(studentId: string, decision: PromotionDecision) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              decision:
                decision === "promote" && !s.hasTerm2ReportCard
                  ? "repeat"
                  : decision,
            }
          : s
      )
    );
  }

  function setDecisionForIds(ids: Set<string>, decision: PromotionDecision) {
    if (ids.size === 0) return;
    setStudents((prev) =>
      prev.map((s) =>
        ids.has(s.id)
          ? {
              ...s,
              decision:
                decision === "promote" && !s.hasTerm2ReportCard
                  ? "repeat"
                  : decision,
            }
          : s
      )
    );
  }

  function toggleSelected(studentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of pageStudents) next.add(s.id);
      return next;
    });
  }

  function clearPageSelection() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of pageStudents) next.delete(s.id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || students.length === 0) return;

    const needsNext = students.some((s) => s.decision === "promote" && s.canPromote);
    if (needsNext && !nextClassName) {
      setSubmitError(
        "No next class is configured for this track. Set progression order below, then try again."
      );
      return;
    }

    startTransition(async () => {
      setSubmitError(null);
      const result = await applyClassPromotionsAction(
        classRow.id,
        academicYear,
        students.map((s) => ({ studentId: s.id, decision: s.decision }))
      );
      if ("error" in result) {
        setSubmitError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onSuccess(result.message);
      onClose();
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !isPending) onClose();
      }}
    >
      <div className="flex max-h-[min(92vh,800px)] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900 sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Promote {classRow.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Academic year {academicYear}
              {nextClassName ? (
                <>
                  {" "}
                  · Next class:{" "}
                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                    {nextClassName}
                  </span>
                </>
              ) : (
                <span className="text-amber-700 dark:text-amber-300">
                  {" "}
                  · No next class configured
                </span>
              )}
            </p>
            {rulesMode === "auto" && minAverageGrade != null ? (
              <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                Promotion uses Term 2 report cards only. Promote when the
                student’s Term 2 average is ≥ {minAverageGrade}%. The Term 2
                report card must be approved.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Promotion uses Term 2 report cards only.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {loading ? (
            <AsyncLoadingShell
              className="mx-4 my-6 border-0 shadow-none sm:mx-6"
              message="Loading students and Term 2 report cards…"
              slowMessage="Still loading… Calculating Term 2 averages for this class."
              skeletonRows={5}
            />
          ) : loadError ? (
            <div className="px-4 py-6 sm:px-6">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {loadError}
              </p>
            </div>
          ) : students.length === 0 ? (
            <div className="px-4 py-6 sm:px-6">
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No active students in this class.
              </p>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 shrink-0 space-y-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    id={searchId}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by name or admission number"
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                    <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                      Term 2 card
                    </span>
                    <select
                      value={reportCardFilter}
                      onChange={(e) => {
                        setReportCardFilter(
                          e.target.value as "all" | "has" | "missing"
                        );
                        setPage(1);
                      }}
                      disabled={isPending}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                      aria-label="Filter students by Term 2 report card"
                    >
                      <option value="all">All students</option>
                      <option value="has">With Term 2 report card</option>
                      <option value="missing">Without Term 2 report card</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium text-slate-800 dark:text-zinc-200">
                    Summary:
                  </span>
                  <span className="text-slate-600 dark:text-zinc-400">
                    {summary.total} total
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {summary.promoted} promote
                  </span>
                  <span className="text-amber-800 dark:text-amber-200">
                    {summary.repeated} repeat
                  </span>
                  <span className="text-violet-700 dark:text-violet-300">
                    {summary.graduated} graduate
                  </span>
                  {searchQuery.trim() ? (
                    <span className="text-xs text-slate-500 dark:text-zinc-500">
                      ({filteredStudents.length} match search)
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                    Apply to all {summary.total}:
                  </span>
                  {(
                    ["promote", "repeat", "graduate"] as PromotionDecision[]
                  ).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDecisionForAll(d)}
                      disabled={isPending}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      {DECISION_LABELS_LONG[d]}
                    </button>
                  ))}
                </div>

                {selectedIds.size > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-school-primary/30 bg-[rgb(var(--school-primary-rgb)/0.08)] px-2 py-1.5">
                    <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      Set {selectedIds.size} selected:
                    </span>
                    {(
                      ["promote", "repeat", "graduate"] as PromotionDecision[]
                    ).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDecisionForIds(selectedIds, d)}
                        disabled={isPending}
                        className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800"
                      >
                        {DECISION_LABELS[d]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
                {filteredStudents.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                    No students match your search.
                  </p>
                ) : (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={
                          pageAllSelected ? clearPageSelection : selectAllOnPage
                        }
                        disabled={isPending || pageStudents.length === 0}
                        className="text-xs font-medium text-school-primary hover:underline disabled:opacity-50"
                      >
                        {pageAllSelected
                          ? "Deselect all on page"
                          : "Select all on page"}
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                          <tr>
                            <th className="w-10 px-2 py-2.5" scope="col">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="px-3 py-2.5" scope="col">
                              Name
                            </th>
                            <th className="px-3 py-2.5" scope="col">
                              Admission
                            </th>
                            <th className="px-3 py-2.5 text-right" scope="col">
                              Term 2 Avg
                            </th>
                            <th className="px-3 py-2.5" scope="col">
                              Decision
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {pageStudents.map((s) => {
                            const avgLabel =
                              s.term2AveragePercent != null
                                ? `${s.term2AveragePercent}%`
                                : "—";
                            const reportLabel =
                              s.term2ReportCardStatus === "approved"
                                ? "Generated"
                                : s.term2ReportCardStatus ===
                                    "pending_approval"
                                  ? "Pending approval"
                                  : "Not generated";
                            return (
                              <tr
                                key={s.id}
                                className={
                                  selectedIds.has(s.id)
                                    ? "bg-[rgb(var(--school-primary-rgb)/0.06)]"
                                    : undefined
                                }
                              >
                                <td className="px-2 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(s.id)}
                                    onChange={() => toggleSelected(s.id)}
                                    disabled={isPending}
                                    aria-label={`Select ${s.full_name}`}
                                    className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary"
                                  />
                                </td>
                                <td className="px-3 py-2.5">
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {s.full_name}
                                  </p>
                                  <p
                                    className={`mt-0.5 text-xs ${
                                      s.term2ReportCardStatus === "approved"
                                        ? "text-emerald-700 dark:text-emerald-300"
                                        : s.term2ReportCardStatus ===
                                            "pending_approval"
                                          ? "text-amber-800 dark:text-amber-200"
                                          : "text-slate-500 dark:text-zinc-400"
                                    }`}
                                  >
                                    {reportLabel}
                                  </p>
                                  {s.term2ReportCardStatus === "not_generated" ? (
                                    <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                                      No Term 2 report card found
                                    </p>
                                  ) : null}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-zinc-400">
                                  {s.admission_number?.trim() || "—"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                                  {avgLabel}
                                </td>
                                <td className="px-3 py-2.5">
                                  <select
                                    value={s.decision}
                                    onChange={(e) =>
                                      setDecision(
                                        s.id,
                                        e.target.value as PromotionDecision
                                      )
                                    }
                                    className="w-full min-w-[8rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                                    disabled={isPending}
                                    aria-label={`Decision for ${s.full_name}`}
                                  >
                                    {(
                                      [
                                        "promote",
                                        "repeat",
                                        "graduate",
                                      ] as PromotionDecision[]
                                    ).map((d) => (
                                      <option
                                        key={d}
                                        value={d}
                                        disabled={d === "promote" && !s.hasTerm2ReportCard}
                                      >
                                        {DECISION_LABELS_LONG[d]}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {submitError ? (
                  <p
                    className="mt-3 text-sm text-red-600 dark:text-red-400"
                    role="alert"
                  >
                    {submitError}
                  </p>
                ) : null}
              </div>

              {filteredStudents.length > 0 ? (
                <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    Showing {showingFrom}–{showingTo} of {filteredStudents.length}{" "}
                    student{filteredStudents.length === 1 ? "" : "s"}
                    {searchQuery.trim() && filteredStudents.length !== students.length
                      ? ` (${students.length} total in class)`
                      : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                      <span className="sr-only sm:not-sr-only sm:inline">
                        Per page
                      </span>
                      <select
                        value={rowsPerPage}
                        onChange={(e) => {
                          setRowsPerPage(
                            Number(e.target.value) as PageSizeOption
                          );
                          setPage(1);
                        }}
                        disabled={isPending}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                        aria-label="Students per page"
                      >
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} per page
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={isPending || safePage <= 1}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={isPending || safePage >= totalPages}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}

              <p className="shrink-0 border-t border-amber-200/80 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 sm:px-6">
                Confirm will apply to all {summary.total} students:{" "}
                {summary.promoted} promote, {summary.repeated} repeat,{" "}
                {summary.graduated} graduate.
              </p>
            </>
          )}

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || loading || students.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Confirm promotion"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

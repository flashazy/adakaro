"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AsyncLoadingShell } from "@/components/dashboard/async-loading-shell";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { SubjectCompatibilityModal } from "@/components/students/subject-compatibility-modal";
import { checkSubjectCompatibilityAction } from "@/lib/student-subject-enrollment/subject-compatibility-actions";
import type { SubjectCompatibilityBatchResult } from "@/lib/student-subject-enrollment/subject-compatibility-types";
import {
  applyClassPromotionsAction,
  loadClassStudentsForPromotionAction,
} from "./actions";
import type { PromotionClassRow, PromotionDecision } from "@/lib/promotions/types";
import Link from "next/link";

const DECISION_LABELS: Record<PromotionDecision, string> = {
  promote: "Promote",
  repeat: "Repeat",
  graduate: "Graduate",
};

const INFO_PANEL_CLASS =
  "rounded-lg border border-amber-100/90 bg-amber-50/50 px-2.5 py-1 text-xs leading-relaxed text-amber-800/90 dark:border-amber-900/25 dark:bg-amber-950/15 dark:text-amber-100/85";

const SECTION_HEADING_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-zinc-300";

type SummaryPillFilter =
  | "all"
  | "eligible"
  | "below_requirement"
  | "graduate"
  | "promote"
  | "repeat";

type SummaryPillTone = "slate" | "emerald" | "amber" | "violet";

const SUMMARY_PILL_TONE_CLASS: Record<
  SummaryPillTone,
  { idle: string; active: string }
> = {
  slate: {
    idle:
      "bg-slate-200/70 text-slate-700 hover:bg-slate-300/60 dark:bg-zinc-700/70 dark:text-zinc-200 dark:hover:bg-zinc-600/70",
    active:
      "border border-slate-400 bg-slate-300/90 text-slate-900 shadow-sm dark:border-zinc-500 dark:bg-zinc-600 dark:text-white",
  },
  emerald: {
    idle:
      "bg-emerald-100 text-emerald-800 hover:bg-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950/70",
    active:
      "border border-emerald-400 bg-emerald-200 text-emerald-900 shadow-sm dark:border-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-100",
  },
  amber: {
    idle:
      "bg-amber-100 text-amber-900 hover:bg-amber-200/70 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60",
    active:
      "border border-amber-400 bg-amber-200 text-amber-950 shadow-sm dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100",
  },
  violet: {
    idle:
      "bg-violet-100 text-violet-800 hover:bg-violet-200/70 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60",
    active:
      "border border-violet-400 bg-violet-200 text-violet-900 shadow-sm dark:border-violet-600 dark:bg-violet-900/50 dark:text-violet-100",
  },
};

function SummaryPillButton({
  active,
  onClick,
  disabled,
  tone,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone: SummaryPillTone;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const toneClass = SUMMARY_PILL_TONE_CLASS[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-school-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? toneClass.active : toneClass.idle
      }`}
    >
      {children}
    </button>
  );
}

function matchesSummaryPillFilter(
  student: StudentDecision,
  filter: SummaryPillFilter,
  minAverageGrade: number | null
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "eligible":
      return (
        minAverageGrade != null &&
        student.term2AveragePercent != null &&
        student.term2AveragePercent >= minAverageGrade
      );
    case "below_requirement":
      return (
        minAverageGrade != null &&
        !(
          student.term2AveragePercent != null &&
          student.term2AveragePercent >= minAverageGrade
        )
      );
    case "graduate":
      return student.decision === "graduate";
    case "promote":
      return student.decision === "promote";
    case "repeat":
      return student.decision === "repeat";
    default:
      return true;
  }
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

type ResultsFilter = "all" | "ready" | "missing_results";

type Term2ReportCardStatus =
  | "not_generated"
  | "pending_approval"
  | "approved";

type StudentDecision = {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  decision: PromotionDecision;
  term2AveragePercent: number | null;
  noSubjectsAssigned?: boolean;
  noScoresEntered?: boolean;
  term2ReportCardStatus: Term2ReportCardStatus;
  hasTerm2ReportCard: boolean;
  suggestedDecision: PromotionDecision | null;
};

function hasTerm2AverageForReview(
  student: Pick<StudentDecision, "term2AveragePercent">
): boolean {
  return student.term2AveragePercent != null;
}

function parentAccessLabel(status: Term2ReportCardStatus): string | null {
  if (status === "pending_approval") return "Parent Access Pending";
  return null;
}

function promotionReviewStatus(
  student: Pick<StudentDecision, "term2AveragePercent">,
  minAverageGrade: number | null
): { label: string; className: string } | null {
  if (student.term2AveragePercent == null) {
    return {
      label: "Awaiting Results",
      className:
        "text-xs font-semibold text-slate-700 dark:text-zinc-300",
    };
  }
  if (minAverageGrade == null) return null;
  if (student.term2AveragePercent >= minAverageGrade) {
    return {
      label: "Eligible",
      className:
        "text-xs font-semibold text-emerald-700 dark:text-emerald-300",
    };
  }
  return {
    label: "Below Requirement",
    className: "text-xs font-semibold text-amber-800 dark:text-amber-200",
  };
}

const PARENT_ACCESS_STATUS_CLASS =
  "text-[11px] font-normal leading-snug text-slate-400 dark:text-zinc-500";

function StudentPromotionStatus({
  parentLabel,
  reviewStatus,
}: {
  parentLabel: string | null;
  reviewStatus: ReturnType<typeof promotionReviewStatus>;
}) {
  return (
    <>
      {reviewStatus ? (
        <p className={`mt-1 leading-snug ${reviewStatus.className}`}>
          {reviewStatus.label}
        </p>
      ) : null}
      {parentLabel ? (
        <p
          className={`${reviewStatus ? "mt-0.5" : "mt-1"} ${PARENT_ACCESS_STATUS_CLASS}`}
        >
          {parentLabel}
        </p>
      ) : null}
    </>
  );
}

interface PromotionModalProps {
  open: boolean;
  onClose: () => void;
  classRow: PromotionClassRow;
  academicYear: number;
  onSuccess: (message: string) => void;
}

const DECISION_SELECT_CLASS =
  "block w-full max-w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

function PromotionDecisionSelect({
  student,
  value,
  onChange,
  minAverageGrade,
  disabled,
  className = "",
}: {
  student: StudentDecision;
  value: PromotionDecision;
  onChange: (decision: PromotionDecision) => void;
  minAverageGrade: number | null;
  disabled: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PromotionDecision)}
      className={`${DECISION_SELECT_CLASS} ${className}`.trim()}
      disabled={disabled}
      aria-label={`Decision for ${student.full_name}`}
    >
      {(["promote", "repeat", "graduate"] as PromotionDecision[]).map((d) => (
        <option
          key={d}
          value={d}
          disabled={
            d === "promote" &&
            (student.term2AveragePercent == null ||
              (minAverageGrade != null &&
                student.term2AveragePercent < minAverageGrade))
          }
        >
          {DECISION_LABELS[d]}
        </option>
      ))}
    </select>
  );
}

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
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [compatibilityModalOpen, setCompatibilityModalOpen] = useState(false);
  const [compatibilityModalMode, setCompatibilityModalMode] = useState<
    "warning" | "blocked"
  >("warning");
  const [compatibilityResult, setCompatibilityResult] =
    useState<SubjectCompatibilityBatchResult | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [resultsFilter, setResultsFilter] = useState<ResultsFilter>("all");
  const [summaryPillFilter, setSummaryPillFilter] =
    useState<SummaryPillFilter>("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<PageSizeOption>(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSubmitError(null);
    setShowIncompleteWarning(false);
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
    setShowIncompleteWarning(result.reportCardsIncompleteWarning === true);
    const mapped = result.students.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      admission_number: s.admission_number,
      class_id: s.class_id,
      term2AveragePercent: s.term2AveragePercent,
      noSubjectsAssigned: s.noSubjectsAssigned === true,
      noScoresEntered: s.noScoresEntered === true,
      term2ReportCardStatus: s.term2ReportCardStatus,
      hasTerm2ReportCard: s.hasTerm2ReportCard,
      suggestedDecision: s.suggestedDecision,
      decision:
        s.suggestedDecision ??
        (s.term2AveragePercent != null ? "promote" : "repeat"),
    }));
    setStudents(mapped);
    setSearchQuery("");
    setResultsFilter("all");
    setSummaryPillFilter("all");
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
      if (s.decision === "promote") promoted += 1;
      else if (s.decision === "repeat") repeated += 1;
      else graduated += 1;
    }
    const noSubjectsCount = students.filter((s) => s.noSubjectsAssigned).length;
    const missingResultsCount = students.filter(
      (s) => s.term2AveragePercent == null
    ).length;
    let eligible = 0;
    let belowRequirement = 0;
    if (minAverageGrade != null) {
      for (const s of students) {
        if (
          s.term2AveragePercent != null &&
          s.term2AveragePercent >= minAverageGrade
        ) {
          eligible += 1;
        } else {
          belowRequirement += 1;
        }
      }
    }
    return {
      total: students.length,
      promoted,
      repeated,
      graduated,
      eligible,
      belowRequirement,
      noSubjectsCount,
      missingResultsCount,
    };
  }, [students, minAverageGrade]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = students;

    if (resultsFilter === "ready") {
      list = list.filter((s) => hasTerm2AverageForReview(s));
    } else if (resultsFilter === "missing_results") {
      list = list.filter((s) => !hasTerm2AverageForReview(s));
    }

    if (summaryPillFilter !== "all") {
      list = list.filter((s) =>
        matchesSummaryPillFilter(s, summaryPillFilter, minAverageGrade)
      );
    }

    if (!q) return list;
    return list.filter((s) => {
      const name = s.full_name.toLowerCase();
      const adm = (s.admission_number ?? "").trim().toLowerCase();
      return name.includes(q) || adm.includes(q);
    });
  }, [students, searchQuery, resultsFilter, summaryPillFilter, minAverageGrade]);

  const promotionReadinessPercent =
    summary.total > 0 && minAverageGrade != null
      ? Math.round((summary.eligible / summary.total) * 100)
      : null;

  function applySummaryPillFilter(filter: SummaryPillFilter) {
    setSummaryPillFilter(filter);
    setPage(1);
  }

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

  const pagePartiallySelected =
    pageStudents.some((s) => selectedIds.has(s.id)) && !pageAllSelected;

  const selectionOnlyOnCurrentPage =
    selectedIds.size > 0 &&
    [...selectedIds].every((id) => pageStudents.some((s) => s.id === id));

  const selectedCountLabel =
    selectedIds.size === 0
      ? null
      : selectionOnlyOnCurrentPage
        ? `${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"} selected on this page`
        : `${selectedIds.size} student${selectedIds.size === 1 ? "" : "s"} selected`;

  const selectAllDesktopRef = useRef<HTMLInputElement>(null);
  const selectAllMobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    for (const el of [
      selectAllDesktopRef.current,
      selectAllMobileRef.current,
    ]) {
      if (el) el.indeterminate = pagePartiallySelected;
    }
  }, [pagePartiallySelected, safePage, pageStudents.length]);

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

  const promotionEntries = useMemo(
    () => students.map((s) => ({ studentId: s.id, decision: s.decision })),
    [students]
  );

  const executePromotion = (acknowledgeSubjectCompatibilityWarning: boolean) => {
    startTransition(async () => {
      setSubmitError(null);
      const result = await applyClassPromotionsAction(
        classRow.id,
        academicYear,
        promotionEntries,
        { acknowledgeSubjectCompatibilityWarning }
      );
      if ("requiresSubjectCompatibilityAck" in result) {
        setCompatibilityResult(result.compatibility);
        setCompatibilityModalMode("warning");
        setCompatibilityModalOpen(true);
        return;
      }
      if ("error" in result) {
        setSubmitError(result.error);
        toast.error(result.error);
        return;
      }
      setCompatibilityModalOpen(false);
      setCompatibilityResult(null);
      toast.success(result.message);
      onSuccess(result.message);
      onClose();
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || students.length === 0) return;

    const needsNext = students.some((s) => s.decision === "promote");
    if (needsNext && !nextClassName) {
      setSubmitError(
        "No next class is configured for this track. Set progression order below, then try again."
      );
      return;
    }

    const nextClassId = classRow.next_class_id;
    const promoteMoves =
      nextClassId && nextClassId !== classRow.id
        ? students
            .filter((s) => s.decision === "promote")
            .map((s) => ({ studentId: s.id, targetClassId: nextClassId }))
        : [];

    if (promoteMoves.length > 0) {
      const check = await checkSubjectCompatibilityAction(promoteMoves);
      if (!check.ok) {
        setSubmitError(check.error);
        toast.error(check.error);
        return;
      }
      if (check.result.status === "blocked") {
        setCompatibilityResult(check.result);
        setCompatibilityModalMode("blocked");
        setCompatibilityModalOpen(true);
        return;
      }
      if (check.result.status === "warning") {
        setCompatibilityResult(check.result);
        setCompatibilityModalMode("warning");
        setCompatibilityModalOpen(true);
        return;
      }
    }

    executePromotion(false);
  }

  if (!open) return null;

  return (
    <>
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
                Promotion uses Term 2 results. Students with an average of ≥
                {minAverageGrade}% may be promoted. Parent report access is
                separate from promotion decisions.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Promotion uses Term 2 results. Choose each student’s class for
                next year.
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
              {loadError.toLowerCase().includes("no report cards found") ? (
                <div className="mt-3">
                  <Link
                    href="/teacher-dashboard/report-cards"
                    className="inline-flex items-center justify-center rounded-lg bg-school-primary px-3 py-2 text-sm font-medium text-white hover:brightness-105"
                  >
                    Go to Report Cards
                  </Link>
                </div>
              ) : null}
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
                {showIncompleteWarning ? (
                  <div className={INFO_PANEL_CLASS}>
                    Some students are missing marks in one or more subjects.
                    Promotion decisions may change once all results are entered.
                  </div>
                ) : null}
                {summary.noSubjectsCount > 0 ? (
                  <div className={INFO_PANEL_CLASS}>
                    {summary.noSubjectsCount} student
                    {summary.noSubjectsCount === 1 ? "" : "s"} have no subjects
                    assigned for Term 2. Assign subjects before promotion.
                  </div>
                ) : null}
                {summary.missingResultsCount > 0 ? (
                  <div className={INFO_PANEL_CLASS}>
                    {summary.missingResultsCount} student
                    {summary.missingResultsCount === 1 ? " does" : "s do"} not yet
                    have enough results for promotion review.
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
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
                  <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                    <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                      Show
                    </span>
                    <select
                      value={resultsFilter}
                      onChange={(e) => {
                        setResultsFilter(e.target.value as ResultsFilter);
                        setPage(1);
                      }}
                      disabled={isPending}
                      className="w-full min-w-[12.5rem] rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 sm:w-auto"
                      aria-label="Show students by Term 2 results"
                    >
                      <option value="all">All Students</option>
                      <option value="ready">Ready for Promotion Review</option>
                      <option value="missing_results">Awaiting Results</option>
                    </select>
                  </label>
                </div>

                <div
                  className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-zinc-700/80 dark:bg-zinc-800/50"
                  role="status"
                  aria-label="Promotion summary"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className={SECTION_HEADING_CLASS}>Promotion Summary</span>
                    <span
                      className="hidden text-slate-300 sm:inline dark:text-zinc-600"
                      aria-hidden
                    >
                      |
                    </span>
                    <SummaryPillButton
                      active={summaryPillFilter === "all"}
                      onClick={() => applySummaryPillFilter("all")}
                      disabled={isPending}
                      tone="slate"
                      ariaLabel={`Show all ${summary.total} students`}
                    >
                      {summary.total} Student{summary.total === 1 ? "" : "s"}
                    </SummaryPillButton>
                    {minAverageGrade != null ? (
                      <>
                        <span
                          className="hidden text-slate-300 sm:inline dark:text-zinc-600"
                          aria-hidden
                        >
                          |
                        </span>
                        <SummaryPillButton
                          active={summaryPillFilter === "eligible"}
                          onClick={() => applySummaryPillFilter("eligible")}
                          disabled={isPending}
                          tone="emerald"
                          ariaLabel={`Show ${summary.eligible} eligible students`}
                        >
                          {summary.eligible} Eligible
                        </SummaryPillButton>
                        <span
                          className="hidden text-slate-300 sm:inline dark:text-zinc-600"
                          aria-hidden
                        >
                          |
                        </span>
                        <SummaryPillButton
                          active={summaryPillFilter === "below_requirement"}
                          onClick={() =>
                            applySummaryPillFilter("below_requirement")
                          }
                          disabled={isPending}
                          tone="amber"
                          ariaLabel={`Show ${summary.belowRequirement} students below requirement`}
                        >
                          {summary.belowRequirement} Below Requirement
                        </SummaryPillButton>
                      </>
                    ) : (
                      <>
                        <span
                          className="hidden text-slate-300 sm:inline dark:text-zinc-600"
                          aria-hidden
                        >
                          |
                        </span>
                        <SummaryPillButton
                          active={summaryPillFilter === "promote"}
                          onClick={() => applySummaryPillFilter("promote")}
                          disabled={isPending}
                          tone="emerald"
                          ariaLabel={`Show ${summary.promoted} students set to promote`}
                        >
                          {summary.promoted} Promote
                        </SummaryPillButton>
                        <span
                          className="hidden text-slate-300 sm:inline dark:text-zinc-600"
                          aria-hidden
                        >
                          |
                        </span>
                        <SummaryPillButton
                          active={summaryPillFilter === "repeat"}
                          onClick={() => applySummaryPillFilter("repeat")}
                          disabled={isPending}
                          tone="amber"
                          ariaLabel={`Show ${summary.repeated} students set to repeat`}
                        >
                          {summary.repeated} Repeat
                        </SummaryPillButton>
                      </>
                    )}
                    <span
                      className="hidden text-slate-300 sm:inline dark:text-zinc-600"
                      aria-hidden
                    >
                      |
                    </span>
                    <SummaryPillButton
                      active={summaryPillFilter === "graduate"}
                      onClick={() => applySummaryPillFilter("graduate")}
                      disabled={isPending}
                      tone="violet"
                      ariaLabel={`Show ${summary.graduated} students set to graduate`}
                    >
                      {summary.graduated} Graduate
                      {summary.graduated === 1 ? "" : "s"}
                    </SummaryPillButton>
                    {searchQuery.trim() ||
                    resultsFilter !== "all" ||
                    summaryPillFilter !== "all" ? (
                      <>
                        <span
                          className="hidden text-slate-300 sm:inline dark:text-zinc-600"
                          aria-hidden
                        >
                          |
                        </span>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                          {filteredStudents.length} Shown
                        </span>
                      </>
                    ) : null}
                  </div>
                  {promotionReadinessPercent != null ? (
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
                      {promotionReadinessPercent}% ready for promotion
                    </p>
                  ) : null}
                </div>

                <div>
                  <span className={SECTION_HEADING_CLASS}>Bulk Actions</span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
                        {DECISION_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedIds.size > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5 dark:border-zinc-700/80 dark:bg-zinc-800/40">
                    <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                      {selectedIds.size} student
                      {selectedIds.size === 1 ? "" : "s"} selected
                    </span>
                    <span className="text-xs text-slate-400 dark:text-zinc-500">
                      Apply:
                    </span>
                    {(
                      ["promote", "repeat", "graduate"] as PromotionDecision[]
                    ).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDecisionForIds(selectedIds, d)}
                        disabled={isPending}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
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
                    No students found for the selected view.
                  </p>
                ) : (
                  <>
                    {selectedCountLabel ? (
                      <p className="mb-2 text-xs font-medium text-slate-600 dark:text-zinc-400">
                        {selectedCountLabel}
                      </p>
                    ) : null}

                    <div className="mb-2 flex items-center gap-2 sm:hidden">
                      <input
                        ref={selectAllMobileRef}
                        type="checkbox"
                        checked={pageAllSelected}
                        onChange={() =>
                          pageAllSelected
                            ? clearPageSelection()
                            : selectAllOnPage()
                        }
                        disabled={isPending || pageStudents.length === 0}
                        aria-label="Select all students on this page"
                        className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary"
                      />
                      <span className="sr-only">Select all on this page</span>
                    </div>

                    <div className="space-y-3 sm:hidden">
                      {pageStudents.map((s) => {
                        const avgLabel =
                          s.term2AveragePercent != null
                            ? `${s.term2AveragePercent}%`
                            : "—";
                        const parentLabel = parentAccessLabel(
                          s.term2ReportCardStatus
                        );
                        const reviewStatus = promotionReviewStatus(
                          s,
                          minAverageGrade
                        );
                        const meetsMinimum =
                          minAverageGrade != null &&
                          s.term2AveragePercent != null &&
                          s.term2AveragePercent >= minAverageGrade;
                        const avgTone =
                          s.term2AveragePercent == null
                            ? "text-slate-500 dark:text-zinc-400"
                            : minAverageGrade == null
                              ? "text-slate-800 dark:text-zinc-200"
                              : meetsMinimum
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-amber-800 dark:text-amber-200";
                        return (
                          <div
                            key={s.id}
                            className={`rounded-xl border border-slate-200 p-3 dark:border-zinc-700 ${
                              selectedIds.has(s.id)
                                ? "bg-[rgb(var(--school-primary-rgb)/0.06)]"
                                : "bg-white dark:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(s.id)}
                                onChange={() => toggleSelected(s.id)}
                                disabled={isPending}
                                aria-label={`Select ${s.full_name}`}
                                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-school-primary focus:ring-school-primary"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {s.full_name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
                                  {s.admission_number?.trim() || "—"}
                                </p>
                                <StudentPromotionStatus
                                  parentLabel={parentLabel}
                                  reviewStatus={reviewStatus}
                                />
                                <p
                                  className={`mt-2 text-sm font-medium tabular-nums ${avgTone}`}
                                >
                                  Term 2 avg: {avgLabel}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <PromotionDecisionSelect
                                student={s}
                                value={s.decision}
                                onChange={(d) => setDecision(s.id, d)}
                                minAverageGrade={minAverageGrade}
                                disabled={isPending}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden rounded-xl border border-slate-200 dark:border-zinc-700 sm:block">
                      <table className="w-full table-fixed text-left text-sm">
                        <colgroup>
                          <col className="w-8" />
                          <col className="min-w-[220px]" />
                          <col className="w-[120px]" />
                          <col className="w-[100px]" />
                          <col className="w-[240px]" />
                        </colgroup>
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                          <tr>
                            <th
                              className="w-8 px-1.5 py-2.5 align-middle"
                              scope="col"
                            >
                              <input
                                ref={selectAllDesktopRef}
                                type="checkbox"
                                checked={pageAllSelected}
                                onChange={() =>
                                  pageAllSelected
                                    ? clearPageSelection()
                                    : selectAllOnPage()
                                }
                                disabled={isPending || pageStudents.length === 0}
                                aria-label="Select all students on this page"
                                className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary"
                              />
                            </th>
                            <th className="min-w-[220px] px-2 py-2.5" scope="col">
                              Name
                            </th>
                            <th
                              className="w-[120px] px-2 py-2.5"
                              scope="col"
                            >
                              Admission
                            </th>
                            <th
                              className="w-[100px] px-2 py-2.5 text-center"
                              scope="col"
                            >
                              Term 2 Avg
                            </th>
                            <th
                              className="w-[240px] max-w-[240px] px-2 py-2.5"
                              scope="col"
                            >
                              Decision
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {pageStudents.map((s) => {
                            const parentLabel = parentAccessLabel(
                              s.term2ReportCardStatus
                            );
                            const reviewStatus = promotionReviewStatus(
                              s,
                              minAverageGrade
                            );
                            const meetsMinimum =
                              minAverageGrade != null &&
                              s.term2AveragePercent != null &&
                              s.term2AveragePercent >= minAverageGrade;
                            const avgTone =
                              s.term2AveragePercent == null
                                ? "text-slate-500 dark:text-zinc-400"
                                : minAverageGrade == null
                                  ? "text-slate-800 dark:text-zinc-200"
                                  : meetsMinimum
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-amber-800 dark:text-amber-200";
                            return (
                              <tr
                                key={s.id}
                                className={
                                  selectedIds.has(s.id)
                                    ? "bg-[rgb(var(--school-primary-rgb)/0.06)]"
                                    : undefined
                                }
                              >
                                <td className="px-1.5 py-2.5 align-top">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(s.id)}
                                    onChange={() => toggleSelected(s.id)}
                                    disabled={isPending}
                                    aria-label={`Select ${s.full_name}`}
                                    className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary"
                                  />
                                </td>
                                <td className="min-w-[220px] px-2 py-2.5 align-top">
                                  <p
                                    className="line-clamp-2 font-medium leading-snug text-slate-900 dark:text-white"
                                    title={s.full_name}
                                  >
                                    {s.full_name}
                                  </p>
                                  <StudentPromotionStatus
                                    parentLabel={parentLabel}
                                    reviewStatus={reviewStatus}
                                  />
                                </td>
                                <td className="w-[120px] px-2 py-2.5 align-top">
                                  <span
                                    className="block truncate text-slate-600 dark:text-zinc-400"
                                    title={
                                      s.admission_number?.trim() || undefined
                                    }
                                  >
                                    {s.admission_number?.trim() || "—"}
                                  </span>
                                </td>
                                <td
                                  className={`w-[100px] px-2 py-2.5 text-center align-top text-sm font-medium tabular-nums ${avgTone}`}
                                >
                                  <span
                                    className="block truncate"
                                    title={
                                      s.term2AveragePercent == null
                                        ? "Results not yet available"
                                        : `${s.term2AveragePercent}%`
                                    }
                                  >
                                    {s.term2AveragePercent != null
                                      ? `${s.term2AveragePercent}%`
                                      : "—"}
                                  </span>
                                </td>
                                <td className="w-[240px] max-w-[240px] px-2 py-2.5 align-top">
                                  <PromotionDecisionSelect
                                    student={s}
                                    value={s.decision}
                                    onChange={(d) => setDecision(s.id, d)}
                                    minAverageGrade={minAverageGrade}
                                    disabled={isPending}
                                  />
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

              <div
                className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:px-6"
                role="status"
                aria-label="Promotion outcome summary"
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug">
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    Promotion Outcome:
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {summary.promoted} Promoted
                  </span>
                  <span
                    className="text-slate-300 dark:text-zinc-600"
                    aria-hidden
                  >
                    •
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {summary.repeated} Repeating
                  </span>
                  <span
                    className="text-slate-300 dark:text-zinc-600"
                    aria-hidden
                  >
                    •
                  </span>
                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                    {summary.graduated} Graduating
                  </span>
                </p>
              </div>
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

    <SubjectCompatibilityModal
      open={compatibilityModalOpen}
      mode={compatibilityModalMode}
      result={compatibilityResult}
      onClose={() => {
        if (isPending) return;
        setCompatibilityModalOpen(false);
        setCompatibilityResult(null);
      }}
      onContinue={() => executePromotion(true)}
      isContinuing={isPending}
    />
    </>
  );
}

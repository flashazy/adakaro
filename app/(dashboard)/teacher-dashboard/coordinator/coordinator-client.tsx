"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  Mail,
  Printer,
  Search,
  Users,
  X,
} from "lucide-react";
import { GRADEBOOK_MAJOR_EXAM_TYPE_VALUES } from "@/lib/gradebook-major-exams";
import {
  downloadBulkReportCardsPdf,
  downloadReportCardPdf,
} from "../report-cards/components/ReportCardPDF";
import { ReportCardPreview } from "../report-cards/components/ReportCardPreview";
import { REPORT_TERM_OPTIONS } from "../report-cards/constants";
import {
  MAJOR_EXAM_LABELS,
  type CoordinatorClassOverview,
  type CoordinatorOverview,
  type CoordinatorReportCardItem,
  type MajorExamStatus,
} from "./types";
import {
  generateReportCardsForClassAction,
  shareCoordinatorReportCardAction,
  type CoordinatorGenerateState,
  type CoordinatorShareState,
} from "./actions";
import {
  SCHOOL_LEVEL_DESCRIPTIONS,
  SCHOOL_LEVEL_LABELS,
  type SchoolLevel,
} from "@/lib/school-level";

function SchoolLevelBadge({ level }: { level: SchoolLevel }) {
  const isSecondary = level === "secondary";
  return (
    <span
      title={SCHOOL_LEVEL_DESCRIPTIONS[level]}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        isSecondary
          ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
          : "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
      }`}
    >
      {SCHOOL_LEVEL_LABELS[level]}
      <span className="text-[10px] font-normal normal-case opacity-80">
        {isSecondary ? "(best 7)" : "(avg %)"}
      </span>
    </span>
  );
}

const STATUS_LABELS: Record<CoordinatorReportCardItem["status"], string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

const STATUS_STYLES: Record<CoordinatorReportCardItem["status"], string> = {
  draft:
    "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
  pending_review:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  changes_requested:
    "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
};

function safeFileName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "report-card";
}

function academicYearDropdownValues(): string[] {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1].map(String);
}

/** Items per page for the in-card subject and student tables. */
const COORDINATOR_PAGE_SIZE = 5;

/** Compact "Showing X–Y of N label" line shown above paginated tables. */
function PageInfo({
  total,
  page,
  pageSize,
  noun,
}: {
  total: number;
  page: number;
  pageSize: number;
  noun: { singular: string; plural: string };
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const label = total === 1 ? noun.singular : noun.plural;
  return (
    <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
      Showing {start}–{end} of {total} {label}
    </p>
  );
}

/** Previous / numbered / Next pagination control. */
function PaginationControls({
  page,
  pageCount,
  onChange,
  ariaLabel,
}: {
  page: number;
  pageCount: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  if (pageCount <= 1) return null;

  // Build a compact numeric range. For up to 7 pages we just list them all;
  // beyond that we show the first, last, current and immediate neighbours with
  // ellipses, which is plenty for the coordinator dashboard's typical sizes.
  const pages: (number | "…")[] = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < pageCount - 2) pages.push("…");
    pages.push(pageCount);
  }

  const btnBase =
    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-medium transition";
  const btnIdle =
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";
  const btnActive =
    "border-indigo-500 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-600";
  const btnDisabled =
    "cursor-not-allowed opacity-50";

  return (
    <nav
      className="mt-3 flex flex-wrap items-center justify-end gap-1.5"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={`${btnBase} ${btnIdle} ${page <= 1 ? btnDisabled : ""}`}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        <span className="ml-0.5">Previous</span>
      </button>
      {pages.map((p, idx) =>
        p === "…" ? (
          <span
            key={`gap-${idx}`}
            className="px-1 text-xs text-slate-400 dark:text-zinc-500"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${btnBase} ${p === page ? btnActive : btnIdle}`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        className={`${btnBase} ${btnIdle} ${page >= pageCount ? btnDisabled : ""}`}
      >
        <span className="mr-0.5">Next</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </nav>
  );
}

/** Search box used above the subject table and the student report card list. */
function SearchBox({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative mt-3 max-w-sm">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
      />
    </div>
  );
}

function renderExamStatusBadge(status: MajorExamStatus) {
  if (status.state === "missing") {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
        Not created
      </span>
    );
  }
  const { studentsScored, rosterSize } = status;
  const complete = rosterSize > 0 && studentsScored >= rosterSize;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        complete
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
      }`}
    >
      {studentsScored}/{rosterSize || "—"} scored
    </span>
  );
}

interface CoordinatorDashboardClientProps {
  overview: CoordinatorOverview;
  term: "Term 1" | "Term 2";
  academicYear: string;
}

export function CoordinatorDashboardClient({
  overview,
  term,
  academicYear,
}: CoordinatorDashboardClientProps) {
  const router = useRouter();

  const changePeriod = (next: { term?: string; year?: string }) => {
    const sp = new URLSearchParams();
    sp.set("term", next.term ?? term);
    sp.set("year", next.year ?? academicYear);
    router.push(`/teacher-dashboard/coordinator?${sp.toString()}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="whitespace-nowrap text-slate-700 dark:text-zinc-300">
              Term
            </span>
            <select
              value={term}
              onChange={(e) => changePeriod({ term: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white sm:w-56"
            >
              {REPORT_TERM_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="whitespace-nowrap text-slate-700 dark:text-zinc-300">
              Academic year
            </span>
            <select
              value={academicYear}
              onChange={(e) => changePeriod({ year: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white sm:w-40"
            >
              {academicYearDropdownValues().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {overview.classes.map((klass) => (
        <CoordinatorClassCard
          key={klass.classId}
          klass={klass}
          term={term}
          academicYear={academicYear}
        />
      ))}
    </div>
  );
}

function CoordinatorClassCard({
  klass,
  term,
  academicYear,
}: {
  klass: CoordinatorClassOverview;
  term: "Term 1" | "Term 2";
  academicYear: string;
}) {
  const approvedCards = useMemo(
    () => klass.reportCards.filter((r) => r.status === "approved"),
    [klass.reportCards]
  );

  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Subjects sorted alphabetically (case-insensitive) before any filter/page
  // logic runs. The data layer already sorts, but we re-sort defensively so a
  // future change there can't silently break the UI ordering — this is also
  // the source of truth for the chips above the table, which now reuse it.
  const sortedSubjects = useMemo(
    () =>
      [...klass.subjects].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [klass.subjects]
  );

  // Search + pagination state for the major exam submission status table.
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectPage, setSubjectPage] = useState(1);

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return sortedSubjects;
    return sortedSubjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [sortedSubjects, subjectSearch]);

  const subjectPageCount = Math.max(
    1,
    Math.ceil(filteredSubjects.length / COORDINATOR_PAGE_SIZE)
  );
  // Clamp the current page back into range whenever the filtered list shrinks
  // (e.g. user types a search term that drops total pages below the active one).
  useEffect(() => {
    if (subjectPage > subjectPageCount) setSubjectPage(subjectPageCount);
  }, [subjectPage, subjectPageCount]);
  // Reset to page 1 whenever the search term changes — otherwise the user can
  // type a filter that has only 1 page of results while still sitting on page 3.
  useEffect(() => {
    setSubjectPage(1);
  }, [subjectSearch]);

  const visibleSubjects = useMemo(() => {
    const start = (subjectPage - 1) * COORDINATOR_PAGE_SIZE;
    return filteredSubjects.slice(start, start + COORDINATOR_PAGE_SIZE);
  }, [filteredSubjects, subjectPage]);

  // Report cards sorted alphabetically by student name before filter+paginate.
  // The data layer already sorts these but this guarantees the UI invariant.
  const sortedReportCards = useMemo(
    () =>
      [...klass.reportCards].sort((a, b) =>
        a.studentName.localeCompare(b.studentName, undefined, {
          sensitivity: "base",
        })
      ),
    [klass.reportCards]
  );

  // Search + pagination state for the per-class student report cards list.
  const [studentSearch, setStudentSearch] = useState("");
  const [studentPage, setStudentPage] = useState(1);

  const filteredReportCards = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return sortedReportCards;
    return sortedReportCards.filter((r) =>
      r.studentName.toLowerCase().includes(q)
    );
  }, [sortedReportCards, studentSearch]);

  const studentPageCount = Math.max(
    1,
    Math.ceil(filteredReportCards.length / COORDINATOR_PAGE_SIZE)
  );
  useEffect(() => {
    if (studentPage > studentPageCount) setStudentPage(studentPageCount);
  }, [studentPage, studentPageCount]);
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearch]);

  const visibleReportCards = useMemo(() => {
    const start = (studentPage - 1) * COORDINATOR_PAGE_SIZE;
    return filteredReportCards.slice(start, start + COORDINATOR_PAGE_SIZE);
  }, [filteredReportCards, studentPage]);

  const handleBulkPrint = () => {
    if (approvedCards.length === 0) return;
    downloadBulkReportCardsPdf(
      approvedCards.map((r) => r.preview),
      safeFileName(`${klass.className}-${klass.academicYear}`)
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {klass.className}
            </h2>
            <SchoolLevelBadge level={klass.schoolLevel} />
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/40"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden />
              Generate Report Cards
            </button>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600 dark:text-zinc-400">
            <Users className="h-4 w-4" aria-hidden />
            {klass.studentCount} active student
            {klass.studentCount === 1 ? "" : "s"} · Academic year{" "}
            {klass.academicYear}
          </p>
        </div>
        {approvedCards.length > 0 ? (
          <button
            type="button"
            onClick={handleBulkPrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download all approved
          </button>
        ) : null}
      </header>

      {showGenerateModal ? (
        <GenerateReportCardsModal
          classId={klass.classId}
          className={klass.className}
          studentCount={klass.studentCount}
          schoolLevel={klass.schoolLevel}
          term={term}
          academicYear={academicYear}
          onClose={() => setShowGenerateModal(false)}
        />
      ) : null}

      <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Subjects taught
          </h3>
          {klass.subjects.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              No subjects are mapped to this class yet. Ask the school
              administrator to assign subjects in Manage Subjects.
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {sortedSubjects.map((s) => (
                <li
                  key={`${klass.classId}-${s.name}`}
                  className="rounded-md bg-indigo-50 px-2 py-0.5 text-sm font-medium text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Report card summary
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
              <dt className="text-xs text-slate-500 dark:text-zinc-400">
                Total
              </dt>
              <dd className="text-lg font-semibold text-slate-900 dark:text-white">
                {klass.reportCards.length}
              </dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <dt className="text-xs text-emerald-700 dark:text-emerald-300">
                Approved
              </dt>
              <dd className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                {approvedCards.length}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-5 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Major exam submission status
        </h3>
        {klass.subjects.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            Add subjects to this class to track exam submissions.
          </p>
        ) : (
          <>
            <SearchBox
              value={subjectSearch}
              onChange={setSubjectSearch}
              placeholder="Search subjects..."
              ariaLabel={`Search subjects in ${klass.className}`}
            />
            <PageInfo
              total={filteredSubjects.length}
              page={subjectPage}
              pageSize={COORDINATOR_PAGE_SIZE}
              noun={{ singular: "subject", plural: "subjects" }}
            />
            {filteredSubjects.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                No subjects match &ldquo;{subjectSearch}&rdquo;.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/60">
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        Subject
                      </th>
                      {GRADEBOOK_MAJOR_EXAM_TYPE_VALUES.map((et) => (
                        <th
                          key={et}
                          className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300"
                        >
                          {MAJOR_EXAM_LABELS[et]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                    {visibleSubjects.map((s) => (
                      <tr
                        key={`${klass.classId}-${s.name}-exams`}
                        className="bg-white dark:bg-zinc-900"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-slate-900 dark:text-white">
                          {s.name}
                        </td>
                        {GRADEBOOK_MAJOR_EXAM_TYPE_VALUES.map((et) => (
                          <td key={et} className="whitespace-nowrap px-3 py-2">
                            {renderExamStatusBadge(s.examStatus[et])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationControls
              page={subjectPage}
              pageCount={subjectPageCount}
              onChange={setSubjectPage}
              ariaLabel={`Subject pagination for ${klass.className}`}
            />
          </>
        )}
      </div>

      <div className="border-t border-slate-100 px-6 py-5 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Student report cards
        </h3>
        {klass.reportCards.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
            No report cards exist for this class in the selected term and
            academic year yet.
          </p>
        ) : (
          <>
            <SearchBox
              value={studentSearch}
              onChange={setStudentSearch}
              placeholder="Search students by name..."
              ariaLabel={`Search students in ${klass.className}`}
            />
            <PageInfo
              total={filteredReportCards.length}
              page={studentPage}
              pageSize={COORDINATOR_PAGE_SIZE}
              noun={{ singular: "student", plural: "students" }}
            />
            {filteredReportCards.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                No students match &ldquo;{studentSearch}&rdquo;.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200 dark:divide-zinc-700">
                {visibleReportCards.map((item) => (
                  <ReportCardRow
                    key={item.reportCardId}
                    item={item}
                    className={klass.className}
                    academicYear={klass.academicYear}
                  />
                ))}
              </ul>
            )}
            <PaginationControls
              page={studentPage}
              pageCount={studentPageCount}
              onChange={setStudentPage}
              ariaLabel={`Student pagination for ${klass.className}`}
            />
          </>
        )}
      </div>
    </section>
  );
}

function ReportCardRow({
  item,
  className,
  academicYear,
}: {
  item: CoordinatorReportCardItem;
  className: string;
  academicYear: string;
}) {
  const [shareState, shareAction, sharePending] =
    useActionState<CoordinatorShareState | null, FormData>(
      shareCoordinatorReportCardAction,
      null
    );
  const [showShare, setShowShare] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [email, setEmail] = useState(item.parentEmail ?? "");

  const disabled = item.status !== "approved";

  const handleDownload = () => {
    if (disabled) return;
    downloadReportCardPdf(
      item.preview,
      safeFileName(`${item.studentName}-${className}-${academicYear}`)
    );
  };

  const openShareFromPreview = () => {
    setShowPreview(false);
    setShowShare(true);
  };

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 dark:text-white">
          {item.studentName}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[item.status]}`}
          >
            {STATUS_LABELS[item.status]}
          </span>
          {item.parentEmail ? (
            <span className="ml-2">Parent: {item.parentEmail}</span>
          ) : (
            <span className="ml-2 italic">No parent email on file</span>
          )}
        </p>
        {showShare ? (
          <form action={shareAction} className="mt-3 space-y-2">
            <input
              type="hidden"
              name="report_card_id"
              value={item.reportCardId}
            />
            <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
              Send to
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                name="parent_email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              />
              <button
                type="submit"
                disabled={sharePending}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {sharePending ? "Sending…" : "Send email"}
              </button>
              <button
                type="button"
                onClick={() => setShowShare(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
            {shareState?.ok === true ? (
              <p className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                {shareState.message}
              </p>
            ) : null}
            {shareState && shareState.ok === false ? (
              <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
                {shareState.error}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          title="Preview the full report card"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Preview
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={disabled}
          title={
            disabled
              ? "Only approved report cards can be printed or shared."
              : "Download PDF"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          Print
        </button>
        <button
          type="button"
          onClick={() => setShowShare((v) => !v)}
          disabled={disabled}
          title={
            disabled
              ? "Only approved report cards can be shared."
              : "Email to parent"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Share
        </button>
      </div>
      {showPreview ? (
        <ReportCardPreviewModal
          item={item}
          disabled={disabled}
          onClose={() => setShowPreview(false)}
          onPrint={handleDownload}
          onShare={openShareFromPreview}
        />
      ) : null}
    </li>
  );
}

function ReportCardPreviewModal({
  item,
  disabled,
  onClose,
  onPrint,
  onShare,
}: {
  item: CoordinatorReportCardItem;
  disabled: boolean;
  onClose: () => void;
  onPrint: () => void;
  onShare: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coordinator-preview-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:static print:bg-transparent print:p-0"
    >
      <div className="my-6 w-full max-w-5xl rounded-xl bg-white shadow-2xl dark:bg-zinc-900 print:my-0 print:max-w-full print:shadow-none">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-zinc-800 print:hidden">
          <div className="min-w-0">
            <h3
              id="coordinator-preview-title"
              className="text-sm font-semibold text-slate-900 dark:text-white"
            >
              {item.studentName}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              {STATUS_LABELS[item.status]} · {item.preview.term} ·{" "}
              {item.preview.academicYear}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrint}
              disabled={disabled}
              title={
                disabled
                  ? "Only approved report cards can be printed."
                  : "Download PDF"
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print
            </button>
            <button
              type="button"
              onClick={onShare}
              disabled={disabled}
              title={
                disabled
                  ? "Only approved report cards can be shared."
                  : "Email to parent"
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Share
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close preview"
              aria-label="Close preview"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Close
            </button>
          </div>
        </header>
        <div className="bg-slate-100 p-4 dark:bg-zinc-950 print:bg-white print:p-0">
          <ReportCardPreview data={item.preview} viewer="coordinator" />
        </div>
      </div>
    </div>
  );
}

function GenerateReportCardsModal({
  classId,
  className,
  studentCount,
  schoolLevel,
  term,
  academicYear,
  onClose,
}: {
  classId: string;
  className: string;
  studentCount: number;
  schoolLevel: SchoolLevel;
  term: "Term 1" | "Term 2";
  academicYear: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    CoordinatorGenerateState | null,
    FormData
  >(generateReportCardsForClassAction, null);

  useEffect(() => {
    if (state?.ok === true) {
      router.refresh();
    }
  }, [state, router]);

  const studentsLabel = `${studentCount} student${
    studentCount === 1 ? "" : "s"
  }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-report-cards-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
          <h3
            id="generate-report-cards-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Generate Report Cards
          </h3>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-slate-700 dark:text-zinc-300">
          {state?.ok === true ? (
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              {state.message}
              {state.studentsMissingAllScores > 0 ? (
                <p className="mt-1 text-xs">
                  {state.studentsMissingAllScores} student
                  {state.studentsMissingAllScores === 1 ? "" : "s"} had no
                  exam scores yet — those cards were created empty so the
                  teacher can fill them in.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p>
                This will create report cards for all {studentsLabel} in{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {className}
                </span>{" "}
                using existing exam scores for{" "}
                <span className="font-medium">{term}</span>, academic year{" "}
                <span className="font-medium">{academicYear}</span>. Continue?
              </p>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                <SchoolLevelBadge level={schoolLevel} />
                <span>
                  {schoolLevel === "secondary"
                    ? "Ranking uses total marks of the best 7 subjects per student."
                    : "Ranking uses each student's average across all subjects."}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Students who already have a report card for this term and year
                will be skipped — existing cards are never overwritten.
              </p>
            </>
          )}
          {state?.ok === false ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
              {state.error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
          {state?.ok === true ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Close
            </button>
          ) : (
            <form action={formAction} className="flex items-center gap-2">
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="term" value={term} />
              <input
                type="hidden"
                name="academic_year"
                value={academicYear}
              />
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {pending ? "Generating…" : "Generate"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { formatCurrency } from "@/lib/currency";
import { tanzaniaGradeBadgeClass } from "@/lib/tanzania-grades";
import type {
  ProfileAttendanceSummary,
  ProfileGradebookScoreRow,
  ProfilePaymentRow,
  ProfileReportCardBlock,
  ProfileReportCardSubjectLine,
} from "@/lib/student-profile-auto-data";
import type { Database, StudentFeeBalance } from "@/types/supabase";
import {
  upsertStudentAcademicRecord,
  upsertStudentDisciplineRecord,
  upsertStudentFinanceRecord,
  upsertStudentHealthRecord,
} from "./profile-actions";
import { StudentProfileAvatar } from "./student-profile-avatar";
import { StudentRecordAttachmentsPanel } from "./student-record-attachments-panel";
import type { StudentProfileViewerFlags } from "./student-profile-viewer";

type AcademicRow =
  Database["public"]["Tables"]["student_academic_records"]["Row"];
type DisciplineRow =
  Database["public"]["Tables"]["student_discipline_records"]["Row"];
type HealthRow = Database["public"]["Tables"]["student_health_records"]["Row"];
type FinanceRow =
  Database["public"]["Tables"]["student_finance_records"]["Row"];
type AttachmentRow =
  Database["public"]["Tables"]["student_record_attachments"]["Row"];

type TabId = "academic" | "discipline" | "health" | "finance";

const tabLabels: { id: TabId; label: string }[] = [
  { id: "academic", label: "Academic" },
  { id: "discipline", label: "Discipline" },
  { id: "health", label: "Health" },
  { id: "finance", label: "Finance" },
];

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

/**
 * Page size shared by the Assignment scores table and the Report cards
 * subject-comment list on the Student Profile page. Five rows keeps the
 * sections short so admins can scan them at a glance.
 */
const PROFILE_SECTION_PAGE_SIZE = 5;

function incidentLabel(t: DisciplineRow["incident_type"]): string {
  const map: Record<DisciplineRow["incident_type"], string> = {
    warning: "Warning",
    detention: "Detention",
    suspension: "Suspension",
    expulsion: "Expulsion",
    other: "Other",
  };
  return map[t] ?? t;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-zinc-300";

export interface ProfileScholarshipLine {
  id: string;
  academic_year: number;
  term: FinanceRow["term"];
  amount: number;
  scholarship_type: string | null;
}

interface StudentProfileClientProps {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  className: string | null;
  avatarUrl: string | null;
  viewer: StudentProfileViewerFlags;
  recordAttachments: AttachmentRow[];
  academicRecords: AcademicRow[];
  disciplineRecords: DisciplineRow[];
  healthRecords: HealthRow[];
  financeRecords: FinanceRow[];
  currencyCode: string;
  profileGradebookScores: ProfileGradebookScoreRow[];
  profileAttendanceSummary: ProfileAttendanceSummary;
  profileReportCards: ProfileReportCardBlock[];
  profilePayments: ProfilePaymentRow[];
  profileFeeBalances: StudentFeeBalance[];
  profileScholarshipLines: ProfileScholarshipLine[];
}

export function StudentProfileClient({
  studentId,
  studentName,
  admissionNumber,
  className,
  avatarUrl,
  viewer,
  recordAttachments,
  academicRecords,
  disciplineRecords,
  healthRecords,
  financeRecords,
  currencyCode,
  profileGradebookScores,
  profileAttendanceSummary,
  profileReportCards,
  profilePayments,
  profileFeeBalances,
  profileScholarshipLines,
}: StudentProfileClientProps) {
  const router = useRouter();
  const visible = viewer.visibleTabs;
  const [tab, setTab] = useState<TabId>(() => {
    if (visible.includes("academic")) return "academic";
    return visible[0] ?? "academic";
  });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!visible.includes(tab)) {
      setTab(visible[0] ?? "academic");
    }
  }, [visible, tab]);

  const attachmentsByRecord = useMemo(() => {
    const m = new Map<string, AttachmentRow[]>();
    for (const a of recordAttachments) {
      const key = `${a.record_type}:${a.record_id}`;
      const list = m.get(key) ?? [];
      list.push(a);
      m.set(key, list);
    }
    return m;
  }, [recordAttachments]);
  const [formError, setFormError] = useState<string | null>(null);

  const money = (n: number) => formatCurrency(n, currencyCode);
  const totalFeeBalance = useMemo(
    () => profileFeeBalances.reduce((s, r) => s + Number(r.balance), 0),
    [profileFeeBalances]
  );

  const [academicModal, setAcademicModal] = useState<AcademicRow | "new" | null>(
    null
  );
  const [disciplineModal, setDisciplineModal] = useState<
    DisciplineRow | "new" | null
  >(null);
  const [healthModal, setHealthModal] = useState<HealthRow | "new" | null>(null);
  const [financeModal, setFinanceModal] = useState<FinanceRow | "new" | null>(
    null
  );

  const defaultYear = useMemo(() => new Date().getFullYear(), []);

  // -------------------------------------------------------------------------
  // Pagination + search for the Academic-tab "Assignment scores" table and
  // the Report-cards subject-comment list. Five rows per page each, with the
  // page reset to zero whenever the search query changes (so admins always
  // see results from the first page after typing a new filter).
  // -------------------------------------------------------------------------
  const [scoresSearch, setScoresSearch] = useState("");
  const [scoresPage, setScoresPage] = useState(0);
  const [commentsSearch, setCommentsSearch] = useState("");
  const [commentsPage, setCommentsPage] = useState(0);

  useEffect(() => {
    setScoresPage(0);
  }, [scoresSearch]);
  useEffect(() => {
    setCommentsPage(0);
  }, [commentsSearch]);

  const filteredGradebookScores = useMemo(() => {
    const q = scoresSearch.trim().toLowerCase();
    if (!q) return profileGradebookScores;
    return profileGradebookScores.filter(
      (row) =>
        row.subject.toLowerCase().includes(q) ||
        row.assignmentTitle.toLowerCase().includes(q)
    );
  }, [profileGradebookScores, scoresSearch]);

  const scoresTotalPages = Math.max(
    1,
    Math.ceil(filteredGradebookScores.length / PROFILE_SECTION_PAGE_SIZE)
  );
  const safeScoresPage = Math.min(scoresPage, scoresTotalPages - 1);
  const paginatedGradebookScores = useMemo(
    () =>
      filteredGradebookScores.slice(
        safeScoresPage * PROFILE_SECTION_PAGE_SIZE,
        (safeScoresPage + 1) * PROFILE_SECTION_PAGE_SIZE
      ),
    [filteredGradebookScores, safeScoresPage]
  );

  // Flatten every (report card, subject line) pair so a single search box and
  // pager can drive the entire "Report cards and teacher comments" section.
  // Cards that don't have any subject lines on the current page are hidden,
  // but each card that does keeps its own header/admin-note context.
  type FlatReportCommentLine = {
    card: ProfileReportCardBlock;
    line: ProfileReportCardSubjectLine;
    idx: number;
  };

  const flatReportCommentLines = useMemo<FlatReportCommentLine[]>(() => {
    const out: FlatReportCommentLine[] = [];
    for (const card of profileReportCards) {
      card.subjectLines.forEach((line, idx) => {
        out.push({ card, line, idx });
      });
    }
    return out;
  }, [profileReportCards]);

  const filteredReportCommentLines = useMemo(() => {
    const q = commentsSearch.trim().toLowerCase();
    if (!q) return flatReportCommentLines;
    return flatReportCommentLines.filter((entry) =>
      entry.line.subject.toLowerCase().includes(q)
    );
  }, [flatReportCommentLines, commentsSearch]);

  const commentsTotalPages = Math.max(
    1,
    Math.ceil(filteredReportCommentLines.length / PROFILE_SECTION_PAGE_SIZE)
  );
  const safeCommentsPage = Math.min(commentsPage, commentsTotalPages - 1);
  const paginatedReportCommentLines = useMemo(
    () =>
      filteredReportCommentLines.slice(
        safeCommentsPage * PROFILE_SECTION_PAGE_SIZE,
        (safeCommentsPage + 1) * PROFILE_SECTION_PAGE_SIZE
      ),
    [filteredReportCommentLines, safeCommentsPage]
  );

  const commentLinesByCard = useMemo(() => {
    const map = new Map<string, FlatReportCommentLine[]>();
    for (const entry of paginatedReportCommentLines) {
      const list = map.get(entry.card.id) ?? [];
      list.push(entry);
      map.set(entry.card.id, list);
    }
    return map;
  }, [paginatedReportCommentLines]);

  function closeAllModals() {
    setAcademicModal(null);
    setDisciplineModal(null);
    setHealthModal(null);
    setFinanceModal(null);
    setFormError(null);
  }

  function submitForm(
    action: (fd: FormData) => Promise<{ error?: string; success?: true }>
  ) {
    return (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const res = await action(fd);
        if (res.error) {
          setFormError(res.error);
          return;
        }
        closeAllModals();
        router.refresh();
      });
    };
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <StudentProfileAvatar
          studentId={studentId}
          studentName={studentName}
          admissionNumber={admissionNumber}
          classLabel={className}
          avatarUrl={avatarUrl}
          canChangePhoto={viewer.canChangeAvatar}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-zinc-800">
        {tabLabels
          .filter((t) => visible.includes(t.id))
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "academic" && visible.includes("academic") && (
        <section className="space-y-8" aria-labelledby="academic-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="academic-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Academic
            </h2>
            {viewer.canManageStaffRecords ? (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setAcademicModal("new");
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Add record
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Assignment scores (from gradebook)
            </h3>
            {profileGradebookScores.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No assignment scores recorded for this student yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
                  <label
                    htmlFor="profile-scores-search"
                    className="sr-only"
                  >
                    Search assignment scores by subject or assignment
                  </label>
                  <input
                    id="profile-scores-search"
                    type="search"
                    value={scoresSearch}
                    onChange={(e) => setScoresSearch(e.target.value)}
                    placeholder="Search by subject or assignment…"
                    className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </div>

                {filteredGradebookScores.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      No scores match your search.
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Try a different subject or assignment name.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-800">
                        <thead className="bg-slate-50 dark:bg-zinc-800/80">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                              Subject
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                              Assignment
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                              Score
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                              Grade
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                              Term
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {paginatedGradebookScores.map((row) => (
                            <tr key={row.id}>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-900 dark:text-zinc-100">
                                {row.subject}
                              </td>
                              <td className="max-w-[200px] px-3 py-2 text-slate-700 dark:text-zinc-300">
                                {row.assignmentTitle}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-800 dark:text-zinc-200">
                                {row.scoreDisplay}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-2 ${tanzaniaGradeBadgeClass(row.grade)}`}
                              >
                                {row.grade}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-zinc-400">
                                {row.termLabel}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row dark:border-zinc-800">
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Showing{" "}
                        {filteredGradebookScores.length === 0
                          ? 0
                          : safeScoresPage * PROFILE_SECTION_PAGE_SIZE + 1}
                        –
                        {Math.min(
                          (safeScoresPage + 1) * PROFILE_SECTION_PAGE_SIZE,
                          filteredGradebookScores.length
                        )}{" "}
                        of {filteredGradebookScores.length} score
                        {filteredGradebookScores.length === 1 ? "" : "s"}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={safeScoresPage <= 0}
                          onClick={() =>
                            setScoresPage((p) => Math.max(0, p - 1))
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                          Page {safeScoresPage + 1} / {scoresTotalPages}
                        </span>
                        <button
                          type="button"
                          disabled={safeScoresPage >= scoresTotalPages - 1}
                          onClick={() =>
                            setScoresPage((p) =>
                              Math.min(scoresTotalPages - 1, p + 1)
                            )
                          }
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Attendance ({profileAttendanceSummary.termLabel})
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Counts are school days in the current term (one mark per day when
              multiple subjects are recorded).
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Present
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
                  {profileAttendanceSummary.presentDays}{" "}
                  <span className="text-sm font-normal text-emerald-800/90 dark:text-emerald-200/90">
                    days
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-zinc-400">
                  Absent
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-zinc-100">
                  {profileAttendanceSummary.absentDays}{" "}
                  <span className="text-sm font-normal text-slate-600 dark:text-zinc-400">
                    days
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Late
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">
                  {profileAttendanceSummary.lateDays}{" "}
                  <span className="text-sm font-normal text-amber-800/90 dark:text-amber-200/90">
                    days
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Report cards and teacher comments
            </h3>
            {profileReportCards.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No report cards for this student yet.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <label
                    htmlFor="profile-report-comments-search"
                    className="sr-only"
                  >
                    Search report card comments by subject
                  </label>
                  <input
                    id="profile-report-comments-search"
                    type="search"
                    value={commentsSearch}
                    onChange={(e) => setCommentsSearch(e.target.value)}
                    placeholder="Search by subject…"
                    className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                  />
                </div>

                {filteredReportCommentLines.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      No subject comments match your search.
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Try a different subject name.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {profileReportCards
                      .filter((rc) => commentLinesByCard.has(rc.id))
                      .map((rc) => {
                        const linesForCard =
                          commentLinesByCard.get(rc.id) ?? [];
                        return (
                          <li
                            key={rc.id}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {rc.academicYear} · {rc.term}
                              </p>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {rc.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            {rc.submittedAt ? (
                              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                Submitted {formatDateOnly(rc.submittedAt)}
                              </p>
                            ) : null}
                            {rc.adminNote ? (
                              <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                                <span className="font-medium text-slate-800 dark:text-zinc-200">
                                  Admin note:{" "}
                                </span>
                                {rc.adminNote}
                              </p>
                            ) : null}
                            <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                              {linesForCard.map(({ line, idx }) => (
                                <li
                                  key={`${rc.id}-${line.subject}-${idx}`}
                                  className="text-sm text-slate-700 dark:text-zinc-300"
                                >
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    {line.subject}
                                  </span>
                                  {line.letterGrade || line.calculatedGrade ? (
                                    <span className="ml-2 text-slate-600 dark:text-zinc-400">
                                      (
                                      {line.letterGrade ??
                                        line.calculatedGrade ??
                                        (line.scorePercent != null
                                          ? `${line.scorePercent}%`
                                          : "—")}
                                      )
                                    </span>
                                  ) : line.scorePercent != null ? (
                                    <span className="ml-2 text-slate-600 dark:text-zinc-400">
                                      ({line.scorePercent}%)
                                    </span>
                                  ) : null}
                                  {line.comment ? (
                                    <p className="mt-0.5 text-slate-600 dark:text-zinc-400">
                                      {line.comment}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                  </ul>
                )}

                <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Showing{" "}
                    {filteredReportCommentLines.length === 0
                      ? 0
                      : safeCommentsPage * PROFILE_SECTION_PAGE_SIZE + 1}
                    –
                    {Math.min(
                      (safeCommentsPage + 1) * PROFILE_SECTION_PAGE_SIZE,
                      filteredReportCommentLines.length
                    )}{" "}
                    of {filteredReportCommentLines.length} subject
                    {filteredReportCommentLines.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeCommentsPage <= 0}
                      onClick={() =>
                        setCommentsPage((p) => Math.max(0, p - 1))
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">
                      Page {safeCommentsPage + 1} / {commentsTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeCommentsPage >= commentsTotalPages - 1}
                      onClick={() =>
                        setCommentsPage((p) =>
                          Math.min(commentsTotalPages - 1, p + 1)
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-6 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Staff academic notes
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Use &quot;Add record&quot; for extra context (special needs, narrative
              notes) alongside the data above.
            </p>
            {academicRecords.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No staff academic notes yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {academicRecords.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {r.academic_year} · {r.term}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                          Updated {formatTs(r.updated_at)}
                        </p>
                      </div>
                      {viewer.canManageStaffRecords ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            setAcademicModal(r);
                          }}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                    {r.notes ? (
                      <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                        <span className="font-medium text-slate-800 dark:text-zinc-200">
                          Notes:{" "}
                        </span>
                        {r.notes}
                      </p>
                    ) : null}
                    {r.special_needs ? (
                      <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                        <span className="font-medium text-slate-800 dark:text-zinc-200">
                          Special needs:{" "}
                        </span>
                        {r.special_needs}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "discipline" && visible.includes("discipline") && (
        <section className="space-y-4" aria-labelledby="discipline-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="discipline-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Discipline
            </h2>
            {viewer.canManageStaffRecords ? (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setDisciplineModal("new");
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Add record
              </button>
            ) : null}
          </div>
          {disciplineRecords.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No discipline incidents recorded.
            </p>
          ) : (
            <ul className="space-y-3">
              {disciplineRecords.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatDateOnly(r.incident_date)} ·{" "}
                        {incidentLabel(r.incident_type)}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500 dark:text-zinc-400">
                        Status: {r.status} · Logged {formatTs(r.created_at)}
                      </p>
                    </div>
                    {viewer.canManageStaffRecords ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFormError(null);
                          setDisciplineModal(r);
                        }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                    {r.description}
                  </p>
                  {r.action_taken ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                      <span className="font-medium">Action: </span>
                      {r.action_taken}
                    </p>
                  ) : null}
                  {r.resolved_date ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Resolved {formatDateOnly(r.resolved_date)}
                    </p>
                  ) : null}
                  <StudentRecordAttachmentsPanel
                    studentId={studentId}
                    recordType="discipline"
                    recordId={r.id}
                    attachments={
                      attachmentsByRecord.get(`discipline:${r.id}`) ?? []
                    }
                    canUpload={viewer.canUploadAttachments}
                    canDelete={viewer.canDeleteAttachments}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "health" && visible.includes("health") && (
        <section className="space-y-4" aria-labelledby="health-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="health-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Health
            </h2>
            {viewer.canManageStaffRecords ? (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setHealthModal("new");
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Add record
              </button>
            ) : null}
          </div>
          {healthRecords.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No health information on file.
            </p>
          ) : (
            <ul className="space-y-3">
              {healthRecords.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {r.condition}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        {r.severity ? `${r.severity} · ` : ""}
                        Updated {formatTs(r.updated_at)}
                      </p>
                    </div>
                    {viewer.canManageStaffRecords ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFormError(null);
                          setHealthModal(r);
                        }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                  {r.medication ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium">Medication: </span>
                      {r.medication}
                    </p>
                  ) : null}
                  {r.special_care_notes ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium">Care notes: </span>
                      {r.special_care_notes}
                    </p>
                  ) : null}
                  {r.emergency_contact_phone ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      <span className="font-medium">Emergency phone: </span>
                      {r.emergency_contact_phone}
                    </p>
                  ) : null}
                  <StudentRecordAttachmentsPanel
                    studentId={studentId}
                    recordType="health"
                    recordId={r.id}
                    attachments={attachmentsByRecord.get(`health:${r.id}`) ?? []}
                    canUpload={viewer.canUploadAttachments}
                    canDelete={viewer.canDeleteAttachments}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "finance" && visible.includes("finance") && (
        <section className="space-y-8" aria-labelledby="finance-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="finance-heading"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Finance
            </h2>
            {viewer.canManageStaffRecords ? (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setFinanceModal("new");
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Add record
              </button>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Current fee balance
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
              Totals from assigned fees minus payments recorded for this student.
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              {money(totalFeeBalance)}{" "}
              <span className="text-sm font-normal text-slate-500 dark:text-zinc-400">
                total outstanding
              </span>
            </p>
            {profileFeeBalances.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                No fee balance rows for this student (no active fee structures or
                not yet billed).
              </p>
            ) : (
              <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm dark:border-zinc-800">
                {profileFeeBalances.map((row) => (
                  <li
                    key={`${row.student_id}-${row.fee_structure_id}-${row.term}`}
                    className="flex flex-wrap justify-between gap-2 text-slate-700 dark:text-zinc-300"
                  >
                    <span>
                      {row.fee_name}{" "}
                      <span className="text-slate-500 dark:text-zinc-500">
                        · {row.term}
                      </span>
                    </span>
                    <span className="font-mono font-medium">
                      {money(Number(row.balance))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Scholarships (from staff finance snapshots)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Amounts recorded by staff on term finance snapshots below.
            </p>
            {profileScholarshipLines.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No scholarship amounts recorded.
              </p>
            ) : (
              <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                {profileScholarshipLines.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap justify-between gap-2 text-sm text-slate-700 dark:text-zinc-300"
                  >
                    <span>
                      {s.academic_year} · {s.term}
                      {s.scholarship_type ? (
                        <span className="text-slate-500 dark:text-zinc-500">
                          {" "}
                          · {s.scholarship_type}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                      {money(s.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Payment history
            </h3>
            {profilePayments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No payments recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-800">
                  <thead className="bg-slate-50 dark:bg-zinc-800/80">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        Receipt
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-zinc-300">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {profilePayments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-800 dark:text-zinc-200">
                          {formatDateOnly(p.payment_date)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-900 dark:text-zinc-100">
                          {money(p.amount)}
                        </td>
                        <td className="px-3 py-2">
                          {p.receipt_number ? (
                            <Link
                              href={`/dashboard/receipts/${p.id}`}
                              className="font-mono text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                            >
                              {p.receipt_number}
                            </Link>
                          ) : (
                            <Link
                              href={`/dashboard/receipts/${p.id}`}
                              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                            >
                              View
                            </Link>
                          )}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-slate-600 dark:text-zinc-400">
                          {p.reference_number ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-6 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Staff term finance snapshots
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Manual term notes and balances admins add to supplement the
              figures above.
            </p>
            {financeRecords.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No term finance snapshots yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {financeRecords.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {r.academic_year} · {r.term}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                          Updated {formatTs(r.updated_at)}
                        </p>
                      </div>
                      {viewer.canManageStaffRecords ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            setFinanceModal(r);
                          }}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                      Fee balance:{" "}
                      <span className="font-mono font-medium">
                        {money(Number(r.fee_balance))}
                      </span>
                      {" · "}
                      Scholarship:{" "}
                      <span className="font-mono font-medium">
                        {money(Number(r.scholarship_amount))}
                      </span>
                    </p>
                    {r.scholarship_type ? (
                      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                        Type: {r.scholarship_type}
                      </p>
                    ) : null}
                    {r.payment_notes ? (
                      <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
                        {r.payment_notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Academic modal */}
      {academicModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setAcademicModal(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="academic-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="academic-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {academicModal === "new" ? "Add academic record" : "Edit academic record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentAcademicRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {academicModal !== "new" ? (
                <input type="hidden" name="id" value={academicModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="academic_year">
                  Academic year
                </label>
                <input
                  id="academic_year"
                  name="academic_year"
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  defaultValue={
                    academicModal === "new"
                      ? defaultYear
                      : academicModal.academic_year
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="academic_term">
                  Term
                </label>
                <select
                  id="academic_term"
                  name="term"
                  required
                  defaultValue={
                    academicModal === "new" ? "Term 1" : academicModal.term
                  }
                  className={inputClass}
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="academic_notes">
                  Notes
                </label>
                <textarea
                  id="academic_notes"
                  name="notes"
                  rows={3}
                  defaultValue={
                    academicModal === "new" ? "" : academicModal.notes ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="academic_sn">
                  Special needs
                </label>
                <textarea
                  id="academic_sn"
                  name="special_needs"
                  rows={2}
                  defaultValue={
                    academicModal === "new"
                      ? ""
                      : academicModal.special_needs ?? ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAcademicModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Discipline modal */}
      {disciplineModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) {
              setDisciplineModal(null);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discipline-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="discipline-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {disciplineModal === "new"
                  ? "Add discipline record"
                  : "Edit discipline record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentDisciplineRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {disciplineModal !== "new" ? (
                <input type="hidden" name="id" value={disciplineModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="incident_date">
                  Incident date
                </label>
                <input
                  id="incident_date"
                  name="incident_date"
                  type="date"
                  required
                  defaultValue={
                    disciplineModal === "new"
                      ? new Date().toISOString().slice(0, 10)
                      : disciplineModal.incident_date.slice(0, 10)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="incident_type">
                  Type
                </label>
                <select
                  id="incident_type"
                  name="incident_type"
                  required
                  defaultValue={
                    disciplineModal === "new"
                      ? "warning"
                      : disciplineModal.incident_type
                  }
                  className={inputClass}
                >
                  <option value="warning">Warning</option>
                  <option value="detention">Detention</option>
                  <option value="suspension">Suspension</option>
                  <option value="expulsion">Expulsion</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="discipline_desc">
                  Description
                </label>
                <textarea
                  id="discipline_desc"
                  name="description"
                  required
                  rows={3}
                  defaultValue={
                    disciplineModal === "new" ? "" : disciplineModal.description
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="action_taken">
                  Action taken
                </label>
                <textarea
                  id="action_taken"
                  name="action_taken"
                  rows={2}
                  defaultValue={
                    disciplineModal === "new"
                      ? ""
                      : disciplineModal.action_taken ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="discipline_status">
                  Status
                </label>
                <select
                  id="discipline_status"
                  name="status"
                  required
                  defaultValue={
                    disciplineModal === "new" ? "pending" : disciplineModal.status
                  }
                  className={inputClass}
                >
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="appealed">Appealed</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="resolved_date">
                  Resolved date (optional)
                </label>
                <input
                  id="resolved_date"
                  name="resolved_date"
                  type="date"
                  defaultValue={
                    disciplineModal !== "new" && disciplineModal.resolved_date
                      ? disciplineModal.resolved_date.slice(0, 10)
                      : ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDisciplineModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Health modal */}
      {healthModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setHealthModal(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="health-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="health-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {healthModal === "new" ? "Add health record" : "Edit health record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentHealthRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {healthModal !== "new" ? (
                <input type="hidden" name="id" value={healthModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="health_condition">
                  Condition
                </label>
                <input
                  id="health_condition"
                  name="condition"
                  required
                  defaultValue={
                    healthModal === "new" ? "" : healthModal.condition
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="health_severity">
                  Severity
                </label>
                <select
                  id="health_severity"
                  name="severity"
                  defaultValue={
                    healthModal === "new" ? "" : healthModal.severity ?? ""
                  }
                  className={inputClass}
                >
                  <option value="">Not specified</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="health_medication">
                  Medication
                </label>
                <textarea
                  id="health_medication"
                  name="medication"
                  rows={2}
                  defaultValue={
                    healthModal === "new" ? "" : healthModal.medication ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="health_care">
                  Special care notes
                </label>
                <textarea
                  id="health_care"
                  name="special_care_notes"
                  rows={2}
                  defaultValue={
                    healthModal === "new"
                      ? ""
                      : healthModal.special_care_notes ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="health_emergency">
                  Emergency contact phone
                </label>
                <input
                  id="health_emergency"
                  name="emergency_contact_phone"
                  type="tel"
                  defaultValue={
                    healthModal === "new"
                      ? ""
                      : healthModal.emergency_contact_phone ?? ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setHealthModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Finance modal */}
      {financeModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setFinanceModal(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="finance-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {financeModal === "new" ? "Add finance record" : "Edit finance record"}
              </h3>
            </div>
            <form
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentFinanceRecord)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {financeModal !== "new" ? (
                <input type="hidden" name="id" value={financeModal.id} />
              ) : null}
              <div>
                <label className={labelClass} htmlFor="finance_year">
                  Academic year
                </label>
                <input
                  id="finance_year"
                  name="academic_year"
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  defaultValue={
                    financeModal === "new"
                      ? defaultYear
                      : financeModal.academic_year
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="finance_term">
                  Term
                </label>
                <select
                  id="finance_term"
                  name="term"
                  required
                  defaultValue={
                    financeModal === "new" ? "Term 1" : financeModal.term
                  }
                  className={inputClass}
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="fee_balance">
                  Fee balance
                </label>
                <input
                  id="fee_balance"
                  name="fee_balance"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={
                    financeModal === "new" ? "0" : String(financeModal.fee_balance)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="scholarship_amount">
                  Scholarship amount
                </label>
                <input
                  id="scholarship_amount"
                  name="scholarship_amount"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  defaultValue={
                    financeModal === "new"
                      ? "0"
                      : String(financeModal.scholarship_amount)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="scholarship_type">
                  Scholarship type
                </label>
                <input
                  id="scholarship_type"
                  name="scholarship_type"
                  type="text"
                  defaultValue={
                    financeModal === "new"
                      ? ""
                      : financeModal.scholarship_type ?? ""
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="payment_notes">
                  Payment notes
                </label>
                <textarea
                  id="payment_notes"
                  name="payment_notes"
                  rows={2}
                  defaultValue={
                    financeModal === "new"
                      ? ""
                      : financeModal.payment_notes ?? ""
                  }
                  className={inputClass}
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFinanceModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}

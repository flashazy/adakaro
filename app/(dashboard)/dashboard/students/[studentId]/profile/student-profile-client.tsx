"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { formatCurrency } from "@/lib/currency";
import { formatPaymentRecordedAtInSchoolZone } from "@/lib/school-timezone";
import { tanzaniaGradeBadgeClass } from "@/lib/tanzania-grades";
import type {
  ProfileAttendanceSummary,
  ProfileFinanceNoteRow,
  ProfileGradebookScoreRow,
  ProfilePaymentRow,
  ProfileReportCardBlock,
  ProfileReportCardSubjectLine,
} from "@/lib/student-profile-auto-data";
import type { Database, StudentFeeBalance } from "@/types/supabase";
import {
  upsertStudentAcademicRecord,
  upsertStudentDisciplineRecord,
  upsertStudentFinanceNote,
  upsertStudentHealthRecord,
} from "./profile-actions";
import { RecordStudentPaymentModal } from "@/components/dashboard/record-student-payment-modal";
import { StudentProfileAvatar } from "./student-profile-avatar";
import { StudentRecordAttachmentsPanel } from "./student-record-attachments-panel";
import type { StudentProfileViewerFlags } from "./student-profile-viewer";
import { ProfilePaymentHistory } from "./profile-payment-history";
import { StudentProfileFullReportCardButton } from "./student-profile-full-report-card-button";
import type { ProfilePaymentListQuery } from "@/lib/student-profile-payments-list";

type AcademicRow =
  Database["public"]["Tables"]["student_academic_records"]["Row"];
type DisciplineRow =
  Database["public"]["Tables"]["student_discipline_records"]["Row"];
type HealthRow = Database["public"]["Tables"]["student_health_records"]["Row"];
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

const FINANCE_NOTES_INLINE_LIMIT = 5;
const FINANCE_NOTES_VIEW_ALL_PAGE_SIZE = 8;

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
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white";
/** Same as `inputClass` but without `mt-1` (e.g. search in a flex header). */
const inputClassNoTopMargin = inputClass.replace("mt-1 ", "");
const labelClass = "block text-sm font-medium text-slate-700 dark:text-zinc-300";

interface StudentProfileClientProps {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  className: string | null;
  avatarUrl: string | null;
  viewer: StudentProfileViewerFlags;
  initialActiveTab: TabId;
  recordAttachments: AttachmentRow[];
  academicRecords: AcademicRow[];
  disciplineRecords: DisciplineRow[];
  healthRecords: HealthRow[];
  profileFinanceNotes: ProfileFinanceNoteRow[];
  currencyCode: string;
  profileGradebookScores: ProfileGradebookScoreRow[];
  profileAttendanceSummary: ProfileAttendanceSummary;
  profileReportCards: ProfileReportCardBlock[];
  profilePayments: ProfilePaymentRow[];
  profilePaymentTotal: number;
  profilePaymentListQuery: ProfilePaymentListQuery;
  profileFeeBalances: StudentFeeBalance[];
  displayTimezone: string;
  /** "Name (Role)" for the Add note preview (server still sets created_by on save). */
  currentUserFinanceNoteRecorderLine: string;
}

export function StudentProfileClient({
  studentId,
  studentName,
  admissionNumber,
  className,
  avatarUrl,
  viewer,
  initialActiveTab,
  recordAttachments,
  academicRecords,
  disciplineRecords,
  healthRecords,
  profileFinanceNotes,
  currencyCode,
  profileGradebookScores,
  profileAttendanceSummary,
  profileReportCards,
  profilePayments,
  profilePaymentTotal,
  profilePaymentListQuery,
  profileFeeBalances,
  displayTimezone,
  currentUserFinanceNoteRecorderLine,
}: StudentProfileClientProps) {
  const router = useRouter();
  const visible = viewer.visibleTabs;
  const [tab, setTab] = useState<TabId>(() => {
    if (visible.includes(initialActiveTab)) {
      return initialActiveTab;
    }
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
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
  const [financeNoteModal, setFinanceNoteModal] = useState<
    ProfileFinanceNoteRow | "new" | null
  >(null);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [financeNotesViewAllOpen, setFinanceNotesViewAllOpen] = useState(false);
  const [viewAllNotesSearch, setViewAllNotesSearch] = useState("");
  const [viewAllNotesPage, setViewAllNotesPage] = useState(0);

  const defaultYear = useMemo(() => new Date().getFullYear(), []);

  const inlineFinanceNotes = useMemo(
    () => profileFinanceNotes.slice(0, FINANCE_NOTES_INLINE_LIMIT),
    [profileFinanceNotes]
  );

  const viewAllNotesFiltered = useMemo(() => {
    const q = viewAllNotesSearch.trim().toLowerCase();
    if (!q) return profileFinanceNotes;
    return profileFinanceNotes.filter((n) =>
      n.body.toLowerCase().includes(q)
    );
  }, [profileFinanceNotes, viewAllNotesSearch]);

  const viewAllNotesTotalPages = Math.max(
    1,
    Math.ceil(viewAllNotesFiltered.length / FINANCE_NOTES_VIEW_ALL_PAGE_SIZE)
  );
  const viewAllSafePage = Math.min(
    viewAllNotesPage,
    viewAllNotesTotalPages - 1
  );
  const viewAllPaginatedNotes = useMemo(
    () =>
      viewAllNotesFiltered.slice(
        viewAllSafePage * FINANCE_NOTES_VIEW_ALL_PAGE_SIZE,
        (viewAllSafePage + 1) * FINANCE_NOTES_VIEW_ALL_PAGE_SIZE
      ),
    [viewAllNotesFiltered, viewAllSafePage]
  );

  useEffect(() => {
    setViewAllNotesPage(0);
  }, [viewAllNotesSearch]);

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
    setFinanceNoteModal(null);
    setFinanceNotesViewAllOpen(false);
    setRecordPaymentOpen(false);
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
                  ? "bg-school-primary text-white shadow-sm"
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
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
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
                    className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
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
                  <StudentProfileFullReportCardButton
                    studentId={studentId}
                    reportCardRows={profileReportCards.map((rc) => ({
                      id: rc.id,
                      term: rc.term,
                      academicYear: rc.academicYear,
                    }))}
                  />
                </div>
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
                    className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
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
                            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
                              {linesForCard.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-zinc-400">
                                  No subject rows for this report card.
                                </p>
                              ) : (
                                <div className="overflow-x-auto -mx-1">
                                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-800">
                                    <thead className="bg-slate-50 text-left text-xs font-medium text-slate-600 dark:bg-zinc-800/80 dark:text-zinc-400">
                                      <tr>
                                        <th className="px-2 py-2 pr-3">
                                          Subject
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-2">
                                          {rc.exam1ColumnLabel}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-2">
                                          {rc.exam2ColumnLabel}
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-2">
                                          Average %
                                        </th>
                                        <th className="whitespace-nowrap px-2 py-2">
                                          Grade
                                        </th>
                                        <th className="min-w-[10rem] px-2 py-2">
                                          Teacher comment
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                      {linesForCard.map(({ line, idx }) => (
                                        <tr key={`${rc.id}-${line.subject}-${idx}`}>
                                          <td className="px-2 py-2 font-medium text-slate-900 dark:text-zinc-100">
                                            {line.subject}
                                          </td>
                                          <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 dark:text-zinc-200">
                                            {line.exam1Pct}
                                          </td>
                                          <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 dark:text-zinc-200">
                                            {line.exam2Pct}
                                          </td>
                                          <td className="whitespace-nowrap px-2 py-2 font-mono text-slate-800 dark:text-zinc-200">
                                            {line.averagePct}
                                          </td>
                                          <td
                                            className={`whitespace-nowrap px-2 py-2 ${tanzaniaGradeBadgeClass(
                                              line.grade
                                            )}`}
                                          >
                                            {line.grade}
                                          </td>
                                          <td className="max-w-[20rem] px-2 py-2 text-slate-700 dark:text-zinc-300">
                                            {line.comment}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
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
                          className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
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
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
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
                        className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
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
                className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105"
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
                        className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
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
          <h2
            id="finance-heading"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Finance
          </h2>

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

          {viewer.canRecordPayment ? (
            <div>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setRecordPaymentOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105"
              >
                Record payment
              </button>
            </div>
          ) : null}

          <ProfilePaymentHistory
            payments={profilePayments}
            total={profilePaymentTotal}
            page={profilePaymentListQuery.page}
            per={profilePaymentListQuery.per}
            q={profilePaymentListQuery.q}
            from={profilePaymentListQuery.from}
            to={profilePaymentListQuery.to}
            displayTimezone={displayTimezone}
            currencyCode={currencyCode}
          />

          <div className="space-y-3 border-t border-slate-200 pt-6 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              Staff finance notes
            </h3>
            {viewer.canRecordPayment ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setFinanceNoteModal("new");
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Add note
                </button>
              </div>
            ) : null}
            {profileFinanceNotes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                No notes yet
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {inlineFinanceNotes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 flex-1 text-sm text-slate-800 dark:text-zinc-200">
                          <span className="font-medium text-slate-700 dark:text-zinc-300">
                            Recorded by {n.recorded_by_line}
                          </span>
                          <span className="text-slate-400"> · </span>
                          <span className="tabular-nums text-slate-600 dark:text-zinc-400">
                            {formatPaymentRecordedAtInSchoolZone(
                              n.updated_at,
                              displayTimezone
                            )}
                          </span>
                        </p>
                        {viewer.canRecordPayment ? (
                          <button
                            type="button"
                            onClick={() => {
                              setFormError(null);
                              setFinanceNoteModal(n);
                            }}
                            className="shrink-0 text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
                          >
                            Edit
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                        {n.body}
                      </p>
                    </li>
                  ))}
                </ul>
                {profileFinanceNotes.length > FINANCE_NOTES_INLINE_LIMIT ? (
                  <p>
                    <button
                      type="button"
                      onClick={() => {
                        setViewAllNotesSearch("");
                        setViewAllNotesPage(0);
                        setFinanceNotesViewAllOpen(true);
                      }}
                      className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
                    >
                      View all notes
                    </button>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </section>
      )}

      <RecordStudentPaymentModal
        key={recordPaymentOpen ? "on" : "off"}
        open={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        studentId={studentId}
        profileFeeBalances={profileFeeBalances}
        currencyCode={currencyCode}
      />

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
                  className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
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
                  className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
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
                  className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Finance — view all notes (search + pagination) */}
      {financeNotesViewAllOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) {
              setFinanceNotesViewAllOpen(false);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-view-all-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="finance-view-all-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                All finance notes
              </h3>
            </div>
            <div className="space-y-4 border-b border-slate-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
              <label className="sr-only" htmlFor="finance_view_all_search">
                Search notes
              </label>
              <input
                id="finance_view_all_search"
                type="search"
                value={viewAllNotesSearch}
                onChange={(e) => setViewAllNotesSearch(e.target.value)}
                placeholder="Search notes…"
                className={inputClassNoTopMargin}
              />
            </div>
            <div className="px-4 py-4 sm:px-5">
              {viewAllNotesFiltered.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {viewAllNotesSearch.trim()
                    ? "No notes match your search."
                    : "No notes yet."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {viewAllPaginatedNotes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 flex-1 text-sm text-slate-800 dark:text-zinc-200">
                          <span className="font-medium text-slate-700 dark:text-zinc-300">
                            Recorded by {n.recorded_by_line}
                          </span>
                          <span className="text-slate-400"> · </span>
                          <span className="tabular-nums text-slate-600 dark:text-zinc-400">
                            {formatPaymentRecordedAtInSchoolZone(
                              n.updated_at,
                              displayTimezone
                            )}
                          </span>
                        </p>
                        {viewer.canRecordPayment ? (
                          <button
                            type="button"
                            onClick={() => {
                              setFormError(null);
                              setFinanceNotesViewAllOpen(false);
                              setFinanceNoteModal(n);
                            }}
                            className="shrink-0 text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
                          >
                            Edit
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                        {n.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {viewAllNotesFiltered.length > FINANCE_NOTES_VIEW_ALL_PAGE_SIZE ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    Page {viewAllSafePage + 1} of {viewAllNotesTotalPages} ·{" "}
                    {viewAllNotesFiltered.length} note
                    {viewAllNotesFiltered.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={viewAllSafePage <= 0}
                      onClick={() =>
                        setViewAllNotesPage((p) => Math.max(0, p - 1))
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        viewAllSafePage >= viewAllNotesTotalPages - 1
                      }
                      onClick={() =>
                        setViewAllNotesPage((p) =>
                          Math.min(viewAllNotesTotalPages - 1, p + 1)
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setFinanceNotesViewAllOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Finance staff notes — add / edit */}
      {financeNoteModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setFinanceNoteModal(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-note-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5">
              <h3
                id="finance-note-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {financeNoteModal === "new" ? "Add note" : "Edit note"}
              </h3>
            </div>
            <form
              key={
                financeNoteModal === "new" ? "fn-new" : financeNoteModal.id
              }
              className="space-y-4 px-4 py-4 sm:px-5"
              onSubmit={submitForm(upsertStudentFinanceNote)}
            >
              <input type="hidden" name="student_id" value={studentId} />
              {financeNoteModal !== "new" ? (
                <input type="hidden" name="id" value={financeNoteModal.id} />
              ) : null}
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  Recorded by:
                </span>{" "}
                {financeNoteModal === "new"
                  ? currentUserFinanceNoteRecorderLine
                  : financeNoteModal.recorded_by_line}
                <span className="text-slate-400"> (automatic)</span>
              </p>
              <div>
                <label
                  className="sr-only"
                  htmlFor="finance_note_body"
                >
                  Note
                </label>
                <textarea
                  id="finance_note_body"
                  name="body"
                  required
                  rows={5}
                  placeholder="Write a note…"
                  defaultValue={
                    financeNoteModal === "new" ? "" : financeNoteModal.body
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
                  onClick={() => setFinanceNoteModal(null)}
                  disabled={pending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Back to top"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-school-primary text-white shadow-lg ring-1 ring-slate-900/10 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-school-primary focus:ring-offset-2 dark:ring-zinc-900/30 dark:focus:ring-offset-zinc-900 ${
          showScrollTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <ChevronUp className="h-6 w-6" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

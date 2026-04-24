"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, Printer, Send, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  showAdminErrorToast,
  useOptionalDashboardFeedback,
} from "@/components/dashboard/dashboard-feedback-provider";
import { REPORT_TERM_OPTIONS } from "../report-cards/constants";
import { downloadReportCardPdf } from "../report-cards/components/ReportCardPDF";
import { ReportCardPreview } from "../report-cards/components/ReportCardPreview";
import type { ReportCardStatus } from "../report-cards/report-card-types";
import {
  type CoordinatorClassOverview,
  type CoordinatorReportCardItem,
  type CoordinatorOverview,
} from "./types";
import {
  generateReportCardsForClassAction,
  sendCoordinatorClassReportCardsToParentsAction,
  submitCoordinatorReportCardForReviewAction,
  type CoordinatorGenerateState,
  type CoordinatorSendToParentsState,
  type CoordinatorSubmitReviewState,
} from "./actions";
import { CoordinatorMySignatureCard } from "./coordinator-my-signature-card";
import {
  SECONDARY_BEST_SUBJECT_COUNT,
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

function StatusBadgeWithIcon({
  status,
}: {
  status: ReportCardStatus | "none";
}) {
  if (status === "none") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        <span aria-hidden>—</span> Not generated
      </span>
    );
  }
  const config: Record<
    ReportCardStatus,
    { icon: string; className: string; label: string }
  > = {
    approved: {
      icon: "✅",
      className:
        "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-100",
      label: "Approved",
    },
    pending_review: {
      icon: "⏳",
      className:
        "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100",
      label: "Pending review",
    },
    draft: {
      icon: "📝",
      className:
        "border border-slate-200 bg-slate-100 text-slate-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
      label: "Draft",
    },
    changes_requested: {
      icon: "🔄",
      className:
        "border border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-100",
      label: "Changes requested",
    },
  };
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.className}`}
    >
      <span aria-hidden>{c.icon}</span>
      {c.label}
    </span>
  );
}

function safeFileName(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "report-card"
  );
}

function academicYearDropdownValues(): string[] {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1].map(String);
}

function schoolLevelStatLine(level: SchoolLevel): string {
  if (level === "secondary") {
    return `Secondary (best ${SECONDARY_BEST_SUBJECT_COUNT})`;
  }
  return "Primary (avg %)";
}

function StatsCardRow({
  klass,
  term,
  academicYear,
}: {
  klass: CoordinatorClassOverview;
  term: "Term 1" | "Term 2";
  academicYear: string;
}) {
  const termShort = term === "Term 2" ? "Term 2" : "Term 1";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
        <span className="text-2xl" aria-hidden>
          📊
        </span>
        <div>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {klass.studentCount}
          </p>
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
            Active Students
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
        <span className="text-2xl" aria-hidden>
          🎓
        </span>
        <div>
          <p
            className="text-sm font-semibold text-slate-900 dark:text-white"
            title={SCHOOL_LEVEL_DESCRIPTIONS[klass.schoolLevel]}
          >
            {schoolLevelStatLine(klass.schoolLevel)}
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {SCHOOL_LEVEL_LABELS[klass.schoolLevel]} school
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80">
        <span className="text-2xl" aria-hidden>
          📅
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {termShort} · {academicYear}
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Report period
          </p>
        </div>
      </div>
    </div>
  );
}

function SubmitForApprovalButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/40"
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          Submitting...
        </>
      ) : (
        <>
          <Send className="h-3.5 w-3.5" aria-hidden />
          Submit for approval
        </>
      )}
    </button>
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
  const {
    coordinatorSignatureUrl,
    coordinatorSignatureVersion,
  } = overview;
  const router = useRouter();
  const feedback = useOptionalDashboardFeedback();

  const changePeriod = (next: { term?: string; year?: string }) => {
    const sp = new URLSearchParams();
    sp.set("term", next.term ?? term);
    sp.set("year", next.year ?? academicYear);
    feedback?.startNavigation();
    router.push(`/teacher-dashboard/coordinator?${sp.toString()}`);
  };

  const singleClass = overview.classes.length === 1 ? overview.classes[0] : null;
  const termLongLabel =
    REPORT_TERM_OPTIONS.find((t) => t.value === term)?.label ?? term;
  const subtitle = singleClass
    ? `${singleClass.className.toUpperCase()} · ${termLongLabel} · ${academicYear}`
    : `${termLongLabel} · ${academicYear}`;

  return (
    <div className="space-y-8">
      <header className="space-y-1 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Coordinator Dashboard
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400 sm:text-base">
          {subtitle}
        </p>
      </header>

      {singleClass ? <StatsCardRow klass={singleClass} term={term} academicYear={academicYear} /> : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-zinc-700/80 dark:bg-zinc-900/30 sm:flex-row sm:items-end sm:justify-center sm:gap-6 sm:p-5">
        <label className="flex w-full max-w-xs flex-1 flex-col gap-1.5 text-left text-sm font-medium text-slate-700 dark:text-zinc-300">
          Term
          <select
            value={term}
            onChange={(e) => changePeriod({ term: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {REPORT_TERM_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-full max-w-xs flex-1 flex-col gap-1.5 text-left text-sm font-medium text-slate-700 dark:text-zinc-300">
          Academic year
          <select
            value={academicYear}
            onChange={(e) => changePeriod({ year: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {academicYearDropdownValues().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CoordinatorMySignatureCard
        initialUrl={coordinatorSignatureUrl}
        initialVersion={coordinatorSignatureVersion}
      />

      {overview.classes.map((klass) => (
        <CoordinatorClassCard
          key={klass.classId}
          klass={klass}
          term={term}
          academicYear={academicYear}
          showClassTitle={overview.classes.length > 1}
          includeStats={overview.classes.length > 1}
        />
      ))}
    </div>
  );
}

function CoordinatorClassCard({
  klass,
  term,
  academicYear,
  showClassTitle,
  includeStats,
}: {
  klass: CoordinatorClassOverview;
  term: "Term 1" | "Term 2";
  academicYear: string;
  showClassTitle: boolean;
  includeStats: boolean;
}) {
  const router = useRouter();
  const feedback = useOptionalDashboardFeedback();
  const hasAnyCards = klass.reportCards.length > 0;
  const allHaveCards =
    klass.studentCount > 0 && klass.reportCards.length >= klass.studentCount;
  const reportSettingsHref = `/teacher-dashboard/coordinator/report-settings?classId=${encodeURIComponent(
    klass.classId
  )}&term=${encodeURIComponent(term)}&year=${encodeURIComponent(academicYear)}`;
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSendToParentsModal, setShowSendToParentsModal] = useState(false);
  const [viewRosterOpen, setViewRosterOpen] = useState(true);
  const [previewItem, setPreviewItem] = useState<CoordinatorReportCardItem | null>(
    null
  );
  const [successBannerClosed, setSuccessBannerClosed] = useState(
    () => !allHaveCards
  );
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [submitReviewState, submitReviewAction] = useActionState<
    CoordinatorSubmitReviewState | null,
    FormData
  >(submitCoordinatorReportCardForReviewAction, null);

  useEffect(() => {
    if (submitReviewState?.ok === true) {
      router.refresh();
    }
  }, [submitReviewState, router]);

  useEffect(() => {
    if (submitReviewState == null) return;
    if (submitReviewState.ok === true) {
      toast.success(submitReviewState.message, {
        id: "coordinator-submit-approval",
        duration: 2000,
      });
    } else {
      showAdminErrorToast(submitReviewState.error);
    }
  }, [submitReviewState]);

  useEffect(() => {
    if (!allHaveCards) {
      setSuccessBannerClosed(true);
      return;
    }
    setSuccessBannerClosed(false);
    const t = window.setTimeout(() => setSuccessBannerClosed(true), 5000);
    return () => window.clearTimeout(t);
  }, [allHaveCards, klass.classId, klass.reportCards.length]);

  const showSuccessStrip = allHaveCards && !successBannerClosed;

  const { canSendToParents, showAlreadySent } = useMemo(() => {
    const pending = klass.reportCards.filter(
      (c) => c.status === "pending_review"
    ).length;
    const hasApproved = klass.reportCards.some(
      (c) => c.status === "approved"
    );
    return {
      canSendToParents: hasAnyCards && pending > 0,
      showAlreadySent: hasAnyCards && pending === 0 && hasApproved,
    };
  }, [hasAnyCards, klass.reportCards]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/50">
      <div className="p-4 sm:p-6 lg:p-8">
        {includeStats ? (
          <div className="mb-6 space-y-3">
            {showClassTitle ? (
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {klass.className}
              </h2>
            ) : null}
            <StatsCardRow klass={klass} term={term} academicYear={academicYear} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={reportSettingsHref}
            onClick={() => feedback?.startNavigation()}
            className="inline-flex min-h-[44px] min-w-[10rem] items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          >
            <span aria-hidden>📝</span>
            Report Settings
          </Link>
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex min-h-[44px] min-w-[10rem] items-center justify-center gap-2 rounded-xl bg-school-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 focus-visible:outline focus-visible:ring-2 focus-visible:ring-school-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          >
            <span aria-hidden>📄</span>
            Generate Report Cards
          </button>
          {hasAnyCards ? (
            canSendToParents ? (
              <button
                type="button"
                onClick={() => setShowSendToParentsModal(true)}
                className="inline-flex min-h-[44px] min-w-[10rem] items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-green-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
              >
                <span aria-hidden>📧</span>
                Send to parents
              </button>
            ) : showAlreadySent ? (
              <span
                className="inline-flex min-h-[44px] min-w-[10rem] cursor-default select-none items-center justify-center gap-2 rounded-xl border-2 border-green-200 bg-green-50 px-5 py-2.5 text-sm font-semibold text-green-800 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-100"
                role="status"
                aria-live="polite"
              >
                <span aria-hidden>📧</span>
                Already sent
              </span>
            ) : (
              <button
                type="button"
                disabled
                title="Submit all report cards for head teacher review first."
                className="inline-flex min-h-[44px] min-w-[10rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-500 opacity-80 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500"
              >
                <span aria-hidden>📧</span>
                Send to parents
              </button>
            )
          ) : null}
        </div>

        {showSuccessStrip ? (
          <div
            className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-100 sm:items-center"
            role="status"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200"
              aria-hidden
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium">
              Report cards generated for all {klass.studentCount} students
            </p>
            <button
              type="button"
              onClick={() => setSuccessBannerClosed(true)}
              className="shrink-0 rounded-lg p-1 text-emerald-700/80 transition hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {!allHaveCards && hasAnyCards ? (
          <p
            className="mt-6 text-center text-sm text-slate-600 dark:text-zinc-400"
            role="status"
          >
            Report cards on file: {klass.reportCards.length} of{" "}
            {klass.studentCount} students
          </p>
        ) : null}

        {!hasAnyCards ? (
          <p
            className="mt-6 text-center text-sm text-amber-800 dark:text-amber-200/90"
            role="status"
          >
            No report cards generated for this class and term yet.
          </p>
        ) : null}

        {hasAnyCards ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setViewRosterOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 rounded-t-2xl border border-b-0 border-slate-200 bg-slate-50/80 px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 sm:px-5"
            >
              <span className="text-base">
                <span aria-hidden>📋</span> Report Cards
              </span>
              <span className="text-slate-400" aria-hidden>
                {viewRosterOpen ? "▾" : "▸"}
              </span>
            </button>
            {viewRosterOpen ? (
              <div className="overflow-x-auto rounded-b-2xl border border-slate-200 dark:border-zinc-700">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm sm:min-w-[40rem]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-zinc-600 dark:bg-zinc-800/80">
                      <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Student
                      </th>
                      <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Status
                      </th>
                      <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {klass.classRoster.map((row) => (
                      <tr
                        key={row.studentId}
                        className="border-b border-slate-100 bg-white transition hover:bg-slate-50/90 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/60"
                      >
                        <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">
                          {row.fullName}
                        </td>
                        <td className="px-4 py-3.5 align-middle">
                          {row.item ? (
                            <StatusBadgeWithIcon status={row.item.status} />
                          ) : (
                            <StatusBadgeWithIcon status="none" />
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.item ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPreviewItem(row.item!)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                                >
                                  <Eye className="h-3.5 w-3.5" aria-hidden />
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  disabled={pdfLoadingId === row.item!.reportCardId}
                                  onClick={() => {
                                    const id = row.item!.reportCardId;
                                    setPdfLoadingId(id);
                                    void (async () => {
                                      try {
                                        await downloadReportCardPdf(
                                          row.item!.preview,
                                          safeFileName(
                                            `${row.item!.studentName}-${klass.className}-${academicYear}`
                                          )
                                        );
                                      } catch {
                                        toast.error("Could not generate PDF.");
                                      } finally {
                                        setPdfLoadingId(null);
                                      }
                                    })();
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-80 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                                >
                                  {pdfLoadingId === row.item!.reportCardId ? (
                                    <Loader2
                                      className="h-3.5 w-3.5 shrink-0 animate-spin"
                                      aria-hidden
                                    />
                                  ) : (
                                    <Printer className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                  Download PDF
                                </button>
                                {row.item.status === "draft" ||
                                row.item.status === "changes_requested" ? (
                                  <form
                                    action={submitReviewAction}
                                    className="inline"
                                  >
                                    <input
                                      type="hidden"
                                      name="report_card_id"
                                      value={row.item.reportCardId}
                                    />
                                    <SubmitForApprovalButton />
                                  </form>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-zinc-500">
                                Generate to create a card
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

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

      {showSendToParentsModal ? (
        <SendToParentsModal
          classId={klass.classId}
          term={term}
          academicYear={academicYear}
          onClose={() => setShowSendToParentsModal(false)}
        />
      ) : null}

      {previewItem ? (
        <ParentStyleReportCardModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      ) : null}
    </section>
  );
}

/** Same preview path as the parent portal: `viewer="parent"`. */
function ParentStyleReportCardModal({
  item,
  onClose,
}: {
  item: CoordinatorReportCardItem;
  onClose: () => void;
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
      aria-labelledby="coordinator-parent-preview-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:static print:bg-transparent print:p-0"
    >
      <div className="my-6 w-full max-w-5xl rounded-xl bg-white shadow-2xl dark:bg-zinc-900 print:my-0 print:max-w-full print:shadow-none">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-zinc-800 print:hidden">
          <div className="min-w-0">
            <h3
              id="coordinator-parent-preview-title"
              className="text-sm font-semibold text-slate-900 dark:text-white"
            >
              {item.studentName}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Parent view · {item.preview.term} · {item.preview.academicYear}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close preview"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Close
          </button>
        </header>
        <div className="max-h-[min(80vh,720px)] overflow-y-auto bg-slate-100 p-4 dark:bg-zinc-950 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <ReportCardPreview
            data={item.preview}
            viewer="parent"
            reportCardStatus={item.status}
          />
        </div>
      </div>
    </div>
  );
}

function SendToParentsFormFooter({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center justify-end gap-2">
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
        className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Sending...
          </>
        ) : (
          "Send to parents"
        )}
      </button>
    </div>
  );
}

function SendToParentsModal({
  classId,
  term,
  academicYear,
  onClose,
}: {
  classId: string;
  term: "Term 1" | "Term 2";
  academicYear: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [state, formAction] = useActionState<
    CoordinatorSendToParentsState | null,
    FormData
  >(sendCoordinatorClassReportCardsToParentsAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (state == null) return;
    if (state.ok) {
      toast.success(
        `Report cards sent to parents for ${state.sentCount} students`,
        { id: "coordinator-send-to-parents", duration: 4000 }
      );
      closeRef.current();
    } else {
      showAdminErrorToast(state.error);
    }
  }, [state]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coordinator-send-parents-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
          <h3
            id="coordinator-send-parents-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            Send to parents
          </h3>
        </div>
        <form action={formAction}>
          <div className="space-y-4 px-5 py-4">
            <p className="text-sm text-slate-700 dark:text-zinc-300">
              Send all report cards to parents? This action cannot be undone.
            </p>
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="term" value={term} />
            <input type="hidden" name="academic_year" value={academicYear} />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
            <SendToParentsFormFooter onClose={onClose} />
          </div>
        </form>
      </div>
    </div>
  );
}

function GenerateReportFormFooter({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-2">
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
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-1.5 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Generating...
          </>
        ) : (
          "Generate"
        )}
      </button>
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
  const [state, formAction] = useActionState<
    CoordinatorGenerateState | null,
    FormData
  >(generateReportCardsForClassAction, null);

  useEffect(() => {
    if (state?.ok === true) {
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (state == null) return;
    if (state.ok === true) {
      toast.success(state.message, { id: "coordinator-generate", duration: 5000 });
    } else {
      showAdminErrorToast(state.error);
    }
  }, [state]);

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
            <div>
              {state.studentsMissingAllScores > 0 ? (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
                  {state.studentsMissingAllScores} student
                  {state.studentsMissingAllScores === 1 ? "" : "s"} had no
                  scores in the gradebook — report cards may be incomplete.
                </p>
              ) : null}
              {state.subjectsWithNoExamSetup.length > 0 ? (
                <p
                  className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                  role="alert"
                >
                  No exam scores are set up in the gradebook for:{" "}
                  {state.subjectsWithNoExamSetup.join(", ")}. Add assignments and
                  scores, then run generate again to fill those subjects.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p>
                This will create or update report cards for all {studentsLabel}{" "}
                in{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {className}
                </span>{" "}
                using the gradebook for{" "}
                <span className="font-medium">{term}</span>, {academicYear},
                and the report settings (dates, message, items) for this class.
                Continue?
              </p>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                <SchoolLevelBadge level={schoolLevel} />
                <span>
                  {schoolLevel === "secondary"
                    ? "Ranking uses total marks of the best 7 subjects per student."
                    : "Ranking uses each student's average across all subjects."}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
          {state?.ok === true ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-school-primary px-4 py-1.5 text-sm font-semibold text-white hover:brightness-105"
            >
              Close
            </button>
          ) : (
            <form action={formAction} className="flex items-center justify-end">
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="term" value={term} />
              <input
                type="hidden"
                name="academic_year"
                value={academicYear}
              />
              <GenerateReportFormFooter onClose={onClose} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

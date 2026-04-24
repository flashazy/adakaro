"use client";

import {
  REPORT_CARD_EXAM_LABELS,
  type ReportTermValue,
} from "../constants";
import type { ReportCardPreviewData } from "../report-card-preview-types";
import { gradingScaleDescription } from "@/lib/tanzania-grades";
import {
  formatReportCardCellLabel,
  GradeDisplayFormatToggle,
  useGradeDisplayFormat,
  type GradeDisplayFormat,
} from "@/lib/grade-display-format";
import type { SchoolLevel } from "@/lib/school-level";
import { formatCurrency } from "@/lib/currency";
import {
  formatCoordinatorMessage,
  formatDateRange,
  formatFeeBalanceReminder,
  formatItems,
  formatAttendance,
} from "@/lib/reportFormatter";

export type { ReportCardPreviewData } from "../report-card-preview-types";

function examLabelsForTerm(term: string): { exam1: string; exam2: string } {
  if (term === "Term 1" || term === "Term 2") {
    return REPORT_CARD_EXAM_LABELS[term as ReportTermValue];
  }
  return REPORT_CARD_EXAM_LABELS["Term 1"];
}

/** Header suffix for exam columns based on the chosen display format. */
function columnHeaderSuffix(format: GradeDisplayFormat): string {
  switch (format) {
    case "marks":
      return "(Marks)";
    case "both":
      return "(Marks / %)";
    case "percentage":
    default:
      return "(%)";
  }
}

/** Average column header based on the chosen display format. */
function averageColumnHeader(format: GradeDisplayFormat): string {
  switch (format) {
    case "marks":
      return "Average marks";
    case "both":
      return "Average (Marks / %)";
    case "percentage":
    default:
      return "Average %";
  }
}

/**
 * Render an exam-cell value for the report card. Falls back to the
 * pre-formatted percentage string from the builder when the raw percent isn't
 * available (older snapshots) so existing report cards keep rendering as
 * before regardless of the toggle.
 */
function renderExamCell(
  rawPercent: number | null | undefined,
  fallbackPct: string,
  format: GradeDisplayFormat,
  schoolLevel: SchoolLevel | null | undefined
): string {
  if (rawPercent == null || !Number.isFinite(rawPercent)) {
    if (fallbackPct === "—") return "—";
    return format === "percentage" ? fallbackPct : fallbackPct;
  }
  return formatReportCardCellLabel({
    percent: rawPercent,
    format,
    schoolLevel,
  });
}

/**
 * Roles that can open this preview. Teachers see drafts/pending cards as
 * they're being prepared, so the position/total/school-level summary at the
 * bottom is hidden until a card is fully approved. Coordinators, parents and
 * admins always see the summary because they only ever look at finished
 * report cards.
 */
export type ReportCardPreviewViewer =
  | "teacher"
  | "coordinator"
  | "parent"
  | "admin";

export function ReportCardPreview({
  data,
  viewer = "teacher",
  reportCardStatus = null,
}: {
  data: ReportCardPreviewData;
  /** Defaults to "teacher" (the strictest gate) to keep the preview safe. */
  viewer?: ReportCardPreviewViewer;
  /** Raw `report_cards.status` for the focus student, when known. */
  reportCardStatus?: string | null;
}) {
  const { format: storedFormat, setFormat } = useGradeDisplayFormat();
  const schoolLevel = data.summary?.schoolLevel ?? null;
  // Hide the "Show scores as" toggle for secondary schools — with a max
  // score of 100, marks and percentage are visually identical, so the
  // toggle adds no value. Force the displayed format to "percentage" so a
  // previously-saved preference doesn't leak into a secondary report card.
  const showFormatToggle = schoolLevel === "primary";
  const format: GradeDisplayFormat = showFormatToggle
    ? storedFormat
    : "percentage";
  const { exam1, exam2 } = examLabelsForTerm(data.term);
  const headSuffix = columnHeaderSuffix(format);
  const exam1Head = `${exam1} ${headSuffix}`;
  const exam2Head = `${exam2} ${headSuffix}`;
  const averageHead = averageColumnHeader(format);
  // Only show the "Selected" column when something was actually dropped from
  // the total (e.g. secondary student with >7 subjects). For everyone else
  // every subject already counts so the column would just be visual noise.
  const showSelectedColumn = data.subjects.some((r) => r.selected !== null);

  const formattedNextTermItems =
    data.requiredNextTermItems && data.requiredNextTermItems.length > 0
      ? formatItems(data.requiredNextTermItems)
      : "";

  const attendancePresentDays = data.attendance.present + data.attendance.late;
  const attendanceText = formatAttendance(
    attendancePresentDays,
    data.attendance.absent
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-6 print:shadow-none print:border-slate-300">
      <header className="flex flex-col items-center gap-3 border-b border-slate-200 pb-4 text-center sm:flex-row sm:items-start sm:text-left">
        {data.logoUrl ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-100 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- school logo from Supabase storage */}
            <img
              src={data.logoUrl}
              alt=""
              width={64}
              height={64}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">
            Logo
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {data.schoolName}
          </h1>
          <p className="text-sm font-medium text-slate-600">Student report card</p>
          <p className="mt-1 text-xs text-slate-500">{data.statusLabel}</p>
        </div>
      </header>

      <section className="grid gap-2 text-sm leading-relaxed sm:grid-cols-2">
        <p className="text-gray-700">
          <span className="font-semibold text-slate-800">Student:</span>{" "}
          {data.studentName}
        </p>
        <p className="text-gray-700">
          <span className="font-semibold text-slate-800">Class:</span>{" "}
          {data.className}
        </p>
        <p className="text-gray-700">
          <span className="font-semibold text-slate-800">Term:</span> {data.term}
        </p>
        <p className="text-gray-700">
          <span className="font-semibold text-slate-800">Academic year:</span>{" "}
          {data.academicYear}
        </p>
        <p className="text-gray-700 sm:col-span-2">
          <span className="font-semibold text-slate-800">
            {data.teacherIsCoordinator ? "Class Coordinator:" : "Class teacher:"}
          </span>{" "}
          {data.teacherName}
        </p>
        <p className="text-gray-700 sm:col-span-2">
          <span className="font-semibold text-slate-800">Date issued:</span>{" "}
          {data.dateIssued}
        </p>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800">
            Subject results
          </h2>
          {showFormatToggle ? (
            <GradeDisplayFormatToggle
              value={format}
              onChange={setFormat}
              className="text-slate-700"
            />
          ) : null}
        </div>
        {(() => {
          const anyOv = data.subjects.some(
            (r) => r.exam1Overridden || r.exam2Overridden
          );
          return anyOv ? (
            <p className="mb-2 text-xs text-slate-600">
              * Exam score was changed after the markbook value was used.
            </p>
          ) : null;
        })()}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="border border-slate-600 px-2 py-2">Subject</th>
                <th className="border border-slate-600 px-2 py-2">{exam1Head}</th>
                <th className="border border-slate-600 px-2 py-2">{exam2Head}</th>
                <th className="border border-slate-600 px-2 py-2">{averageHead}</th>
                <th className="border border-slate-600 px-2 py-2">Grade</th>
                <th className="border border-slate-600 px-2 py-2 text-center tabular-nums">
                  Position
                </th>
                <th className="min-w-[10rem] border border-slate-600 px-2 py-2">
                  Teacher comment
                </th>
                {showSelectedColumn ? (
                  <th className="border border-slate-600 px-2 py-2 text-center">
                    Selected
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.subjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={showSelectedColumn ? 8 : 7}
                    className="border border-slate-200 px-2 py-3 text-slate-500"
                  >
                    No subject entries yet.
                  </td>
                </tr>
              ) : (
                data.subjects.map((r) => {
                  // Highlight counted rows in light green so the "best 7" pop
                  // visually; dropped rows stay neutral with a dimmer label.
                  const rowClass =
                    r.selected === true
                      ? "bg-emerald-50/70 print:bg-emerald-50/70"
                      : r.selected === false
                        ? "bg-white text-slate-500"
                        : "odd:bg-white even:bg-slate-50";
                  return (
                    <tr key={r.subject} className={rowClass}>
                      <td className="border border-slate-200 px-2 py-2 font-medium">
                        {r.subject}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 tabular-nums">
                        {renderExamCell(
                          r.exam1PercentRaw,
                          r.exam1Pct,
                          format,
                          schoolLevel
                        )}
                        {r.exam1Overridden ? (
                          <span className="font-semibold text-slate-800" title="Overridden from markbook">
                            *
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 tabular-nums">
                        {renderExamCell(
                          r.exam2PercentRaw,
                          r.exam2Pct,
                          format,
                          schoolLevel
                        )}
                        {r.exam2Overridden ? (
                          <span className="font-semibold text-slate-800" title="Overridden from markbook">
                            *
                          </span>
                        ) : null}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-semibold tabular-nums">
                        {renderExamCell(
                          r.averagePercentRaw,
                          r.averagePct,
                          format,
                          schoolLevel
                        )}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-semibold">
                        {r.grade}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center font-semibold tabular-nums text-slate-800">
                        {r.position}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-slate-700">
                        {r.comment || "—"}
                      </td>
                      {showSelectedColumn ? (
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          {r.selected === true ? (
                            <span
                              className="inline-flex items-center gap-1 font-semibold text-emerald-700"
                              aria-label="Counted toward total score"
                              title="Counted toward total score"
                            >
                              <span aria-hidden>✅</span>
                            </span>
                          ) : r.selected === false ? (
                            <span
                              className="text-xs italic text-slate-500"
                              aria-label="Not counted toward total score"
                              title="Dropped from the best-7 selection"
                            >
                              (dropped)
                            </span>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          Final score per subject = (Exam 1 + Exam 2) ÷ 2 when both are entered.
          Grading: {gradingScaleDescription(data.summary?.schoolLevel)}.
        </p>
        {showSelectedColumn ? (
          <p className="mt-1 text-xs text-emerald-700">
            ✅ Selected subjects are the best 7 used to calculate your total
            score.
          </p>
        ) : null}
      </section>

      {data.schoolCalendar ||
      data.feeStatement ||
      data.coordinatorMessage ||
      formattedNextTermItems ? (
      <div className="space-y-6">
      {data.schoolCalendar ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-800">
            📅 School Calendar
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {formatDateRange(
              data.schoolCalendar.closingDateLabel,
              data.schoolCalendar.openingDateLabel
            )}
          </p>
        </div>
      ) : null}

      {data.feeStatement ? (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-slate-800">
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            💰 Fee Statement
          </h3>
          <ul className="list-inside list-disc space-y-1.5 text-gray-700 leading-relaxed">
            <li>
              Total fees this term:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(
                  data.feeStatement.totalFees,
                  data.feeStatement.currencyCode
                )}
              </span>
            </li>
            <li>
              Amount paid:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(
                  data.feeStatement.amountPaid,
                  data.feeStatement.currencyCode
                )}
              </span>
            </li>
            <li>
              Balance due:{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(
                  data.feeStatement.balanceDue,
                  data.feeStatement.currencyCode
                )}
              </span>
            </li>
          </ul>
          {data.feeStatement.balanceDue > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm leading-relaxed text-amber-950">
              {formatFeeBalanceReminder(
                data.feeStatement.balanceDue,
                data.feeStatement.currencyCode
              )}
            </p>
          ) : (
            <p className="mt-3 text-sm font-medium leading-relaxed text-emerald-800">
              Fee balance: Paid in full. Thank you!
            </p>
          )}
        </section>
      ) : null}

      {data.coordinatorMessage ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-800">
            💬 Coordinator&apos;s Message
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {formatCoordinatorMessage(data.coordinatorMessage)}
          </p>
        </div>
      ) : null}

      {formattedNextTermItems ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-800">
            📦 Items for Next Term
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
            {formattedNextTermItems}
          </p>
        </div>
      ) : null}
      </div>
      ) : null}

      {/*
        The summary (position, total score, school-level note) is the
        coordinator's final word on the card. We hide it from the teacher
        preview while the card is still a draft / pending review so teachers
        focus on entering scores. Coordinators / parents / admins always see
        it; teachers only see it once the card hits "approved".
      */}
      {data.summary?.sentence &&
      (viewer !== "teacher" || reportCardStatus === "approved") ? (
        <section className="rounded-xl border border-[rgb(var(--school-primary-rgb)/0.3)] bg-[rgb(var(--school-primary-rgb)/0.1)] p-4 text-sm leading-relaxed text-slate-800 print:border-slate-300 print:bg-white">
          <p className="text-gray-800">
            <span className="font-semibold text-slate-900">Summary:</span>{" "}
            {data.summary.sentence}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {data.summary.schoolLevel === "secondary"
              ? "Secondary school: best 7 subject averages count toward the total marks."
              : "Primary school: total score is the sum of all subject averages."}
          </p>
        </section>
      ) : null}

      {attendanceText ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-800">
            📊 Attendance ({data.attendance.daysInTermLabel})
          </h3>
          <p className="text-sm leading-relaxed text-gray-700">
            {attendanceText}
          </p>
        </div>
      ) : null}

      <section className="break-inside-avoid border-t border-slate-200 pt-6 sm:pt-5">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
        <div className="min-w-0 sm:w-full">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            {data.teacherIsCoordinator ? "Class Coordinator" : "Class teacher"}
          </p>
          <div className="mt-5 flex w-full min-w-0 flex-col items-center">
            {data.coordinatorSignatureUrl?.trim() ? (
              <img
                src={data.coordinatorSignatureUrl.trim()}
                alt=""
                className="mb-2 max-h-16 max-w-[280px] object-contain contrast-110 saturate-150 [print-color-adjust:exact]"
              />
            ) : null}
            <div className="h-px w-full bg-slate-400" role="presentation" />
            <div className="mt-1 w-full text-left text-xs text-slate-500">
              Signature
            </div>
          </div>
        </div>
        <div className="min-w-0 sm:w-full">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Head teacher
          </p>
          <div className="mt-5 flex w-full min-w-0 flex-col items-center">
            {data.headTeacherSignatureUrl?.trim() ? (
              <img
                src={data.headTeacherSignatureUrl.trim()}
                alt=""
                className="mb-2 max-h-16 max-w-[220px] translate-y-[15px] object-contain [print-color-adjust:exact]"
              />
            ) : null}
            <div className="relative h-px w-full overflow-visible">
              <div
                className="absolute inset-x-0 top-0 h-px bg-slate-400"
                role="presentation"
              />
              {data.schoolStampUrl?.trim() ? (
                <div className="pointer-events-none absolute right-[30%] top-1/2 flex min-h-[40px] w-auto max-h-16 max-w-[110px] -translate-y-1/2 items-center justify-center object-contain opacity-80 rotate-[-4deg]">
                  <img
                    src={data.schoolStampUrl.trim()}
                    alt=""
                    className="h-auto min-h-[40px] max-h-16 w-auto max-w-[110px] object-contain object-center [print-color-adjust:exact]"
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-1 w-full text-left text-xs text-slate-500">
              Signature
            </div>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}

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

  return (
    <div className="mx-auto max-w-4xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm print:shadow-none print:border-slate-300">
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

      <section className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <span className="font-semibold text-slate-700">Student:</span>{" "}
          {data.studentName}
        </p>
        <p>
          <span className="font-semibold text-slate-700">Class:</span>{" "}
          {data.className}
        </p>
        <p>
          <span className="font-semibold text-slate-700">Term:</span> {data.term}
        </p>
        <p>
          <span className="font-semibold text-slate-700">Academic year:</span>{" "}
          {data.academicYear}
        </p>
        <p className="sm:col-span-2">
          <span className="font-semibold text-slate-700">
            {data.teacherIsCoordinator ? "Class Coordinator:" : "Class teacher:"}
          </span>{" "}
          {data.teacherName}
        </p>
        <p className="sm:col-span-2">
          <span className="font-semibold text-slate-700">Date issued:</span>{" "}
          {data.dateIssued}
        </p>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
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
        <div className="overflow-x-auto rounded-lg border border-slate-200">
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
        <p className="mt-2 text-xs text-slate-500">
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

      {/*
        The summary (position, total score, school-level note) is the
        coordinator's final word on the card. We hide it from the teacher
        preview while the card is still a draft / pending review so teachers
        focus on entering scores. Coordinators / parents / admins always see
        it; teachers only see it once the card hits "approved".
      */}
      {data.summary?.sentence &&
      (viewer !== "teacher" || reportCardStatus === "approved") ? (
        <section className="mt-4 rounded-lg border border-[rgb(var(--school-primary-rgb)/0.25)] bg-[rgb(var(--school-primary-rgb)/0.10)] px-4 py-3 text-sm text-slate-800 print:border-slate-400 print:bg-white">
          <p>
            <span className="font-semibold text-slate-900">Summary:</span>{" "}
            {data.summary.sentence}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data.summary.schoolLevel === "secondary"
              ? "Secondary school: best 7 subject averages count toward the total marks."
              : "Primary school: total score is the sum of all subject averages."}
          </p>
        </section>
      ) : null}

      <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
          Attendance ({data.attendance.daysInTermLabel})
        </h2>
        <p className="mt-2 text-sm text-slate-800">
          Days present (incl. late):{" "}
          <span className="font-semibold tabular-nums">
            {data.attendance.present + data.attendance.late}
          </span>
          {" · "}
          Absent:{" "}
          <span className="font-semibold tabular-nums">
            {data.attendance.absent}
          </span>
          {data.attendance.late > 0 ? (
            <>
              {" · "}
              Late marks:{" "}
              <span className="font-semibold tabular-nums">
                {data.attendance.late}
              </span>
            </>
          ) : null}
        </p>
      </section>

      <section className="mt-8 grid gap-8 border-t border-slate-200 pt-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-600">
            {data.teacherIsCoordinator ? "Class Coordinator" : "Class teacher"}
          </p>
          <div className="mt-8 border-b border-slate-400" />
          <p className="mt-1 text-xs text-slate-500">Signature</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-600">
            Head teacher
          </p>
          <div className="mt-8 border-b border-slate-400" />
          <p className="mt-1 text-xs text-slate-500">Signature</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-600">
            Parent / guardian
          </p>
          <div className="mt-8 border-b border-slate-400" />
          <p className="mt-1 text-xs text-slate-500">Signature</p>
        </div>
      </section>
    </div>
  );
}

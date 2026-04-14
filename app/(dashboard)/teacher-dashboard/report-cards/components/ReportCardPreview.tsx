"use client";

import {
  REPORT_CARD_EXAM_LABELS,
  type ReportTermValue,
} from "../constants";
import type { ReportCardPreviewData } from "../report-card-preview-types";

export type { ReportCardPreviewData } from "../report-card-preview-types";

function examLabelsForTerm(term: string): { exam1: string; exam2: string } {
  if (term === "Term 1" || term === "Term 2") {
    return REPORT_CARD_EXAM_LABELS[term as ReportTermValue];
  }
  return REPORT_CARD_EXAM_LABELS["Term 1"];
}

export function ReportCardPreview({ data }: { data: ReportCardPreviewData }) {
  const { exam1, exam2 } = examLabelsForTerm(data.term);
  const exam1Head = `${exam1} (%)`;
  const exam2Head = `${exam2} (%)`;

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
          <span className="font-semibold text-slate-700">Class teacher:</span>{" "}
          {data.teacherName}
        </p>
        <p className="sm:col-span-2">
          <span className="font-semibold text-slate-700">Date issued:</span>{" "}
          {data.dateIssued}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-800">
          Subject results
        </h2>
        {(() => {
          const anyOv = data.subjects.some(
            (r) => r.exam1Overridden || r.exam2Overridden
          );
          return anyOv ? (
            <p className="mb-2 text-xs text-slate-600">
              * Exam score was changed after the gradebook value was used.
            </p>
          ) : null;
        })()}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="border border-slate-600 px-2 py-2">Subject</th>
                <th className="border border-slate-600 px-2 py-2">{exam1Head}</th>
                <th className="border border-slate-600 px-2 py-2">{exam2Head}</th>
                <th className="border border-slate-600 px-2 py-2">Average %</th>
                <th className="border border-slate-600 px-2 py-2">Grade</th>
                <th className="min-w-[10rem] border border-slate-600 px-2 py-2">
                  Teacher comment
                </th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-slate-200 px-2 py-3 text-slate-500"
                  >
                    No subject entries yet.
                  </td>
                </tr>
              ) : (
                data.subjects.map((r) => (
                  <tr key={r.subject} className="odd:bg-white even:bg-slate-50">
                    <td className="border border-slate-200 px-2 py-2 font-medium">
                      {r.subject}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 tabular-nums">
                      {r.exam1Pct}
                      {r.exam1Overridden ? (
                        <span className="font-semibold text-slate-800" title="Overridden from gradebook">
                          *
                        </span>
                      ) : null}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 tabular-nums">
                      {r.exam2Pct}
                      {r.exam2Overridden ? (
                        <span className="font-semibold text-slate-800" title="Overridden from gradebook">
                          *
                        </span>
                      ) : null}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 font-semibold tabular-nums">
                      {r.averagePct}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 font-semibold">
                      {r.grade}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-slate-700">
                      {r.comment || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Final score per subject = (Exam 1 + Exam 2) ÷ 2 when both are entered.
          Grading: A = 75–100%, B = 65–74%, C = 45–64%, D = 30–44%, F = 0–29%.
        </p>
      </section>

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
            Class teacher
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

import type { ChildTabData } from "./parent-child-tab-data";
import { ParentReportCardsTabClient } from "./parent-report-cards-tab-client";
import { ParentClassResultSheetsTabClient } from "./parent-class-result-sheets-tab-client";
import { ParentClassResultsTabClient } from "./parent-class-results-tab-client";

function NoData() {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm text-slate-500 dark:text-zinc-400">No data available</p>
    </div>
  );
}

/** Read-only report card(s) using the same {@link ReportCardPreview} as coordinators. */
export function ParentReportCardsTabContent({
  rows,
}: {
  rows: ChildTabData["reportCards"];
}) {
  return <ParentReportCardsTabClient rows={rows} />;
}

export function ParentExamResultsTabContent({
  classResultSheets,
}: {
  classResultSheets: ChildTabData["classResultSheets"];
}) {
  return <ParentClassResultSheetsTabClient rows={classResultSheets} />;
}

function statusLabel(status: ChildTabData["attendance"][number]["status"]) {
  switch (status) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    default:
      return status;
  }
}

function formatRecordedTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ParentAttendanceTabContent({
  rows,
}: {
  rows: ChildTabData["attendance"];
}) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No attendance records found.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto px-4 py-3 sm:px-6">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium">Subject</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 font-medium">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/80 dark:divide-zinc-800/50">
          {rows.map((a) => (
            <tr
              key={a.id}
              className="text-slate-800 dark:text-zinc-200"
            >
              <td className="py-2.5 pr-3 align-top tabular-nums text-slate-600 dark:text-zinc-300">
                {a.attendance_date}
              </td>
              <td className="py-2.5 pr-3 align-top font-medium">
                {a.subjectName}
              </td>
              <td
                className={
                  a.status === "present"
                    ? "py-2.5 pr-3 align-top font-medium text-emerald-600 dark:text-emerald-400"
                    : a.status === "late"
                      ? "py-2.5 pr-3 align-top font-medium text-amber-600 dark:text-amber-400"
                      : "py-2.5 pr-3 align-top font-medium text-rose-600 dark:text-rose-400"
                }
              >
                {statusLabel(a.status)}
              </td>
              <td className="py-2.5 align-top tabular-nums text-slate-500 dark:text-zinc-500">
                {formatRecordedTime(a.recordedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ParentClassResultsTabContent({
  studentId,
  classId,
  classResultSubjects,
  majorExamClassResults,
}: {
  studentId: string;
  classId: string;
  classResultSubjects: ChildTabData["classResultSubjects"];
  majorExamClassResults: ChildTabData["majorExamClassResults"];
}) {
  return (
    <ParentClassResultsTabClient
      studentId={studentId}
      classId={classId}
      classResultSubjects={classResultSubjects}
      initialPayload={majorExamClassResults}
    />
  );
}

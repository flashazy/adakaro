import type { ChildTabData } from "./parent-child-tab-data";
import { ParentReportCardsTabClient } from "./parent-report-cards-tab-client";
import { ParentClassResultSheetsTabClient } from "./parent-class-result-sheets-tab-client";
import { ParentClassTeacherMessagesTabClient } from "@/components/chat/parent-class-teacher-messages-tab-client";
import { DEFAULT_SCHOOL_DISPLAY_TIMEZONE } from "@/lib/school-timezone";
export { ParentClassResultsTabContent } from "./parent-class-results-tab-content-client";

export function ParentClassTeacherMessagesTabContent({
  parentId,
  classId,
  classTeacherId,
  studentName,
  onMessagesUnreadChange,
}: {
  parentId: string;
  classId: string;
  classTeacherId: string | null;
  studentName: string;
  onMessagesUnreadChange?: (count: number) => void;
}) {
  return (
    <ParentClassTeacherMessagesTabClient
      parentId={parentId}
      classId={classId}
      classTeacherId={classTeacherId}
      studentName={studentName}
      onMessagesUnreadChange={onMessagesUnreadChange}
    />
  );
}

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

function formatRecordedTime(iso: string | null, timeZone: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(d);
}

export function ParentAttendanceTabContent({
  rows,
  attendanceTimeZone = DEFAULT_SCHOOL_DISPLAY_TIMEZONE,
}: {
  rows: ChildTabData["attendance"];
  attendanceTimeZone?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center sm:px-6">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No attendance records found.
        </p>
      </div>
    );
  }
  return (
    <div className="px-3 py-4 sm:px-6 sm:py-5">
      <div className="hidden overflow-x-auto rounded-xl border border-slate-100 md:block dark:border-zinc-800">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <th className="py-3 pl-4 pr-3 font-medium">Date</th>
              <th className="py-3 pr-3 font-medium">Subject</th>
              <th className="py-3 pr-3 font-medium">Status</th>
              <th className="py-3 pr-4 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            {rows.map((a) => (
              <tr
                key={a.id}
                className="text-slate-800 dark:text-zinc-200"
              >
                <td className="py-3 pl-4 pr-3 align-top tabular-nums text-slate-600 dark:text-zinc-300">
                  {a.attendance_date}
                </td>
                <td className="py-3 pr-3 align-top font-medium">
                  {a.subjectName}
                </td>
                <td
                  className={
                    a.status === "present"
                      ? "py-3 pr-3 align-top font-medium text-emerald-600 dark:text-emerald-400"
                      : a.status === "late"
                        ? "py-3 pr-3 align-top font-medium text-amber-600 dark:text-amber-400"
                        : "py-3 pr-3 align-top font-medium text-rose-600 dark:text-rose-400"
                  }
                >
                  {statusLabel(a.status)}
                </td>
                <td className="py-3 pr-4 align-top tabular-nums text-slate-500 dark:text-zinc-500">
                  {formatRecordedTime(a.recordedAt, attendanceTimeZone)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Attendance records">
        {rows.map((a) => (
          <li
            key={a.id}
            className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/40"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                {a.attendance_date}
              </p>
              <p
                className={
                  a.status === "present"
                    ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                    : a.status === "late"
                      ? "text-sm font-semibold text-amber-600 dark:text-amber-400"
                      : "text-sm font-semibold text-rose-600 dark:text-rose-400"
                }
              >
                {statusLabel(a.status)}
              </p>
            </div>
            <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
              {a.subjectName}
            </p>
            <p className="mt-2 text-sm tabular-nums text-slate-500 dark:text-zinc-400">
              {formatRecordedTime(a.recordedAt, attendanceTimeZone)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}


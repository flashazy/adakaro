"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLASS_ATTENDANCE_STATUSES,
  CLASS_ATTENDANCE_STATUS_LABELS,
  type ClassAttendanceDaySummary,
  type ClassAttendanceHistoryRow,
  type ClassAttendanceStatus,
} from "@/lib/class-attendance/class-attendance-types";
import {
  formatHistoryStatusBreakdown,
  rollupDaySummary,
  tallyStatuses,
} from "@/lib/class-attendance/class-attendance-utils";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatAttendanceDisplayDate(isoDate: string) {
  const [ys, ms, ds] = isoDate.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d || m < 1 || m > 12) return isoDate;
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

const STATUS_STYLES: Record<
  ClassAttendanceStatus,
  { active: string; inactive: string; badge: string }
> = {
  present: {
    active:
      "border-emerald-600 bg-emerald-600 text-white shadow-md ring-2 ring-emerald-600/30",
    inactive:
      "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
    badge:
      "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900",
  },
  absent: {
    active:
      "border-red-800 bg-red-800 text-white shadow-md ring-2 ring-red-800/30",
    inactive:
      "border-red-200 bg-white text-red-800 hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40",
    badge:
      "bg-red-100 text-red-900 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900",
  },
  late: {
    active:
      "border-amber-500 bg-amber-500 text-white shadow-md ring-2 ring-amber-500/30",
    inactive:
      "border-amber-200 bg-white text-amber-900 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-zinc-900 dark:text-amber-200 dark:hover:bg-amber-950/40",
    badge:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
  },
  sick: {
    active:
      "border-sky-600 bg-sky-600 text-white shadow-md ring-2 ring-sky-600/30",
    inactive:
      "border-sky-200 bg-white text-sky-800 hover:bg-sky-50 dark:border-sky-900/60 dark:bg-zinc-900 dark:text-sky-300 dark:hover:bg-sky-950/40",
    badge:
      "bg-sky-100 text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
  },
  permitted: {
    active:
      "border-slate-600 bg-slate-600 text-white shadow-md ring-2 ring-slate-600/30",
    inactive:
      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
    badge:
      "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
  },
};

export function statusButtonClass(
  status: ClassAttendanceStatus,
  active: boolean
) {
  const s = STATUS_STYLES[status];
  return cn(
    "min-h-[44px] min-w-[4.5rem] flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition-all sm:min-h-[40px] sm:min-w-0 sm:flex-none sm:rounded-lg sm:px-2.5 sm:py-1.5",
    active ? s.active : s.inactive
  );
}

export function StatusBadge({ status }: { status: ClassAttendanceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLES[status].badge
      )}
    >
      {CLASS_ATTENDANCE_STATUS_LABELS[status]}
    </span>
  );
}

export function StudentAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? 36 : 40;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const cls =
    size === "sm"
      ? "h-9 w-9 text-[0.65rem]"
      : "h-10 w-10 text-xs";
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={dim}
        height={dim}
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800",
          cls
        )}
        unoptimized
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 font-semibold text-slate-600 ring-2 ring-white dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-300 dark:ring-zinc-800",
        cls
      )}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function computeLiveSummaryFromEdits(
  edits: Map<string, { status: ClassAttendanceStatus }>,
  totalClassStudents: number
): ClassAttendanceDaySummary {
  const statuses = [...edits.values()].map((e) => e.status);
  const summary = tallyStatuses(statuses);
  const unvisited = Math.max(0, totalClassStudents - statuses.length);
  if (unvisited > 0) {
    summary.present += unvisited;
  }
  return summary;
}

export function ClassAttendanceSummaryStrip({
  summary,
  totalStudents,
  live,
}: {
  summary: ClassAttendanceDaySummary;
  totalStudents: number;
  live?: boolean;
}) {
  const r = rollupDaySummary(summary);
  const cards = [
    {
      label: "Total",
      value: totalStudents,
      accent: "text-slate-900 dark:text-white",
      bg: "bg-white dark:bg-zinc-900",
    },
    {
      label: "Present",
      value: r.inClass,
      sub: r.late > 0 ? `incl. ${r.late} late` : undefined,
      accent: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50/80 dark:bg-emerald-950/30",
    },
    {
      label: "Absent",
      value: summary.absent,
      accent: "text-red-700 dark:text-red-400",
      bg: "bg-red-50/80 dark:bg-red-950/30",
    },
    {
      label: "Late",
      value: summary.late,
      accent: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50/80 dark:bg-amber-950/30",
    },
    {
      label: "Sick",
      value: summary.sick,
      accent: "text-sky-700 dark:text-sky-400",
      bg: "bg-sky-50/80 dark:bg-sky-950/30",
    },
    {
      label: "Permitted",
      value: summary.permitted,
      accent: "text-slate-700 dark:text-zinc-300",
      bg: "bg-slate-50/80 dark:bg-zinc-800/60",
    },
  ];

  return (
    <div className="space-y-2">
      {live ? (
        <p className="text-xs font-medium text-school-primary dark:text-school-primary">
          Live summary · updates as you mark students
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-xl border border-slate-200/80 px-3 py-2.5 shadow-sm dark:border-zinc-700/80",
              c.bg
            )}
          >
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              {c.label}
            </p>
            <p className={cn("mt-0.5 text-xl font-bold tabular-nums", c.accent)}>
              {c.value}
            </p>
            {c.sub ? (
              <p className="text-[0.65rem] text-slate-500 dark:text-zinc-400">
                {c.sub}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClassAttendancePageHeader({
  className: classLabel,
  attendanceDate,
  showRecordedTodayBadge,
  hasRecords,
  loadingDate,
  listBusy,
  onDateChange,
}: {
  className: string;
  attendanceDate: string;
  showRecordedTodayBadge: boolean;
  hasRecords: boolean;
  loadingDate: boolean;
  listBusy: boolean;
  onDateChange: (value: string) => void;
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950/80">
      <div className="border-b border-slate-100 px-4 py-5 dark:border-zinc-800 sm:px-6">
        <div className="flex flex-wrap items-start gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Class Attendance
          </h1>
          {showRecordedTodayBadge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Recorded today
            </span>
          ) : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          Record daily attendance for every student in this class.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
            <Users className="h-4 w-4 text-slate-500 dark:text-zinc-400" aria-hidden />
            {classLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
            <CalendarDays className="h-4 w-4 text-slate-500 dark:text-zinc-400" aria-hidden />
            {formatAttendanceDisplayDate(attendanceDate)}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <p
          className={cn(
            "text-sm leading-relaxed",
            hasRecords
              ? "text-slate-600 dark:text-zinc-400"
              : "text-slate-700 dark:text-zinc-300"
          )}
          role="note"
        >
          {hasRecords
            ? "Attendance already recorded for this date. You can update and save changes."
            : "Everyone is marked Present by default. Adjust only the students who are absent, late, sick, or permitted."}
        </p>
        <div className="flex shrink-0 flex-col gap-1.5">
          <label
            htmlFor="class-attendance-date"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400"
          >
            Attendance date
          </label>
          <input
            id="class-attendance-date"
            type="date"
            value={attendanceDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={listBusy}
            className="h-11 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/25 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          />
          {loadingDate ? (
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Loading…
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function ClassAttendanceQuickActions({
  listBusy,
  pageEmpty,
  selectedCount,
  onResetPresent,
  onResetAbsent,
  onMarkSelectedPresent,
  onMarkSelectedAbsent,
}: {
  listBusy: boolean;
  pageEmpty: boolean;
  selectedCount: number;
  onResetPresent: () => void;
  onResetAbsent: () => void;
  onMarkSelectedPresent: () => void;
  onMarkSelectedAbsent: () => void;
}) {
  const btn =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[40px]";
  return (
    <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        Quick actions
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={onResetPresent}
          disabled={listBusy || pageEmpty}
          className={cn(
            btn,
            "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          )}
        >
          Reset all present
        </button>
        <button
          type="button"
          onClick={onResetAbsent}
          disabled={listBusy || pageEmpty}
          className={cn(
            btn,
            "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          )}
        >
          Reset all absent
        </button>
        <button
          type="button"
          onClick={onMarkSelectedPresent}
          disabled={listBusy || selectedCount === 0}
          className={cn(
            btn,
            "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          )}
        >
          Mark selected present
        </button>
        <button
          type="button"
          onClick={onMarkSelectedAbsent}
          disabled={listBusy || selectedCount === 0}
          className={cn(
            btn,
            "border-red-200 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          )}
        >
          Mark selected absent
        </button>
      </div>
      {selectedCount > 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
          {selectedCount} student{selectedCount !== 1 ? "s" : ""} selected on
          this page
        </p>
      ) : null}
    </div>
  );
}

export function StatusButtonGroup({
  studentId,
  currentStatus,
  studentName,
  onSelect,
}: {
  studentId: string;
  currentStatus: ClassAttendanceStatus;
  studentName: string;
  onSelect: (status: ClassAttendanceStatus) => void;
}) {
  return (
    <div
      className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-1.5"
      role="group"
      aria-label={`Attendance status for ${studentName}`}
    >
      {CLASS_ATTENDANCE_STATUSES.map((st) => (
        <button
          key={st}
          type="button"
          onClick={() => onSelect(st)}
          aria-pressed={currentStatus === st}
          className={statusButtonClass(st, currentStatus === st)}
        >
          {CLASS_ATTENDANCE_STATUS_LABELS[st]}
        </button>
      ))}
    </div>
  );
}

export function ClassAttendanceStudentCard({
  student,
  selected,
  onToggleSelect,
  onSelectStatus,
}: {
  student: {
    id: string;
    fullName: string;
    admissionNumber: string | null;
    avatarUrl: string | null;
    status: ClassAttendanceStatus;
  };
  selected: boolean;
  onToggleSelect: () => void;
  onSelectStatus: (status: ClassAttendanceStatus) => void;
}) {
  return (
    <article
      id={`class-attendance-row-${student.id}`}
      className={cn(
        "rounded-2xl border bg-white p-3 shadow-sm transition-shadow dark:bg-zinc-900/80",
        selected
          ? "border-school-primary/40 ring-1 ring-school-primary/20"
          : "border-slate-200/90 dark:border-zinc-700/90"
      )}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${student.fullName}`}
          className="h-5 w-5 shrink-0 rounded border-slate-300 text-school-primary focus:ring-school-primary"
        />
        <StudentAvatar name={student.fullName} avatarUrl={student.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-slate-900 dark:text-white">
              {student.fullName}
            </p>
            <StatusBadge status={student.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            {student.admissionNumber
              ? `Adm. ${student.admissionNumber}`
              : "No admission number"}
          </p>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
        <StatusButtonGroup
          studentId={student.id}
          currentStatus={student.status}
          studentName={student.fullName}
          onSelect={onSelectStatus}
        />
      </div>
    </article>
  );
}

export function ClassAttendanceDesktopTableHeader({
  allPageSelected,
  onToggleSelectPage,
}: {
  allPageSelected: boolean;
  onToggleSelectPage: () => void;
}) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
        <th className="w-12 px-4 py-3">
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={onToggleSelectPage}
            aria-label="Select all students on this page"
            className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary"
          />
        </th>
        <th className="px-4 py-3">Student</th>
        <th className="hidden px-4 py-3 lg:table-cell">Admission</th>
        <th className="px-4 py-3">Status</th>
      </tr>
    </thead>
  );
}

export function ClassAttendanceDesktopRow({
  student,
  selected,
  onToggleSelect,
  onSelectStatus,
}: {
  student: {
    id: string;
    fullName: string;
    admissionNumber: string | null;
    avatarUrl: string | null;
    status: ClassAttendanceStatus;
  };
  selected: boolean;
  onToggleSelect: () => void;
  onSelectStatus: (status: ClassAttendanceStatus) => void;
}) {
  return (
    <tr
      id={`class-attendance-row-${student.id}`}
      className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60 dark:border-zinc-800/80 dark:hover:bg-zinc-800/30"
    >
      <td className="px-4 py-3 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${student.fullName}`}
          className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary"
        />
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <StudentAvatar name={student.fullName} avatarUrl={student.avatarUrl} />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white">
              {student.fullName}
            </p>
            <p className="text-xs text-slate-500 lg:hidden dark:text-zinc-400">
              {student.admissionNumber ?? "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 align-middle text-sm text-slate-600 dark:text-zinc-400 lg:table-cell">
        {student.admissionNumber ?? "—"}
      </td>
      <td className="px-4 py-3 align-middle">
        <StatusButtonGroup
          studentId={student.id}
          currentStatus={student.status}
          studentName={student.fullName}
          onSelect={onSelectStatus}
        />
      </td>
    </tr>
  );
}

export function ClassAttendanceStickySaveBar({
  dirty,
  pending,
  disabled,
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  if (!dirty) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95"
      role="region"
      aria-label="Save attendance"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Unsaved changes
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || pending}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-school-primary px-5 text-sm font-semibold text-white shadow-lg hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Saving attendance…" : "Save Class Attendance"}
        </button>
      </div>
    </div>
  );
}

export function ClassAttendanceHistorySection({
  history,
  attendanceHref,
}: {
  history: ClassAttendanceHistoryRow[];
  attendanceHref: (date: string) => string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-slate-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Recent attendance history
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Newest dates first · open or edit a previous day
        </p>
      </div>
      {history.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
          No attendance recorded yet for this class.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
          {history.map((row) => {
            const r = rollupDaySummary(row.summary);
            return (
              <li
                key={row.attendanceDate}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {formatAttendanceDisplayDate(row.attendanceDate)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      In class: {r.inClass}
                    </span>
                    <span className="rounded-lg bg-red-50 px-2 py-1 font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200">
                      Not in class: {r.notInClass}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                    {formatHistoryStatusBreakdown(row.summary)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={attendanceHref(row.attendanceDate)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    Open
                  </Link>
                  <Link
                    href={attendanceHref(row.attendanceDate)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-school-primary/30 bg-school-primary/10 px-4 text-xs font-semibold text-school-primary hover:bg-school-primary/15"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ClassAttendanceSearchToolbar({
  searchId,
  query,
  onQueryChange,
  rowsPerPage,
  onRowsPerPageChange,
  rangeLabel,
}: {
  searchId: string;
  query: string;
  onQueryChange: (value: string) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (value: number) => void;
  rangeLabel: string;
}) {
  return (
    <div className="space-y-3 border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 3.38 9.85l3.39 3.39a.75.75 0 1 0 1.06-1.06l-3.39-3.39A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name or admission number…"
          className="block h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-zinc-400">{rangeLabel}</p>
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span className="shrink-0">Rows</span>
          <select
            value={rowsPerPage}
            onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

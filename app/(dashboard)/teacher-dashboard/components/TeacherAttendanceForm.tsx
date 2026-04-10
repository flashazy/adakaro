"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { countAttendanceRollup } from "@/lib/attendance-counts";
import {
  loadAttendanceData,
  loadAttendanceHistory,
  saveAttendanceAction,
} from "../actions";

export type AttendanceClassOption = {
  assignmentId: string;
  classId: string;
  className: string;
  subject: string;
  academicYear: string;
};

type Status = "present" | "absent" | "late";

type ViewMode = "text" | "symbol";

type StatusFilter = "all" | Status;

/** Locale-agnostic so server and client HTML match (avoids hydration errors). */
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

function formatDisplayDate(isoDate: string) {
  const [ys, ms, ds] = isoDate.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d || m < 1 || m > 12) return isoDate;
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

function formatMonthHeading(monthKey: string) {
  const [ys, ms] = monthKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  return `${SHORT_MONTHS[m - 1]} ${y}`;
}

type HistoryRow = {
  attendance_date: string;
  status: string;
  student_id: string;
  student_name: string;
};

function groupHistoryDatesByMonth(dates: string[]) {
  const byMonth = new Map<string, string[]>();
  for (const d of dates) {
    const monthKey = d.length >= 7 ? d.slice(0, 7) : d;
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(d);
  }
  const sortedMonthKeys = [...byMonth.keys()].sort((a, b) =>
    b.localeCompare(a)
  );
  return sortedMonthKeys.map((monthKey) => ({
    monthKey,
    dates: (byMonth.get(monthKey) ?? []).sort((a, b) => b.localeCompare(a)),
  }));
}

function isFrequentAbsentee(
  studentId: string,
  attendanceRecords: HistoryRow[]
): boolean {
  if (!attendanceRecords.length) return false;
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const recentRecords = attendanceRecords.filter((record) => {
    if (record.student_id !== studentId) return false;
    if (!record.attendance_date) return false;
    const d = new Date(record.attendance_date);
    if (Number.isNaN(d.getTime())) return false;
    return d >= sevenDaysAgo;
  });

  const absentCount = recentRecords.filter(
    (record) => String(record.status).toLowerCase() === "absent"
  ).length;

  return absentCount >= 3;
}

export function TeacherAttendanceForm({
  options,
  initialClassId,
}: {
  options: AttendanceClassOption[];
  initialClassId: string | null;
}) {
  const defaultClass =
    options.find((o) => o.classId === initialClassId)?.classId ??
    options[0]?.classId ??
    "";

  const [classId, setClassId] = useState(defaultClass);
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>(
    []
  );
  const [statusByStudent, setStatusByStudent] = useState<
    Record<string, Status>
  >({});
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [historyByDate, setHistoryByDate] = useState<
    Record<
      string,
      {
        attendance_date: string;
        status: string;
        student_id: string;
        student_name: string;
      }[]
    >
  >({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("symbol");
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(
    () => new Set()
  );
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("attendance-view-mode")
        : null;
    if (saved === "text" || saved === "symbol") {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("attendance-view-mode", mode);
  };

  const syncAttendance = useCallback(async () => {
    if (!classId) return;
    setLoadError(null);
    setSaveOk(false);
    const res = await loadAttendanceData(classId, date);
    if (!res.ok) {
      setLoadError(res.error);
      setStudents([]);
      setStatusByStudent({});
      setHasChanges(false);
      return;
    }
    setStudents(res.students);
    const next: Record<string, Status> = {};
    for (const s of res.students) {
      next[s.id] = res.attendance[s.id] ?? "present";
    }
    setStatusByStudent(next);
    setHasChanges(false);

    const hist = await loadAttendanceHistory(classId, 14);
    if (hist.ok) {
      setHistoryDates(hist.dates);
      setHistoryByDate(hist.byDate);
    }
  }, [classId, date]);

  useEffect(() => {
    startTransition(() => {
      void syncAttendance();
    });
  }, [syncAttendance]);

  const setStatus = (studentId: string, status: Status) => {
    setStatusByStudent((prev) => ({ ...prev, [studentId]: status }));
    setHasChanges(true);
  };

  const getStatusForStudent = (studentId: string): Status => {
    return statusByStudent[studentId] ?? "present";
  };

  const markAllPresent = () => {
    const next: Record<string, Status> = {};
    students.forEach((s) => {
      next[s.id] = "present";
    });
    setStatusByStudent(next);
    setHasChanges(true);
  };

  const markAllAbsent = () => {
    const next: Record<string, Status> = {};
    students.forEach((s) => {
      next[s.id] = "absent";
    });
    setStatusByStudent(next);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!classId) return;
    setSaveError(null);
    setSaveOk(false);
    setIsSaving(true);
    try {
      const records = students.map((s) => ({
        studentId: s.id,
        status: statusByStudent[s.id] ?? "present",
      }));
      const res = await saveAttendanceAction({ classId, date, records });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setSaveOk(true);
      setHasChanges(false);
      void syncAttendance();
    } finally {
      setIsSaving(false);
    }
  };

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => x.classId === classId);
    if (!o) return "";
    return `${o.className} — ${o.subject || "General"} (${o.academicYear || "—"})`;
  }, [options, classId]);

  const selectedClassName = useMemo(() => {
    const o = options.find((x) => x.classId === classId);
    if (!o) return "";
    return `${o.className} — ${o.subject || "General"}`;
  }, [options, classId]);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (statusFilter !== "all") {
      list = students.filter((s) => {
        const st = statusByStudent[s.id] ?? "present";
        return st === statusFilter;
      });
    }
    const q = studentSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, studentSearch, statusFilter, statusByStudent]);

  const historyMonthGroups = useMemo(
    () => groupHistoryDatesByMonth(historyDates),
    [historyDates]
  );

  const frequentAbsenteeIds = useMemo(() => {
    const ids = new Set<string>();
    const flat: HistoryRow[] = [];
    for (const d of Object.keys(historyByDate)) {
      for (const row of historyByDate[d] ?? []) {
        flat.push(row);
      }
    }
    if (flat.length === 0) return ids;
    for (const s of students) {
      if (isFrequentAbsentee(s.id, flat)) ids.add(s.id);
    }
    return ids;
  }, [historyByDate, students]);

  const toggleMonthCollapsed = (monthKey: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  const isMonthExpanded = (monthKey: string) =>
    !collapsedMonths.has(monthKey);

  const renderSymbolButtons = (studentId: string, currentStatus: Status) => {
    const buttons = [
      {
        status: "present" as const,
        symbol: "✓",
        label: "Mark present",
        active:
          "border-green-600 bg-green-600 text-white hover:bg-green-600 dark:border-green-600 dark:bg-green-600",
        inactive:
          "border-gray-200 bg-white text-green-700 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-green-400 dark:hover:bg-zinc-800",
      },
      {
        status: "absent" as const,
        symbol: "✗",
        label: "Mark absent",
        active:
          "border-red-600 bg-red-600 text-white hover:bg-red-600 dark:border-red-600 dark:bg-red-600",
        inactive:
          "border-gray-200 bg-white text-red-700 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-zinc-800",
      },
      {
        status: "late" as const,
        symbol: "⏰",
        label: "Mark late",
        active:
          "border-yellow-500 bg-yellow-500 text-white hover:bg-yellow-500 dark:border-yellow-500 dark:bg-yellow-500",
        inactive:
          "border-gray-200 bg-white text-yellow-700 hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-yellow-400 dark:hover:bg-zinc-800",
      },
    ];

    return (
      <div className="flex items-center gap-2">
        {buttons.map(({ status, symbol, label, active, inactive }) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatus(studentId, status)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border font-bold transition-colors",
              currentStatus === status ? active : inactive
            )}
            title={label}
          >
            {symbol}
          </button>
        ))}
      </div>
    );
  };

  const renderTextButtons = (studentId: string, currentStatus: Status) => {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1",
            currentStatus === "present" && "bg-green-100 dark:bg-green-950/40"
          )}
        >
          <input
            type="radio"
            name={`student-${studentId}`}
            checked={currentStatus === "present"}
            onChange={() => setStatus(studentId, "present")}
            className="h-4 w-4 text-emerald-600"
          />
          <span className="text-sm text-slate-700 dark:text-zinc-300">
            Present
          </span>
        </label>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1",
            currentStatus === "absent" && "bg-red-100 dark:bg-red-950/40"
          )}
        >
          <input
            type="radio"
            name={`student-${studentId}`}
            checked={currentStatus === "absent"}
            onChange={() => setStatus(studentId, "absent")}
            className="h-4 w-4 text-red-600"
          />
          <span className="text-sm text-slate-700 dark:text-zinc-300">
            Absent
          </span>
        </label>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md px-2 py-1",
            currentStatus === "late" && "bg-yellow-100 dark:bg-yellow-950/40"
          )}
        >
          <input
            type="radio"
            name={`student-${studentId}`}
            checked={currentStatus === "late"}
            onChange={() => setStatus(studentId, "late")}
            className="h-4 w-4 text-amber-500"
          />
          <span className="text-sm text-slate-700 dark:text-zinc-300">Late</span>
        </label>
      </div>
    );
  };

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        You have no class assignments yet. Your school administrator must assign
        you to classes before you can take attendance.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {selectedClassName || "Class"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {formatDisplayDate(date)} • {students.length} student
            {students.length !== 1 ? "s" : ""}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Class
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {options.map((o) => (
                <option key={o.assignmentId} value={o.classId}>
                  {o.className} — {o.subject || "General"} ·{" "}
                  {o.academicYear || "—"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-10 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </div>
        </div>

        {loadError && (
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        )}
        {saveError && (
          <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
        )}
        {saveOk && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Attendance saved for {selectedLabel} on {date}.
          </p>
        )}

        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="sticky top-0 z-10 rounded-t-lg border-b border-gray-100 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-zinc-800"
                  role="group"
                  aria-label="Attendance view"
                >
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("text")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      viewMode === "text"
                        ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                        : "text-gray-500 dark:text-zinc-400"
                    )}
                  >
                    Text
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange("symbol")}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      viewMode === "symbol"
                        ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                        : "text-gray-500 dark:text-zinc-400"
                    )}
                  >
                    Symbols ✓ ✗ ⏰
                  </button>
                </div>
                <div className="text-right text-sm text-gray-500 dark:text-zinc-400">
                  {statusFilter !== "all" ? (
                    <>
                      Showing {filteredStudents.length} student
                      {filteredStudents.length !== 1 ? "s" : ""}{" "}
                      <span className="text-slate-600 dark:text-zinc-300">
                        (filtered by:{" "}
                        {statusFilter === "present"
                          ? "Present"
                          : statusFilter === "absent"
                            ? "Absent"
                            : "Late"}
                        )
                      </span>
                    </>
                  ) : studentSearch.trim() ? (
                    <>
                      {filteredStudents.length} showing
                      <span className="text-slate-400 dark:text-zinc-500">
                        {" "}
                        · {students.length} total
                      </span>
                    </>
                  ) : (
                    <>
                      {students.length} student{students.length !== 1 ? "s" : ""}
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Bulk actions:
                  </span>
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="h-9 rounded-lg bg-green-100 px-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-200/80 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60"
                  >
                    Mark all present
                  </button>
                  <button
                    type="button"
                    onClick={markAllAbsent}
                    className="h-9 rounded-lg bg-red-100 px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-200/80 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
                  >
                    Mark all absent
                  </button>
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="h-9 rounded-lg bg-green-100 px-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-200/80 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60"
                  >
                    Reset (All Present)
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="sr-only">Filter by attendance status</span>
                  {(
                    [
                      {
                        key: "all" as const,
                        label: "All",
                        title: "Show all students",
                      },
                      {
                        key: "present" as const,
                        label: "Present",
                        title: "Show only Present",
                      },
                      {
                        key: "absent" as const,
                        label: "Absent",
                        title: "Show only Absent",
                      },
                      {
                        key: "late" as const,
                        label: "Late",
                        title: "Show only Late",
                      },
                    ] as const
                  ).map(({ key, label, title }) => {
                    const active = statusFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        title={title}
                        aria-pressed={active}
                        onClick={() => setStatusFilter(key)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm transition-colors",
                          active
                            ? "border-transparent bg-indigo-600 text-white hover:bg-indigo-600 dark:bg-indigo-600"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-100 px-4 pb-3 dark:border-zinc-700">
            <label className="relative block w-full">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search students by name…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
                autoComplete="off"
              />
            </label>
          </div>

          <div className="mt-4 max-h-[400px] flex-1 overflow-y-auto">
            {isPending && students.length === 0 ? (
              <p className="p-6 text-slate-500 dark:text-zinc-400">
                Loading students…
              </p>
            ) : students.length === 0 ? (
              <p className="p-6 text-slate-500 dark:text-zinc-400">
                No active students in this class.
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className="p-6 text-slate-500 dark:text-zinc-400">
                {studentSearch.trim()
                  ? statusFilter !== "all"
                    ? "No students match your search or status filter."
                    : "No students match your search."
                  : "No students with this status on the selected date."}
              </p>
            ) : (
              <div>
                {filteredStudents.map((s) => {
                  const currentStatus = getStatusForStudent(s.id);
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50",
                        currentStatus === "present" && "bg-green-50",
                        currentStatus === "absent" && "bg-red-50",
                        currentStatus === "late" && "bg-yellow-50"
                      )}
                    >
                      <span className="inline-flex flex-wrap items-center gap-y-1 font-medium text-gray-900 dark:text-white">
                        {s.full_name}
                        {frequentAbsenteeIds.has(s.id) ? (
                          <span className="ml-2 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            Frequent Absentee
                          </span>
                        ) : null}
                      </span>
                      {viewMode === "symbol"
                        ? renderSymbolButtons(s.id, currentStatus)
                        : renderTextButtons(s.id, currentStatus)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 mt-4 rounded-b-lg border-t border-gray-100 bg-white pt-3 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="px-4 pb-4">
              {hasChanges ? (
                <div className="mb-3 rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2 text-sm text-yellow-600 dark:border-yellow-900/40 dark:bg-yellow-950/30 dark:text-yellow-500">
                  You have unsaved changes
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  !classId || students.length === 0 || isPending || isSaving
                }
                className={cn(
                  "h-12 w-full rounded-xl text-base font-medium text-white shadow-sm transition hover:opacity-90",
                  isSaving || isPending
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-indigo-600 hover:bg-indigo-500"
                )}
              >
                {isSaving ? "Saving…" : "Save attendance"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Recent history
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Latest saved days for this class (most recent first).
        </p>
        <div className="mt-4 space-y-3">
          {historyDates.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No attendance recorded yet for this class.
            </p>
          ) : (
            historyMonthGroups.map(({ monthKey, dates }) => {
              const expanded = isMonthExpanded(monthKey);
              return (
                <div
                  key={monthKey}
                  className="overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700"
                >
                  <button
                    type="button"
                    onClick={() => toggleMonthCollapsed(monthKey)}
                    className="flex w-full items-center justify-between gap-2 bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-200/80 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700/80"
                    aria-expanded={expanded}
                  >
                    <span>{formatMonthHeading(monthKey)}</span>
                    <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                      <span className="text-xs font-normal">
                        {dates.length} day{dates.length !== 1 ? "s" : ""}
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="space-y-2 border-t border-gray-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                      {dates.map((d) => {
                        const rows = historyByDate[d] ?? [];
                        const { present, absent, late } =
                          countAttendanceRollup(rows);
                        return (
                          <div
                            key={d}
                            className="flex items-center justify-between gap-3 py-2 text-sm"
                          >
                            <span className="font-medium text-slate-800 dark:text-zinc-200">
                              {formatDisplayDate(d)}
                            </span>
                            <span className="text-right text-slate-600 dark:text-zinc-400">
                              <span className="text-green-600 dark:text-green-400">
                                {present} present
                              </span>
                              <span className="mx-1.5 text-gray-300 dark:text-zinc-600">
                                ·
                              </span>
                              <span className="text-red-600 dark:text-red-400">
                                {absent} absent
                              </span>
                              <span className="mx-1.5 text-gray-300 dark:text-zinc-600">
                                ·
                              </span>
                              <span className="text-yellow-600 dark:text-yellow-400">
                                {late} late
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

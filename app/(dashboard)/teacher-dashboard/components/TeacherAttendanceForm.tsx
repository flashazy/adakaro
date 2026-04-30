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
import {
  DEFAULT_SCHOOL_DISPLAY_TIMEZONE,
  formatDateTimeInSchoolZone,
} from "@/lib/school-timezone";
import type { TeacherClassOption } from "../data";
import { enqueueOrRun } from "@/lib/offline/enqueue-or-run";
import {
  STUDENT_LIST_ROW_OPTIONS,
  TEACHER_ATTENDANCE_ROWS_STORAGE_KEY,
  parseStudentListRowsPerPage,
  type StudentListRowOption,
} from "@/lib/student-list-pagination";
import { getCompactPaginationItems } from "@/lib/pagination-page-items";

/** Recent history is paginated at a fixed page size — the user
 * specifically asked for 5 entries per page, no rows-per-page
 * selector. Bumping this is a one-line change if the requirement
 * shifts later. */
const HISTORY_PAGE_SIZE = 5;

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

function subjectChoiceKeyForOption(o: TeacherClassOption): string {
  return o.subjectId ? `id:${o.subjectId}` : `legacy:${o.subject}`;
}

export function TeacherAttendanceForm({
  options,
  initialClassId,
}: {
  options: TeacherClassOption[];
  initialClassId: string | null;
}) {
  const initialRow =
    options.find((o) => o.classId === initialClassId) ?? options[0];
  const defaultClass = initialRow?.classId ?? "";

  const [classId, setClassId] = useState(defaultClass);
  const [subjectChoiceKey, setSubjectChoiceKey] = useState(() =>
    initialRow ? subjectChoiceKeyForOption(initialRow) : ""
  );
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
  const [savedOffline, setSavedOffline] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("symbol");
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(
    () => new Set()
  );
  const [hasChanges, setHasChanges] = useState(false);
  // Student-list pagination. Default is 10/page; the user can pick
  // 5 (good for phones) or larger sizes via the rows-per-page select.
  // The choice persists per browser via localStorage.
  const [rowsPerPage, setRowsPerPage] = useState<StudentListRowOption>(10);
  const [studentPage, setStudentPage] = useState(1);
  // Recent history — fixed 5 per page + optional date-range filter.
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  /** Per attendance_date: max(updated_at, else created_at) among all rows for that day (ISO). */
  const [historyLastModifiedIsoByDate, setHistoryLastModifiedIsoByDate] =
    useState<Record<string, string>>({});
  const [historyDisplayTimeZone, setHistoryDisplayTimeZone] = useState(
    DEFAULT_SCHOOL_DISPLAY_TIMEZONE
  );

  const uniqueClasses = useMemo(
    () => [...new Map(options.map((o) => [o.classId, o])).values()],
    [options]
  );

  const subjectChoices = useMemo(() => {
    const out: {
      key: string;
      label: string;
      subjectId: string | null;
      academicYear: string;
    }[] = [];
    const seen = new Set<string>();
    for (const o of options) {
      if (o.classId !== classId) continue;
      const key = subjectChoiceKeyForOption(o);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        label: o.subject?.trim() || "General",
        subjectId: o.subjectId,
        academicYear: o.academicYear?.trim() || "",
      });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [options, classId]);

  useEffect(() => {
    if (subjectChoices.length === 0) {
      setSubjectChoiceKey("");
      return;
    }
    setSubjectChoiceKey((prev) =>
      subjectChoices.some((c) => c.key === prev)
        ? prev
        : subjectChoices[0]!.key
    );
  }, [classId, subjectChoices]);

  const selectedSubjectMeta = useMemo(
    () => subjectChoices.find((c) => c.key === subjectChoiceKey),
    [subjectChoices, subjectChoiceKey]
  );

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("attendance-view-mode")
        : null;
    if (saved === "text" || saved === "symbol") {
      setViewMode(saved);
    }
    // Rehydrate the student-list page size from the previous session.
    // Falls back to the default 10 when nothing is stored or the value
    // is no longer in `STUDENT_LIST_ROW_OPTIONS`.
    if (typeof window !== "undefined") {
      const storedRows = parseStudentListRowsPerPage(
        localStorage.getItem(TEACHER_ATTENDANCE_ROWS_STORAGE_KEY)
      );
      if (storedRows != null) setRowsPerPage(storedRows);
    }
  }, []);

  // Force Symbols view on mobile (<768px). The "Text" labels
  // (Present / Absent / Late) wrap badly at 375px, so on small
  // screens we lock the view to the symbol-only buttons regardless
  // of any stored preference. We deliberately use `setViewMode`
  // directly (not `handleViewModeChange`) so we don't overwrite the
  // user's stored desktop preference in localStorage.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = (matches: boolean) => {
      if (matches) setViewMode("symbol");
    };
    apply(mq.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
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
    const res = await loadAttendanceData(classId, date, {
      subjectId: selectedSubjectMeta?.subjectId ?? null,
      assignmentAcademicYear: selectedSubjectMeta?.academicYear ?? null,
    });
    if (!res.ok) {
      setLoadError(res.error);
      setStudents([]);
      setStatusByStudent({});
      setHistoryLastModifiedIsoByDate({});
      setHistoryDisplayTimeZone(DEFAULT_SCHOOL_DISPLAY_TIMEZONE);
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

    const hist = await loadAttendanceHistory(classId, {
      limit: 14,
      subjectId: selectedSubjectMeta?.subjectId ?? null,
    });
    if (hist.ok) {
      setHistoryDates(hist.dates);
      setHistoryByDate(hist.byDate);
      setHistoryLastModifiedIsoByDate(hist.lastModifiedIsoByDate ?? {});
      setHistoryDisplayTimeZone(
        hist.displayTimeZone ?? DEFAULT_SCHOOL_DISPLAY_TIMEZONE
      );
    } else {
      console.error(
        "[TeacherAttendanceForm] loadAttendanceHistory failed",
        hist.error
      );
      setHistoryDates([]);
      setHistoryByDate({});
      setHistoryLastModifiedIsoByDate({});
      setHistoryDisplayTimeZone(DEFAULT_SCHOOL_DISPLAY_TIMEZONE);
    }
  }, [
    classId,
    date,
    selectedSubjectMeta?.subjectId,
    selectedSubjectMeta?.academicYear,
    selectedSubjectMeta?.label,
  ]);

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

  /** Reload attendance for this class/date from the server (last saved). */
  const resetToSavedAttendance = () => {
    startTransition(() => {
      void syncAttendance();
    });
  };

  const handleSave = async () => {
    if (!classId) return;
    setSaveError(null);
    setSaveOk(false);
    setSavedOffline(false);
    setIsSaving(true);
    try {
      const records = students.map((s) => ({
        studentId: s.id,
        status: statusByStudent[s.id] ?? "present",
      }));
      const payload = {
        classId,
        date,
        subjectId: selectedSubjectMeta?.subjectId ?? null,
        assignmentAcademicYear: selectedSubjectMeta?.academicYear ?? null,
        records,
      };
      console.log("[TeacherAttendanceForm] saving", {
        classId,
        date,
        subjectId: selectedSubjectMeta?.subjectId ?? null,
        studentCount: students.length,
        recordCount: records.length,
        online:
          typeof navigator !== "undefined" ? navigator.onLine : "unknown",
      });

      // Offline-aware path: enqueueOrRun calls the action immediately when
      // online and queues to IndexedDB when offline (or when the call
      // throws a network error mid-flight).
      const wrapped = await enqueueOrRun({
        kind: "save-attendance",
        payload,
        run: () => saveAttendanceAction(payload),
        hint: {
          label: `${selectedClassName || classId} · ${date}`,
          attendance: {
            classId,
            date,
            recordCount: records.length,
          },
        },
      });

      if (!wrapped.ok) {
        console.error("[TeacherAttendanceForm] enqueue failed", wrapped.error);
        setSaveError(wrapped.error);
        return;
      }

      if (wrapped.queued) {
        console.log("[TeacherAttendanceForm] saved locally", wrapped.uuid);
        setSavedOffline(true);
        setHasChanges(false);
        return;
      }

      const res = wrapped.result;
      if (!res.ok) {
        console.error("[TeacherAttendanceForm] save failed", res.error);
        setSaveError(res.error);
        return;
      }
      console.log("[TeacherAttendanceForm] save ok", {
        recordCount: records.length,
      });
      setSaveOk(true);
      setHasChanges(false);
      void syncAttendance();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[TeacherAttendanceForm] save threw", e);
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedLabel = useMemo(() => {
    const c = uniqueClasses.find((x) => x.classId === classId);
    if (!c || !selectedSubjectMeta) return "";
    return `${c.className} — ${selectedSubjectMeta.label} (${selectedSubjectMeta.academicYear || "—"})`;
  }, [uniqueClasses, classId, selectedSubjectMeta]);

  const selectedClassName = useMemo(() => {
    const c = uniqueClasses.find((x) => x.classId === classId);
    if (!c || !selectedSubjectMeta) return "";
    return `${c.className} — ${selectedSubjectMeta.label}`;
  }, [uniqueClasses, classId, selectedSubjectMeta]);

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

  // Pagination derived state. Page numbers are 1-indexed; `pageSlice`
  // is what we actually render. The compact page list (with ellipses)
  // mirrors the rest of the dashboard.
  const totalFilteredStudents = filteredStudents.length;
  const studentTotalPages = Math.max(
    1,
    Math.ceil(totalFilteredStudents / rowsPerPage)
  );
  // If the user lands on a page that no longer exists (e.g. they
  // searched and the results shrank), pull them back to page 1 silently
  // rather than rendering an empty page.
  useEffect(() => {
    if (studentPage > studentTotalPages) setStudentPage(1);
  }, [studentPage, studentTotalPages]);
  // Search/filter/class/subject/date changes invalidate the current
  // page — reset to 1 so the user always sees the start of the new
  // result set.
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearch, statusFilter, classId, subjectChoiceKey, date]);

  const studentPageSafe = Math.min(studentPage, studentTotalPages);
  const studentPageStart = (studentPageSafe - 1) * rowsPerPage;
  const studentPageSlice = useMemo(
    () =>
      filteredStudents.slice(studentPageStart, studentPageStart + rowsPerPage),
    [filteredStudents, studentPageStart, rowsPerPage]
  );
  const studentRangeStart =
    totalFilteredStudents === 0 ? 0 : studentPageStart + 1;
  const studentRangeEnd =
    totalFilteredStudents === 0
      ? 0
      : Math.min(studentPageStart + rowsPerPage, totalFilteredStudents);
  const studentPageNumbers = useMemo(
    () => getCompactPaginationItems(studentPageSafe, studentTotalPages),
    [studentPageSafe, studentTotalPages]
  );

  // Recent history filter + pagination.
  //   1. `historyFiltered` honours the optional from/to date range —
  //      both ends are inclusive; either bound can be empty.
  //   2. We slice 5 entries per page, then group THAT slice by month
  //      so the existing collapsible month UI stays intact for the
  //      visible page (a page may contain dates from 1–3 months).
  const historyFiltered = useMemo(() => {
    if (!historyFromDate && !historyToDate) return historyDates;
    return historyDates.filter((d) => {
      if (historyFromDate && d < historyFromDate) return false;
      if (historyToDate && d > historyToDate) return false;
      return true;
    });
  }, [historyDates, historyFromDate, historyToDate]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyFiltered.length / HISTORY_PAGE_SIZE)
  );
  // Same self-correction pattern as the student page.
  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(1);
  }, [historyPage, historyTotalPages]);
  // Filter changes → restart from page 1.
  useEffect(() => {
    setHistoryPage(1);
  }, [historyFromDate, historyToDate]);

  const historyPageSafe = Math.min(historyPage, historyTotalPages);
  const historyPageStart = (historyPageSafe - 1) * HISTORY_PAGE_SIZE;
  const historyPageDates = useMemo(
    () =>
      historyFiltered.slice(
        historyPageStart,
        historyPageStart + HISTORY_PAGE_SIZE
      ),
    [historyFiltered, historyPageStart]
  );
  const historyRangeStart =
    historyFiltered.length === 0 ? 0 : historyPageStart + 1;
  const historyRangeEnd =
    historyFiltered.length === 0
      ? 0
      : Math.min(
          historyPageStart + HISTORY_PAGE_SIZE,
          historyFiltered.length
        );

  const historyMonthGroups = useMemo(
    () => groupHistoryDatesByMonth(historyPageDates),
    [historyPageDates]
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Class
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {uniqueClasses.map((o) => (
                <option key={o.classId} value={o.classId}>
                  {o.className}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              Subject
            </label>
            <select
              value={subjectChoiceKey}
              onChange={(e) => setSubjectChoiceKey(e.target.value)}
              disabled={subjectChoices.length === 0}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {subjectChoices.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
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
        {savedOffline && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Saved locally — will sync when you&apos;re back online.{" "}
            <a
              href="/teacher-dashboard/sync-status"
              className="font-medium underline decoration-dotted underline-offset-2 hover:opacity-80"
            >
              View pending
            </a>
          </p>
        )}

        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="sticky top-0 z-10 rounded-t-lg border-b border-gray-100 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* The Text/Symbols segmented toggle. The "Present /
                  * Absent / Late" labels in Text mode wrap on narrow
                  * phones, so we hide the entire toggle on mobile and
                  * lock the form to Symbols view there (see the
                  * matchMedia effect above). */}
                <div
                  className="hidden rounded-lg bg-gray-100 p-1 dark:bg-zinc-800 md:inline-flex"
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
                {/* Bulk actions row.
                  * Mobile (<768px): "Mark all present" + "Mark all
                  *   absent" share a 2-col grid, with "Reset" stacked
                  *   full-width below. The label sits on its own row
                  *   above the grid.
                  * Desktop (≥768px): the inner grid uses `md:contents`
                  *   so the buttons become direct children of the outer
                  *   flex-wrap, restoring the original horizontal
                  *   layout pixel-for-pixel. */}
                <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Bulk actions:
                  </span>
                  <div className="grid grid-cols-2 gap-2 md:contents">
                    <button
                      type="button"
                      onClick={markAllPresent}
                      className="h-11 rounded-lg bg-green-100 px-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-200/80 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60 md:h-9"
                    >
                      Mark all present
                    </button>
                    <button
                      type="button"
                      onClick={markAllAbsent}
                      className="h-11 rounded-lg bg-red-100 px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-200/80 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60 md:h-9"
                    >
                      Mark all absent
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={resetToSavedAttendance}
                    disabled={!classId || students.length === 0 || isPending}
                    className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:h-9"
                  >
                    Reset
                  </button>
                </div>
                {/* Status filter pills.
                  * Mobile (<768px): equal-width 4-col grid so the pills
                  *   line up neatly and never wrap onto a second row.
                  * Desktop (≥768px): original flex-wrap with content
                  *   widths is preserved.
                  * `min-h-[44px]` ensures comfortable touch targets on
                  *   mobile; `md:min-h-0` releases that on desktop so
                  *   the pills keep their compact `py-1` size. */}
                <div
                  className="grid grid-cols-4 gap-2 md:flex md:flex-wrap"
                  role="group"
                  aria-label="Filter by attendance status"
                >
                  {(
                    [
                      {
                        key: "all" as const,
                        label: "All",
                        // No mobile abbreviation — "All" is already
                        // short enough to fit the 4-col grid cleanly.
                        mobileLabel: "All",
                        title: "Show all students",
                      },
                      {
                        key: "present" as const,
                        label: "Present",
                        mobileLabel: "Pres",
                        title: "Show only Present",
                      },
                      {
                        key: "absent" as const,
                        label: "Absent",
                        mobileLabel: "Abs",
                        title: "Show only Absent",
                      },
                      {
                        key: "late" as const,
                        label: "Late",
                        mobileLabel: "Late",
                        title: "Show only Late",
                      },
                    ] as const
                  ).map(({ key, label, mobileLabel, title }) => {
                    const active = statusFilter === key;
                    // We render BOTH spans and toggle visibility with
                    // responsive utilities so the abbreviation never
                    // leaks onto desktop and vice-versa. The full
                    // `title` attribute still shows the long form on
                    // hover for users on touch devices that map taps
                    // to tooltips.
                    return (
                      <button
                        key={key}
                        type="button"
                        title={title}
                        aria-label={label}
                        aria-pressed={active}
                        onClick={() => setStatusFilter(key)}
                        className={cn(
                          "min-h-[44px] rounded-full border px-3 py-1 text-sm transition-colors md:min-h-0",
                          active
                            ? "border-transparent bg-school-primary text-white hover:bg-school-primary dark:bg-school-primary"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        )}
                      >
                        <span className="md:hidden">{mobileLabel}</span>
                        <span className="hidden md:inline">{label}</span>
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
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-gray-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
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
                {studentPageSlice.map((s) => {
                  const currentStatus = getStatusForStudent(s.id);
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50",
                        // Status-tinted row backgrounds need explicit dark
                        // variants — without them the bg-{color}-50 classes
                        // stay light in dark mode and the white name text
                        // becomes unreadable against them.
                        currentStatus === "present" &&
                          "bg-green-50 dark:bg-green-950/30",
                        currentStatus === "absent" &&
                          "bg-red-50 dark:bg-red-950/30",
                        currentStatus === "late" &&
                          "bg-yellow-50 dark:bg-yellow-950/30"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex flex-wrap items-center gap-y-1 font-medium text-gray-900 dark:text-white">
                          {s.full_name}
                          {frequentAbsenteeIds.has(s.id) ? (
                            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
                              Frequent Absentee
                            </span>
                          ) : null}
                        </span>
                      </div>
                      {viewMode === "symbol"
                        ? renderSymbolButtons(s.id, currentStatus)
                        : renderTextButtons(s.id, currentStatus)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination footer.
            * Always shows the "Showing X–Y of Z" range and the
            * rows-per-page selector when there's at least one student;
            * the page-number buttons only render when there's more
            * than one page. */}
          {students.length > 0 ? (
            <div className="border-t border-gray-100 px-4 py-3 dark:border-zinc-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-zinc-400">
                  <span>
                    Showing{" "}
                    <span className="font-medium text-slate-900 dark:text-white">
                      {studentRangeStart}–{studentRangeEnd}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-slate-900 dark:text-white">
                      {totalFilteredStudents}
                    </span>
                  </span>
                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-xs uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                      Rows
                    </span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        const n = Number(
                          e.target.value
                        ) as StudentListRowOption;
                        setRowsPerPage(n);
                        setStudentPage(1);
                        try {
                          localStorage.setItem(
                            TEACHER_ATTENDANCE_ROWS_STORAGE_KEY,
                            String(n)
                          );
                        } catch {
                          // localStorage may be unavailable in private
                          // mode — failing silently is the right call.
                        }
                      }}
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
                    >
                      {STUDENT_LIST_ROW_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {studentTotalPages > 1 ? (
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setStudentPage((p) => Math.max(1, p - 1))
                      }
                      disabled={studentPageSafe <= 1}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Previous
                    </button>
                    {studentPageNumbers.map((item, idx) =>
                      item === "ellipsis" ? (
                        <span
                          key={`e-${idx}`}
                          className="px-2 text-sm text-slate-400 dark:text-zinc-500"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setStudentPage(item)}
                          className={cn(
                            "min-w-[2.25rem] rounded-md border px-3 py-1 text-sm dark:border-zinc-600",
                            studentPageSafe === item
                              ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          )}
                        >
                          {item}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setStudentPage((p) =>
                          Math.min(studentTotalPages, p + 1)
                        )
                      }
                      disabled={studentPageSafe >= studentTotalPages}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

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
                    : "bg-school-primary hover:brightness-105"
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
          {selectedSubjectMeta?.subjectId
            ? `Latest saved days for ${selectedSubjectMeta.label} in this class (most recent first).`
            : "Latest saved days for this class (class-wide attendance, most recent first)."}
        </p>

        {/* Optional date-range filter. Both bounds are inclusive and
          * either can be left blank, e.g. "from June 1" with no upper
          * bound, or "anything before June 30". */}
        {historyDates.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center sm:gap-3">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Filter by date
            </span>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  From
                </span>
                <input
                  type="date"
                  value={historyFromDate}
                  max={historyToDate || undefined}
                  onChange={(e) => setHistoryFromDate(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:[color-scheme:dark]"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  To
                </span>
                <input
                  type="date"
                  value={historyToDate}
                  min={historyFromDate || undefined}
                  onChange={(e) => setHistoryToDate(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:[color-scheme:dark]"
                />
              </label>
              {historyFromDate || historyToDate ? (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryFromDate("");
                    setHistoryToDate("");
                  }}
                  className="text-xs font-medium text-school-primary hover:opacity-90"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {historyDates.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {selectedSubjectMeta?.subjectId
                ? "No attendance recorded yet for this subject."
                : "No attendance recorded yet for this class."}
            </p>
          ) : historyFiltered.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No saved days match the selected date range.
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
                    <div className="space-y-2 border-t border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 md:px-4">
                      {dates.map((d) => {
                        const rows = historyByDate[d] ?? [];
                        const { present, absent, late } =
                          countAttendanceRollup(rows);
                        // `formatDateTimeInSchoolZone` returns
                        // "30 Apr 2026 - 7:27 am". Split for the mobile
                        // card so the date and time render on separate
                        // lines; falls back to the attendance date
                        // when there's no save timestamp on file.
                        const lastModLabel = formatDateTimeInSchoolZone(
                          historyLastModifiedIsoByDate[d],
                          historyDisplayTimeZone
                        );
                        const [savedDateLabel, savedTimeLabel] = (
                          lastModLabel ?? ""
                        )
                          .split(" - ")
                          .map((s) => s.trim());
                        const dateLine = savedDateLabel || formatDisplayDate(d);
                        return (
                          <div
                            key={d}
                            className="text-sm"
                          >
                            {/* Mobile card (<768px) — vertical stack */}
                            <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-800/50 md:hidden">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {dateLine}
                              </p>
                              {savedTimeLabel ? (
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                  Saved {savedTimeLabel}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  ✓ Saved
                                </span>
                                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                                  {present} present
                                </span>
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                  {absent} absent
                                </span>
                                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">
                                  {late} late
                                </span>
                              </div>
                            </div>

                            {/* Desktop row (≥768px) — unchanged horizontal layout */}
                            <div className="hidden items-center justify-between gap-3 py-2 md:flex">
                              <span className="font-medium text-slate-800 dark:text-zinc-200">
                                {lastModLabel ?? formatDisplayDate(d)}
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

        {/* Previous / Next pagination — only renders when the filtered
          * history actually spans more than one page (5 entries each).
          * The "Page X of Y · showing N–M of T" line keeps the user
          * oriented even when the page-number list is hidden. */}
        {historyFiltered.length > HISTORY_PAGE_SIZE ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Page{" "}
              <span className="font-medium text-slate-700 dark:text-zinc-200">
                {historyPageSafe}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700 dark:text-zinc-200">
                {historyTotalPages}
              </span>{" "}
              · showing{" "}
              <span className="font-medium text-slate-700 dark:text-zinc-200">
                {historyRangeStart}–{historyRangeEnd}
              </span>{" "}
              of {historyFiltered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPageSafe <= 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                }
                disabled={historyPageSafe >= historyTotalPages}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

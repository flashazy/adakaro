"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ClassAttendanceStatus } from "@/lib/class-attendance/class-attendance-types";
import type {
  ClassAttendanceHistoryRow,
  ClassAttendanceStudentRow,
} from "@/lib/class-attendance/class-attendance-types";
import type { ClassAttendanceDaySummary } from "@/lib/class-attendance/class-attendance-types";
import {
  formatSaveConfirmation,
  todayIsoDate,
} from "@/lib/class-attendance/class-attendance-utils";
import {
  loadClassAttendancePageAction,
  loadClassAttendanceStudentsPageAction,
  saveClassAttendanceAction,
  type SaveClassAttendanceEntry,
} from "@/app/(dashboard)/teacher-dashboard/class-teacher/class-attendance-actions";
import { StudentListPaginationBar } from "@/components/shared/student-list-table-controls";
import {
  CLASS_ATTENDANCE_ROWS_STORAGE_KEY,
  DEFAULT_LARGE_STUDENT_LIST_ROWS,
  parseLargeStudentListRowsPerPage,
  type LargeStudentListRowOption,
} from "@/lib/student-list-pagination";
import {
  ClassAttendanceDesktopRow,
  ClassAttendanceDesktopTableHeader,
  ClassAttendanceHistorySection,
  ClassAttendancePageHeader,
  ClassAttendanceQuickActions,
  ClassAttendanceSearchToolbar,
  ClassAttendanceStickySaveBar,
  ClassAttendanceStudentCard,
  ClassAttendanceSummaryStrip,
  computeLiveSummaryFromEdits,
} from "@/components/class-teacher/class-attendance/class-attendance-ui";

type AttendanceEdit = {
  status: ClassAttendanceStatus;
  notes: string | null;
};

function readStoredRowsPerPage(): LargeStudentListRowOption {
  if (typeof window === "undefined") return DEFAULT_LARGE_STUDENT_LIST_ROWS;
  try {
    return (
      parseLargeStudentListRowsPerPage(
        localStorage.getItem(CLASS_ATTENDANCE_ROWS_STORAGE_KEY)
      ) ?? DEFAULT_LARGE_STUDENT_LIST_ROWS
    );
  } catch {
    return DEFAULT_LARGE_STUDENT_LIST_ROWS;
  }
}

export function ClassAttendanceForm(props: {
  classId: string;
  className: string;
  initialDate: string;
  initialHasRecords: boolean;
  initialHistory: ClassAttendanceHistoryRow[];
  totalClassStudents: number;
  initialDaySummary: ClassAttendanceDaySummary | null;
}) {
  const router = useRouter();
  const today = todayIsoDate();
  const [attendanceDate, setAttendanceDate] = useState(props.initialDate);
  const [hasRecords, setHasRecords] = useState(props.initialHasRecords);
  const [history, setHistory] = useState(props.initialHistory);
  const [daySummary, setDaySummary] = useState(props.initialDaySummary);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] =
    useState<LargeStudentListRowOption>(DEFAULT_LARGE_STUDENT_LIST_ROWS);
  const [pageStudents, setPageStudents] = useState<ClassAttendanceStudentRow[]>(
    []
  );
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [summaryTick, setSummaryTick] = useState(0);
  const [pending, startTransition] = useTransition();
  const [loadingDate, startDateTransition] = useTransition();
  const [loadingStudents, startStudentsTransition] = useTransition();
  const scrollTargetRef = useRef<string | null>(null);
  const attendanceEditsRef = useRef<Map<string, AttendanceEdit>>(new Map());
  const skipPageResetRef = useRef(false);

  useEffect(() => {
    setRowsPerPage(readStoredRowsPerPage());
  }, []);

  const recordedToday = useMemo(
    () => history.some((h) => h.attendanceDate === today),
    [history, today]
  );

  const showRecordedTodayBadge =
    attendanceDate === today && (hasRecords || recordedToday);

  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [deferredQuery, rowsPerPage]);

  useEffect(() => {
    setHistory(props.initialHistory);
    setHasRecords(props.initialHasRecords);
    setDaySummary(props.initialDaySummary);
  }, [props.initialHistory, props.initialHasRecords, props.initialDaySummary]);

  const displaySummary = useMemo(() => {
    void summaryTick;
    if (dirty || !daySummary) {
      return computeLiveSummaryFromEdits(
        attendanceEditsRef.current,
        props.totalClassStudents
      );
    }
    return daySummary;
  }, [
    dirty,
    daySummary,
    summaryTick,
    props.totalClassStudents,
  ]);

  const mergePageStudents = useCallback(
    (rows: ClassAttendanceStudentRow[]) => {
      const edits = attendanceEditsRef.current;
      return rows.map((s) => {
        const edit = edits.get(s.id);
        if (edit) {
          return { ...s, status: edit.status, notes: edit.notes };
        }
        edits.set(s.id, { status: s.status, notes: s.notes });
        return s;
      });
    },
    []
  );

  const bumpSummary = useCallback(() => {
    setSummaryTick((t) => t + 1);
  }, []);

  const fetchStudents = useCallback(
    (targetPage: number) => {
      startStudentsTransition(async () => {
        const res = await loadClassAttendanceStudentsPageAction({
          classId: props.classId,
          attendanceDate,
          page: targetPage,
          pageSize: rowsPerPage,
          search: deferredQuery,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setTotalCount(res.data.totalCount);
        setPageStudents(mergePageStudents(res.data.students));
        setPage(res.data.page);
        bumpSummary();
      });
    },
    [
      props.classId,
      attendanceDate,
      rowsPerPage,
      deferredQuery,
      mergePageStudents,
      bumpSummary,
    ]
  );

  useEffect(() => {
    fetchStudents(safePage);
  }, [fetchStudents, safePage]);

  const rangeStart =
    totalCount === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const rangeEnd =
    totalCount === 0 ? 0 : Math.min(safePage * rowsPerPage, totalCount);

  const isFiltering = query.trim() !== deferredQuery.trim();
  const noStudentsInClass = props.totalClassStudents === 0;
  const noSearchResults =
    !noStudentsInClass && totalCount === 0 && deferredQuery.trim().length > 0;

  const setStatus = useCallback(
    (studentId: string, status: ClassAttendanceStatus) => {
      const edits = attendanceEditsRef.current;
      const prev = edits.get(studentId);
      edits.set(studentId, {
        status,
        notes: prev?.notes ?? null,
      });
      setPageStudents((prevRows) =>
        prevRows.map((s) => (s.id === studentId ? { ...s, status } : s))
      );
      setDirty(true);
      setMessage(null);
      setError(null);
      bumpSummary();
    },
    [bumpSummary]
  );

  const applyToCurrentPage = useCallback(
    (status: ClassAttendanceStatus) => {
      const edits = attendanceEditsRef.current;
      for (const s of pageStudents) {
        const prev = edits.get(s.id);
        edits.set(s.id, { status, notes: prev?.notes ?? null });
      }
      setPageStudents((prev) => prev.map((s) => ({ ...s, status })));
      setDirty(true);
      setSelected(new Set());
      bumpSummary();
    },
    [pageStudents, bumpSummary]
  );

  const applyToSelected = useCallback(
    (status: ClassAttendanceStatus) => {
      if (selected.size === 0) return;
      const edits = attendanceEditsRef.current;
      for (const id of selected) {
        const prev = edits.get(id);
        edits.set(id, { status, notes: prev?.notes ?? null });
      }
      setPageStudents((prev) =>
        prev.map((s) => (selected.has(s.id) ? { ...s, status } : s))
      );
      setDirty(true);
      bumpSummary();
    },
    [selected, bumpSummary]
  );

  const toggleSelect = useCallback((studentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }, []);

  const toggleSelectPage = useCallback(() => {
    const pageIds = pageStudents.map((s) => s.id);
    setSelected((prev) => {
      const allSelected =
        pageIds.length > 0 && pageIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of pageIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of pageIds) next.add(id);
      return next;
    });
  }, [pageStudents]);

  const reloadMeta = useCallback(
    async (date: string) => {
      const res = await loadClassAttendancePageAction({
        classId: props.classId,
        attendanceDate: date,
      });
      if (res.ok) {
        setHistory(res.data.history);
        setHasRecords(res.data.hasRecordsForDate);
        setDaySummary(res.data.daySummary);
        bumpSummary();
      }
    },
    [props.classId, bumpSummary]
  );

  const onDateChange = (value: string) => {
    if (!value || value === attendanceDate) return;
    startDateTransition(async () => {
      setError(null);
      setMessage(null);
      attendanceEditsRef.current = new Map();
      setDirty(false);
      setSelected(new Set());
      setPage(1);
      setAttendanceDate(value);
      router.replace(
        `/teacher-dashboard/class-teacher/${props.classId}/class-attendance?date=${encodeURIComponent(value)}`,
        { scroll: false }
      );
      await reloadMeta(value);
    });
  };

  const onRowsPerPageChange = (n: number) => {
    const v = n as LargeStudentListRowOption;
    setRowsPerPage(v);
    try {
      localStorage.setItem(CLASS_ATTENDANCE_ROWS_STORAGE_KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  const onSave = () => {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const entries: SaveClassAttendanceEntry[] = [
        ...attendanceEditsRef.current.entries(),
      ].map(([studentId, edit]) => ({
        studentId,
        status: edit.status,
        notes: edit.notes,
      }));

      const res = await saveClassAttendanceAction({
        classId: props.classId,
        attendanceDate,
        entries,
      });
      if (!res.ok) {
        setError(res.error);
        if (scrollTargetRef.current) {
          document
            .getElementById(`class-attendance-row-${scrollTargetRef.current}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      setDirty(false);
      setHasRecords(true);
      setDaySummary(res.summary);
      setMessage(
        `Class attendance saved. ${formatSaveConfirmation(res.summary)}`
      );
      skipPageResetRef.current = true;
      router.refresh();
      await reloadMeta(attendanceDate);
      fetchStudents(safePage);
    });
  };

  const attendanceHref = (date: string) =>
    `/teacher-dashboard/class-teacher/${props.classId}/class-attendance?date=${encodeURIComponent(date)}`;

  const allPageSelected =
    pageStudents.length > 0 &&
    pageStudents.every((s) => selected.has(s.id));

  const listBusy = loadingStudents || loadingDate || pending;

  const handleSelectStatus = (studentId: string, status: ClassAttendanceStatus) => {
    scrollTargetRef.current = studentId;
    setStatus(studentId, status);
  };

  return (
    <div className={dirty ? "space-y-6 pb-28" : "space-y-6 pb-6"}>
      <ClassAttendancePageHeader
        className={props.className}
        attendanceDate={attendanceDate}
        showRecordedTodayBadge={showRecordedTodayBadge}
        hasRecords={hasRecords}
        loadingDate={loadingDate}
        listBusy={listBusy}
        onDateChange={onDateChange}
      />

      {!noStudentsInClass ? (
        <ClassAttendanceSummaryStrip
          summary={displaySummary}
          totalStudents={props.totalClassStudents}
          live={dirty || !daySummary}
        />
      ) : null}

      {message ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <ClassAttendanceQuickActions
          listBusy={listBusy}
          pageEmpty={pageStudents.length === 0}
          selectedCount={selected.size}
          onResetPresent={() => applyToCurrentPage("present")}
          onResetAbsent={() => applyToCurrentPage("absent")}
          onMarkSelectedPresent={() => applyToSelected("present")}
          onMarkSelectedAbsent={() => applyToSelected("absent")}
        />

        <ClassAttendanceSearchToolbar
          searchId="class-attendance-student-search"
          query={query}
          onQueryChange={setQuery}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
          rangeLabel={
            noStudentsInClass
              ? "No students in this class"
              : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`
          }
        />

        {noStudentsInClass ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-zinc-400">
            No active students in this class.
          </p>
        ) : noSearchResults ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500 dark:text-zinc-400">
            No students found
          </p>
        ) : (
          <>
            {isFiltering || loadingStudents ? (
              <p className="border-b border-slate-100 px-4 py-2 text-center text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                {loadingStudents ? "Loading students…" : "Filtering…"}
              </p>
            ) : null}

            <div className="hidden md:block">
              <table className="w-full text-left">
                <ClassAttendanceDesktopTableHeader
                  allPageSelected={allPageSelected}
                  onToggleSelectPage={toggleSelectPage}
                />
                <tbody>
                  {pageStudents.map((s) => (
                    <ClassAttendanceDesktopRow
                      key={s.id}
                      student={s}
                      selected={selected.has(s.id)}
                      onToggleSelect={() => toggleSelect(s.id)}
                      onSelectStatus={(st) => handleSelectStatus(s.id, st)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 p-3 md:hidden">
              {pageStudents.map((s) => (
                <li key={s.id}>
                  <ClassAttendanceStudentCard
                    student={s}
                    selected={selected.has(s.id)}
                    onToggleSelect={() => toggleSelect(s.id)}
                    onSelectStatus={(st) => handleSelectStatus(s.id, st)}
                  />
                </li>
              ))}
            </ul>

            <StudentListPaginationBar
              page={safePage}
              totalPages={totalPages}
              onPage={setPage}
            />
          </>
        )}

        {!dirty ? (
          <div className="hidden border-t border-slate-100 px-4 py-4 dark:border-zinc-800 sm:block">
            <button
              type="button"
              onClick={onSave}
              disabled={listBusy || noStudentsInClass}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-school-primary px-6 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving attendance…" : "Save Class Attendance"}
            </button>
          </div>
        ) : null}
      </section>

      <ClassAttendanceHistorySection
        history={history}
        attendanceHref={attendanceHref}
      />

      <ClassAttendanceStickySaveBar
        dirty={dirty}
        pending={pending}
        disabled={listBusy || noStudentsInClass}
        onSave={onSave}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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

const STATUS_LABEL: Record<Status, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
};

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

  const syncAttendance = useCallback(async () => {
    if (!classId) return;
    setLoadError(null);
    setSaveOk(false);
    const res = await loadAttendanceData(classId, date);
    if (!res.ok) {
      setLoadError(res.error);
      setStudents([]);
      setStatusByStudent({});
      return;
    }
    setStudents(res.students);
    const next: Record<string, Status> = {};
    for (const s of res.students) {
      next[s.id] = res.attendance[s.id] ?? "present";
    }
    setStatusByStudent(next);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;
    setSaveError(null);
    setSaveOk(false);
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
    void syncAttendance();
  };

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => x.classId === classId);
    if (!o) return "";
    return `${o.className} — ${o.subject || "General"} (${o.academicYear || "—"})`;
  }, [options, classId]);

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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Class
            </span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {options.map((o) => (
                <option key={o.assignmentId} value={o.classId}>
                  {o.className} — {o.subject || "General"} · {o.academicYear || "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
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

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-700">
            <thead className="bg-slate-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-zinc-300">
                  Student
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-zinc-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {isPending && students.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-6 text-slate-500 dark:text-zinc-400"
                  >
                    Loading students…
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-6 text-slate-500 dark:text-zinc-400"
                  >
                    No active students in this class.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">
                      {s.full_name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {(["present", "absent", "late"] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setStatus(s.id, st)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              (statusByStudent[s.id] ?? "present") === st
                                ? st === "present"
                                  ? "bg-emerald-600 text-white"
                                  : st === "absent"
                                    ? "bg-red-600 text-white"
                                    : "bg-amber-500 text-white"
                                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {STATUS_LABEL[st]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button
          type="submit"
          disabled={!classId || students.length === 0 || isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          Save attendance
        </button>
      </form>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Recent history
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Latest saved days for this class (most recent first).
        </p>
        <div className="mt-4 space-y-4">
          {historyDates.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No attendance recorded yet for this class.
            </p>
          ) : (
            historyDates.map((d) => (
              <div
                key={d}
                className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {d}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-zinc-400">
                  {(historyByDate[d] ?? []).map((row) => (
                    <li key={`${row.student_id}-${d}`}>
                      <span className="font-medium text-slate-800 dark:text-zinc-200">
                        {row.student_name}
                      </span>
                      : {row.status}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

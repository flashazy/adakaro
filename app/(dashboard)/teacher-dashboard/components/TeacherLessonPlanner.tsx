"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteLessonAction,
  loadLessonsInRange,
  upsertLessonAction,
} from "../actions";

export type LessonClassOption = {
  assignmentId: string;
  classId: string;
  className: string;
  subject: string;
  academicYear: string;
};

function monthRange(year: number, month0: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month0 + 1, 0);
  const s = `${year}-${pad(month0 + 1)}-01`;
  const e = `${year}-${pad(month0 + 1)}-${pad(lastDay.getDate())}`;
  return { start: s, end: e };
}

export function TeacherLessonPlanner({
  options,
  initialClassId,
}: {
  options: LessonClassOption[];
  initialClassId: string | null;
}) {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [classId, setClassId] = useState(
    options.find((o) => o.classId === initialClassId)?.classId ??
      options[0]?.classId ??
      ""
  );
  const [subject, setSubject] = useState(options[0]?.subject ?? "");

  const [lessons, setLessons] = useState<
    {
      id: string;
      class_id: string;
      subject: string;
      lesson_date: string;
      topic: string;
      objectives: string | null;
      materials: string | null;
      procedure: string | null;
      assessment: string | null;
      homework: string | null;
      notes: string | null;
    }[]
  >([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [lessonDate, setLessonDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [topic, setTopic] = useState("");
  const [objectives, setObjectives] = useState("");
  const [materials, setMaterials] = useState("");
  const [procedure, setProcedure] = useState("");
  const [assessment, setAssessment] = useState("");
  const [homework, setHomework] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { start, end } = useMemo(() => monthRange(y, m), [y, m]);

  const subjectsForClass = useMemo(() => {
    const set = new Set<string>();
    for (const o of options) {
      if (o.classId === classId) {
        set.add(o.subject?.trim() || "General");
      }
    }
    return [...set];
  }, [options, classId]);

  const load = useCallback(async () => {
    setError(null);
    const res = await loadLessonsInRange(start, end);
    if (!res.ok) {
      setError(res.error);
      setLessons([]);
      return;
    }
    setLessons(
      classId
        ? res.lessons.filter((l) => l.class_id === classId)
        : res.lessons
    );
  }, [start, end, classId]);

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setTopic("");
    setObjectives("");
    setMaterials("");
    setProcedure("");
    setAssessment("");
    setHomework("");
    setNotes("");
    setLessonDate(new Date().toISOString().slice(0, 10));
  };

  const startEdit = (lesson: (typeof lessons)[0]) => {
    setEditingId(lesson.id);
    setLessonDate(lesson.lesson_date);
    setTopic(lesson.topic);
    setObjectives(lesson.objectives ?? "");
    setMaterials(lesson.materials ?? "");
    setProcedure(lesson.procedure ?? "");
    setAssessment(lesson.assessment ?? "");
    setHomework(lesson.homework ?? "");
    setNotes(lesson.notes ?? "");
    setSubject(lesson.subject || "General");
    setClassId(lesson.class_id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;
    setError(null);
    setSuccess(null);
    const res = await upsertLessonAction({
      id: editingId ?? undefined,
      classId,
      subject: subject.trim() || "General",
      lessonDate,
      topic,
      objectives,
      materials,
      procedure,
      assessment,
      homework,
      notes,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(editingId ? "Lesson updated." : "Lesson saved.");
    resetForm();
    void load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lesson?")) return;
    setError(null);
    const res = await deleteLessonAction(id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess("Lesson deleted.");
    if (editingId === id) resetForm();
    void load();
  };

  const monthLabel = new Date(y, m, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const calCells = useMemo(() => {
    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { day: number | null; iso: string | null }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, iso });
    }
    return cells;
  }, [y, m]);

  const lessonsByDate = useMemo(() => {
    const map = new Map<string, typeof lessons>();
    for (const l of lessons) {
      if (!map.has(l.lesson_date)) map.set(l.lesson_date, []);
      map.get(l.lesson_date)!.push(l);
    }
    return map;
  }, [lessons]);

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        No class assignments yet. Your administrator must assign classes before
        you can plan lessons.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {success}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const d = new Date(y, m - 1, 1);
              setY(d.getFullYear());
              setM(d.getMonth());
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            ←
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-900 dark:text-white">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(y, m + 1, 1);
              setY(d.getFullYear());
              setM(d.getMonth());
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            →
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="mr-2 text-slate-600 dark:text-zinc-400">Class</span>
            <select
              value={classId}
              onChange={(e) => {
                const next = e.target.value;
                setClassId(next);
                const o = options.find((x) => x.classId === next);
                if (o) setSubject(o.subject?.trim() || "General");
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {[...new Map(options.map((o) => [o.classId, o])).values()].map(
                (o) => (
                  <option key={o.classId} value={o.classId}>
                    {o.className}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="text-sm">
            <span className="mr-2 text-slate-600 dark:text-zinc-400">
              Subject
            </span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {subjectsForClass.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase text-slate-500 dark:text-zinc-400">
          Calendar
        </p>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-zinc-400">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calCells.map((c, i) =>
            c.day == null ? (
              <div key={`e-${i}`} />
            ) : (
              <button
                key={c.iso!}
                type="button"
                onClick={() => {
                  setLessonDate(c.iso!);
                  setEditingId(null);
                  setTopic("");
                }}
                className={`min-h-[3rem] rounded-lg border p-1 text-left text-xs transition ${
                  lessonDate === c.iso
                    ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                    : "border-slate-100 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {c.day}
                </span>
                {(lessonsByDate.get(c.iso!) ?? []).length > 0 && (
                  <span className="mt-0.5 block text-[10px] text-indigo-600 dark:text-indigo-400">
                    {(lessonsByDate.get(c.iso!) ?? []).length} lesson
                    {(lessonsByDate.get(c.iso!) ?? []).length === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            )
          )}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {editingId ? "Edit lesson" : "New lesson"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Date
            </span>
            <input
              type="date"
              required
              value={lessonDate}
              onChange={(e) => setLessonDate(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Topic
            </span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Lesson topic"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Objectives
            </span>
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Materials
            </span>
            <textarea
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Procedure
            </span>
            <textarea
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Assessment
            </span>
            <textarea
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Homework
            </span>
            <textarea
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {editingId ? "Update lesson" : "Save lesson"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Lessons this month
        </h2>
        <ul className="mt-3 space-y-3">
          {lessons.length === 0 ? (
            <li className="text-sm text-slate-500 dark:text-zinc-400">
              No lessons in this month for the selected class filter.
            </li>
          ) : (
            lessons
              .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date))
              .map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {l.lesson_date} · {l.topic || "Lesson"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {l.subject || "General"}
                    </p>
                    {l.objectives && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                        {l.objectives.slice(0, 160)}
                        {l.objectives.length > 160 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(l)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(l.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))
          )}
        </ul>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createGradebookAssignmentAction,
  loadGradebookAssignmentsForClass,
  loadGradebookMatrix,
  saveScoresAction,
} from "../actions";

export type GradebookClassOption = {
  assignmentId: string;
  classId: string;
  className: string;
  subject: string;
  academicYear: string;
};

type GbAssignment = {
  id: string;
  title: string;
  max_score: number;
  weight: number;
  due_date: string | null;
  subject: string;
};

export function TeacherGradebook({
  options,
  initialClassId,
}: {
  options: GradebookClassOption[];
  initialClassId: string | null;
}) {
  const first = options[0];
  const [classId, setClassId] = useState(
    options.find((o) => o.classId === initialClassId)?.classId ?? first?.classId ?? ""
  );
  const [subject, setSubject] = useState(first?.subject ?? "");
  const [assignments, setAssignments] = useState<GbAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [matrix, setMatrix] = useState<{
    assignment: {
      id: string;
      class_id: string;
      subject: string;
      title: string;
      max_score: number;
      weight: number;
      due_date: string | null;
      teacher_id: string;
    };
    students: { id: string; full_name: string }[];
    scoreByStudent: Record<
      string,
      { score: number | null; comments: string | null }
    >;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [weight, setWeight] = useState("100");
  const [dueDate, setDueDate] = useState("");

  const [scores, setScores] = useState<
    Record<string, { score: string; comments: string }>
  >({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subjectsForClass = useMemo(() => {
    const set = new Set<string>();
    for (const o of options) {
      if (o.classId === classId) {
        set.add(o.subject?.trim() || "General");
      }
    }
    return [...set];
  }, [options, classId]);

  useEffect(() => {
    const o = options.find((x) => x.classId === classId);
    if (o && !subject) setSubject(o.subject?.trim() || "General");
  }, [classId, options, subject]);

  const fetchAssignments = useCallback(async () => {
    setError(null);
    if (!classId || !subject) {
      setAssignments([]);
      return;
    }
    const res = await loadGradebookAssignmentsForClass(classId, subject);
    if (!res.ok) {
      setError(res.error);
      setAssignments([]);
      return;
    }
    setAssignments(res.assignments as GbAssignment[]);
  }, [classId, subject]);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    if (!assignmentId) {
      setMatrix(null);
      setScores({});
      return;
    }
    startTransition(() => {
      void (async () => {
        setError(null);
        const res = await loadGradebookMatrix(assignmentId);
        if (!res.ok) {
          setError(res.error);
          setMatrix(null);
          return;
        }
        setMatrix(res);
        const next: Record<string, { score: string; comments: string }> = {};
        for (const s of res.students) {
          const ex = res.scoreByStudent[s.id];
          next[s.id] = {
            score:
              ex?.score != null && !Number.isNaN(Number(ex.score))
                ? String(ex.score)
                : "",
            comments: ex?.comments ?? "",
          };
        }
        setScores(next);
      })();
    });
  }, [assignmentId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const mx = Number(maxScore);
    const w = Number(weight);
    if (!title.trim() || !classId || !subject.trim()) {
      setError("Title, class, and subject are required.");
      return;
    }
    if (!Number.isFinite(mx) || mx <= 0) {
      setError("Max score must be a positive number.");
      return;
    }
    if (!Number.isFinite(w) || w < 0) {
      setError("Weight must be zero or positive.");
      return;
    }
    const res = await createGradebookAssignmentAction({
      classId,
      subject: subject.trim(),
      title: title.trim(),
      maxScore: mx,
      weight: w,
      dueDate: dueDate || null,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess("Assignment created.");
    setTitle("");
    setDueDate("");
    await fetchAssignments();
    if (res.assignmentId) setAssignmentId(res.assignmentId);
  };

  const handleSaveScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matrix) return;
    setError(null);
    setSuccess(null);
    const list = matrix.students.map((s) => {
      const raw = scores[s.id]?.score?.trim() ?? "";
      const num = raw === "" ? null : Number(raw);
      return {
        studentId: s.id,
        score: num != null && Number.isFinite(num) ? num : null,
        comments: scores[s.id]?.comments?.trim() || null,
      };
    });
    const res = await saveScoresAction({
      assignmentId: matrix.assignment.id,
      scores: list,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess("Scores saved.");
  };

  const pct = (score: number | null, max: number) =>
    score != null && max > 0 ? Math.round((score / max) * 1000) / 10 : null;

  const classAveragePct = useMemo(() => {
    if (!matrix) return null;
    const max = matrix.assignment.max_score;
    const vals = matrix.students
      .map((s) => {
        const raw = scores[s.id]?.score?.trim() ?? "";
        if (raw === "") return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        return pct(n, max);
      })
      .filter((x): x is number => x != null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [matrix, scores]);

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        No class assignments yet. Ask your administrator to assign you to classes.
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

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Filter
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Class
            </span>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setAssignmentId("");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
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
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Subject
            </span>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setAssignmentId("");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {subjectsForClass.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          New assignment
        </h2>
        <form onSubmit={handleCreateAssignment} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="e.g. Mid-term test"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Max score
            </span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Weight (%)
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Due date (optional)
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create assignment
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Enter scores
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Choose an assignment, enter scores (leave blank if not graded). Class
          average % is computed from entered rows.
        </p>
        <div className="mt-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Assignment
            </span>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className="mt-1 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">Select assignment…</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} (max {a.max_score})
                </option>
              ))}
            </select>
          </label>
        </div>

        {matrix && (
          <form onSubmit={handleSaveScores} className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-zinc-400">
              <span>
                Max score:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {matrix.assignment.max_score}
                </strong>
              </span>
              {classAveragePct != null && (
                <span>
                  Class average:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {classAveragePct}%
                  </strong>
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-zinc-700">
                <thead className="bg-slate-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    <th className="px-3 py-2 text-left">%</th>
                    <th className="px-3 py-2 text-left">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {isPending && matrix.students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : (
                    matrix.students.map((s) => {
                      const raw = scores[s.id]?.score?.trim() ?? "";
                      const n = raw === "" ? null : Number(raw);
                      const p =
                        n != null && Number.isFinite(n)
                          ? pct(n, matrix.assignment.max_score)
                          : null;
                      return (
                        <tr key={s.id}>
                          <td className="px-3 py-2 text-slate-900 dark:text-white">
                            {s.full_name}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step={0.01}
                              value={scores[s.id]?.score ?? ""}
                              onChange={(e) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    score: e.target.value,
                                    comments: prev[s.id]?.comments ?? "",
                                  },
                                }))
                              }
                              className="w-24 rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                            {p != null ? `${p}%` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={scores[s.id]?.comments ?? ""}
                              onChange={(e) =>
                                setScores((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    score: prev[s.id]?.score ?? "",
                                    comments: e.target.value,
                                  },
                                }))
                              }
                              className="w-full min-w-[8rem] rounded border border-slate-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Save scores
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

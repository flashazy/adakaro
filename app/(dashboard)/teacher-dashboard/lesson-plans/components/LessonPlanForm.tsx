"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createLessonPlan,
  getAttendanceCount,
  getClassDemographics,
  updateLessonPlan,
} from "../actions";
import { TeachingLearningProcessTable } from "./TeachingLearningProcessTable";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export interface LessonPlanFormClassOption {
  id: string;
  name: string;
}

export interface LessonPlanFormSubjectOption {
  id: string;
  name: string;
}

/** Saved row shape from `lesson_plans` (subset used by the form). */
export interface LessonPlanFormInitialData {
  class_id: string;
  subject_id: string;
  lesson_date: string;
  period: number;
  duration_minutes: number;
  total_boys: number;
  total_girls: number;
  total_pupils: number;
  present_count: number;
  main_competence: string;
  specific_competence: string;
  main_activities: string;
  specific_activities: string;
  teaching_resources: string;
  references: string;
  /** JSONB `teaching_learning_process` from DB. */
  teaching_learning_process?: unknown;
  remarks: string;
}

interface LessonPlanFormProps {
  classes: LessonPlanFormClassOption[];
  subjects: LessonPlanFormSubjectOption[];
  mode: "create" | "edit";
  planId?: string;
  initialData?: LessonPlanFormInitialData | null;
}

const DURATIONS = [30, 40, 45, 60, 90, 120] as const;
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deduplicate classes when the same class appears on multiple assignments.
 */
function dedupeClasses(
  list: LessonPlanFormClassOption[]
): LessonPlanFormClassOption[] {
  const map = new Map<string, string>();
  for (const c of list) {
    if (c?.id) map.set(c.id, c.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

export function LessonPlanForm({
  classes,
  subjects,
  mode,
  planId,
  initialData,
}: LessonPlanFormProps) {
  const [classId, setClassId] = useState(
    initialData?.class_id ?? ""
  );
  const [lessonDate, setLessonDate] = useState(
    initialData?.lesson_date ?? todayIsoDate()
  );

  /** Auto-calculated from `students` for the selected class (read-only in UI). */
  const [demographics, setDemographics] = useState({
    total: initialData?.total_pupils ?? 0,
    boys: initialData?.total_boys ?? 0,
    girls: initialData?.total_girls ?? 0,
  });
  /** Auto-calculated from `teacher_attendance` for class + date. */
  const [presentCount, setPresentCount] = useState(
    initialData?.present_count ?? 0
  );
  const [loadingStats, setLoadingStats] = useState(false);

  const classList = useMemo(() => dedupeClasses(classes), [classes]);

  /** Load pupil counts + present count together when class or date changes. */
  useEffect(() => {
    const run = async () => {
      if (!classId) {
        setDemographics({ total: 0, boys: 0, girls: 0 });
        setPresentCount(0);
        return;
      }
      setLoadingStats(true);
      try {
        const d = await getClassDemographics(classId);
        setDemographics({
          total: d.total,
          boys: d.boys,
          girls: d.girls,
        });
        const present =
          lessonDate.trim() !== ""
            ? await getAttendanceCount(classId, lessonDate)
            : 0;
        setPresentCount(present);
      } finally {
        setLoadingStats(false);
      }
    };
    void run();
  }, [classId, lessonDate]);

  const formAction =
    mode === "edit" && planId
      ? updateLessonPlan.bind(null, planId)
      : createLessonPlan;

  return (
    <form action={formAction} className="space-y-8">

      {/* Section 1 — Basic info */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Section 1 — Basic information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Date <span className="text-red-600">*</span>
            </span>
            <input
              type="date"
              name="lesson_date"
              required
              value={lessonDate}
              onChange={(e) => setLessonDate(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 px-3 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Subject <span className="text-red-600">*</span>
            </span>
            <select
              name="subject_id"
              required
              defaultValue={initialData?.subject_id ?? ""}
              className="h-10 rounded-lg border border-gray-200 px-3 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Class <span className="text-red-600">*</span>
            </span>
            <select
              name="class_id"
              required
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 px-3 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">Select class</option>
              {classList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Period <span className="text-red-600">*</span>
            </span>
            <select
              name="period"
              required
              defaultValue={initialData?.period ?? 1}
              className="h-10 rounded-lg border border-gray-200 px-3 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                  {p === 1
                    ? "st"
                    : p === 2
                      ? "nd"
                      : p === 3
                        ? "rd"
                        : "th"}{" "}
                  period
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Time / duration (minutes) <span className="text-red-600">*</span>
            </span>
            <select
              name="duration_minutes"
              required
              defaultValue={initialData?.duration_minutes ?? 40}
              className="h-10 max-w-xs rounded-lg border border-gray-200 px-3 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Hidden fields: synced with auto-calculated values on submit */}
      <input type="hidden" name="total_boys" value={demographics.boys} />
      <input type="hidden" name="total_girls" value={demographics.girls} />
      <input type="hidden" name="total_pupils" value={demographics.total} />
      <input type="hidden" name="present_count" value={presentCount} />

      {/* Section 2 — Demographics (read-only, auto) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Section 2 — Class profile (auto-filled)
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">
          Totals come from active enrolment for the class; present count uses
          saved attendance for the selected date (0 if none recorded).
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-medium uppercase text-slate-500 dark:text-zinc-400">
              Total pupils
            </p>
            {loadingStats && classId ? (
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {demographics.total}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-medium uppercase text-slate-500 dark:text-zinc-400">
              Boys
            </p>
            {loadingStats && classId ? (
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {demographics.boys}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-medium uppercase text-slate-500 dark:text-zinc-400">
              Girls
            </p>
            {loadingStats && classId ? (
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {demographics.girls}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-xs font-medium uppercase text-slate-500 dark:text-zinc-400">
              Present
            </p>
            {loadingStats && classId && lessonDate ? (
              <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {presentCount}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Section 3 — Competences, then required activities & resources (Tanzania format) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Section 3 — Competences, activities &amp; resources
        </h2>
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Main competence
            </span>
            <textarea
              name="main_competence"
              rows={3}
              defaultValue={initialData?.main_competence ?? ""}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Main competence…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Specific competence
            </span>
            <textarea
              name="specific_competence"
              rows={3}
              defaultValue={initialData?.specific_competence ?? ""}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Specific competence…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Main Activity <span className="text-red-600">*</span>
            </span>
            <textarea
              name="main_activities"
              rows={4}
              required
              defaultValue={initialData?.main_activities ?? ""}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Main activity…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Specific Activities <span className="text-red-600">*</span>
            </span>
            <textarea
              name="specific_activities"
              rows={4}
              required
              defaultValue={initialData?.specific_activities ?? ""}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Specific activities…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Teaching and Learning Resources <span className="text-red-600">*</span>
            </span>
            <textarea
              name="teaching_resources"
              rows={3}
              required
              defaultValue={initialData?.teaching_resources ?? ""}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="Teaching and learning resources…"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              References <span className="text-red-600">*</span>
            </span>
            <textarea
              name="references"
              rows={2}
              required
              defaultValue={initialData?.references ?? ""}
              className="rounded-lg border border-gray-200 px-3 py-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="References…"
            />
          </label>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              Section 4 — Teaching and Learning Process
            </h2>
            <TeachingLearningProcessTable
              key={planId ?? "new"}
              initialJson={initialData?.teaching_learning_process}
            />
          </div>
        </div>
      </section>

      {/* Section 4 — Evaluation */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Section 5 — Remarks
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Remarks / evaluation
          </span>
          <textarea
            name="remarks"
            rows={3}
            defaultValue={initialData?.remarks ?? ""}
            className="rounded-lg border border-gray-200 px-3 py-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          label={
            mode === "create" ? "Save lesson plan" : "Update lesson plan"
          }
        />
        <Link
          href="/teacher-dashboard/lesson-plans"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

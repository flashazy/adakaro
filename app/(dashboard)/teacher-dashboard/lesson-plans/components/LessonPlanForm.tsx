"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  DURATION_PRESETS,
  PERIOD_CHECKBOX_RANGE,
  ordinalPeriod,
  parsePeriodsFromDb,
  periodsToStorageString,
} from "@/lib/lesson-plan-period";
import {
  createLessonPlan,
  getAttendancePresentByGender,
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
  period: string | number;
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
  /** Subjects the teacher may teach for each class (from assignments). */
  subjectsByClassId: Record<string, LessonPlanFormSubjectOption[]>;
  mode: "create" | "edit";
  planId?: string;
  initialData?: LessonPlanFormInitialData | null;
}

const DURATION_KINDS = ["40", "60", "80", "120", "custom"] as const;

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
  subjectsByClassId,
  mode,
  planId,
  initialData,
}: LessonPlanFormProps) {
  const [classId, setClassId] = useState(
    initialData?.class_id ?? ""
  );
  const [subjectId, setSubjectId] = useState(
    initialData?.subject_id ?? ""
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
  /** Auto-calculated from `teacher_attendance` (present + late) for class + date. */
  const [presentCount, setPresentCount] = useState(
    initialData?.present_count ?? 0
  );
  const [presentByGender, setPresentByGender] = useState({
    boys: 0,
    girls: 0,
    total: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const [periodSelection, setPeriodSelection] = useState<number[]>(() =>
    parsePeriodsFromDb(initialData?.period)
  );

  const [durationKind, setDurationKind] = useState<
    (typeof DURATION_KINDS)[number]
  >(() => {
    const d = initialData?.duration_minutes ?? 40;
    return DURATION_PRESETS.includes(
      d as (typeof DURATION_PRESETS)[number]
    )
      ? (String(d) as "40" | "60" | "80" | "120")
      : "custom";
  });
  const [customMinutes, setCustomMinutes] = useState(() => {
    const d = initialData?.duration_minutes ?? 40;
    return DURATION_PRESETS.includes(
      d as (typeof DURATION_PRESETS)[number]
    )
      ? ""
      : String(d);
  });

  const effectiveDurationMinutes =
    durationKind === "custom"
      ? Math.min(
          999,
          Math.max(1, parseInt(customMinutes.trim() || "40", 10) || 40)
        )
      : parseInt(durationKind, 10);

  function togglePeriod(p: number) {
    setPeriodSelection((prev) => {
      const next = prev.includes(p)
        ? prev.filter((x) => x !== p)
        : [...prev, p].sort((a, b) => a - b);
      if (next.length === 0) return prev;
      return next;
    });
  }

  const classList = useMemo(() => dedupeClasses(classes), [classes]);

  const subjectOptionsForClass = useMemo(() => {
    if (!classId) return [];
    return subjectsByClassId[classId] ?? [];
  }, [classId, subjectsByClassId]);

  useEffect(() => {
    const list = subjectOptionsForClass;
    if (list.length === 0) {
      setSubjectId("");
      return;
    }
    setSubjectId((prev) =>
      list.some((s) => s.id === prev) ? prev : list[0].id
    );
  }, [classId, subjectOptionsForClass]);

  /** Load pupil counts + present count together when class or date changes. */
  useEffect(() => {
    const run = async () => {
      if (!classId) {
        setDemographics({ total: 0, boys: 0, girls: 0 });
        setPresentCount(0);
        setPresentByGender({ boys: 0, girls: 0, total: 0 });
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
        const p =
          lessonDate.trim() !== ""
            ? await getAttendancePresentByGender(classId, lessonDate)
            : { boys: 0, girls: 0, total: 0 };
        setPresentByGender(p);
        setPresentCount(p.total);
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

      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 xl:grid-cols-[minmax(0,47fr)_minmax(0,53fr)] xl:items-stretch">
      {/* Section 1 — Basic info */}
      <section className="flex h-full min-h-0 flex-col border-b border-slate-200 p-6 dark:border-zinc-700 xl:border-b-0 xl:border-r">
        <h2 className="mb-4 shrink-0 text-lg font-semibold text-slate-900 dark:text-white">
          Section 1 — Basic information
        </h2>
        <div className="flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 dark:border-zinc-700">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                  Date <span className="text-red-600">*</span>
                </th>
                <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                  Class <span className="text-red-600">*</span>
                </th>
                <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                  Subject <span className="text-red-600">*</span>
                </th>
                <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                  Period <span className="text-red-600">*</span>
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                  Time <span className="text-red-600">*</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-r border-slate-200 px-3 py-2 align-top dark:border-zinc-700">
                  <label className="sr-only">Date</label>
                  <input
                    type="date"
                    name="lesson_date"
                    required
                    value={lessonDate}
                    onChange={(e) => setLessonDate(e.target.value)}
                    className="h-10 w-full min-w-[10rem] rounded-lg border border-gray-200 px-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  />
                </td>
                <td className="border-b border-r border-slate-200 px-3 py-2 align-top dark:border-zinc-700">
                  <label className="sr-only">Class</label>
                  <select
                    name="class_id"
                    required
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="h-10 w-full min-w-[8rem] rounded-lg border border-gray-200 px-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="">Select class</option>
                    {classList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-r border-slate-200 px-3 py-2 align-top dark:border-zinc-700">
                  <label className="sr-only">Subject</label>
                  <select
                    name="subject_id"
                    required
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    disabled={!classId || subjectOptionsForClass.length === 0}
                    className="h-10 w-full min-w-[8rem] rounded-lg border border-gray-200 px-2 text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="">
                      {!classId
                        ? "Select a class first…"
                        : subjectOptionsForClass.length === 0
                          ? "No subjects for this class in your assignments"
                          : "Select subject"}
                    </option>
                    {subjectOptionsForClass.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-r border-slate-200 px-3 py-2 align-top dark:border-zinc-700">
                  <label className="sr-only">Period</label>
                  <input
                    type="hidden"
                    name="period"
                    value={periodsToStorageString(periodSelection)}
                    readOnly
                  />
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {PERIOD_CHECKBOX_RANGE.slice(0, 5).map((p) => (
                        <label
                          key={p}
                          className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-900 dark:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={periodSelection.includes(p)}
                            onChange={() => togglePeriod(p)}
                            className="rounded border-gray-300"
                          />
                          <span>{ordinalPeriod(p)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {PERIOD_CHECKBOX_RANGE.slice(5, 10).map((p) => (
                        <label
                          key={p}
                          className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-900 dark:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={periodSelection.includes(p)}
                            onChange={() => togglePeriod(p)}
                            className="rounded border-gray-300"
                          />
                          <span>{ordinalPeriod(p)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-zinc-700">
                  <label className="sr-only">Time (minutes)</label>
                  <input
                    type="hidden"
                    name="duration_minutes"
                    value={effectiveDurationMinutes}
                    readOnly
                  />
                  <select
                    value={durationKind}
                    onChange={(e) => {
                      const v = e.target.value as (typeof DURATION_KINDS)[number];
                      if (v === "custom" && !customMinutes.trim()) {
                        setCustomMinutes(
                          durationKind !== "custom" ? durationKind : "40"
                        );
                      }
                      setDurationKind(v);
                    }}
                    className="h-10 w-full min-w-[7rem] rounded-lg border border-gray-200 px-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="40">40 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="80">80 minutes</option>
                    <option value="120">120 minutes</option>
                    <option value="custom">Custom</option>
                  </select>
                  {durationKind === "custom" && (
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      className="mt-2 h-10 w-full min-w-[7rem] rounded-lg border border-gray-200 px-2 text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                      placeholder="Minutes"
                      aria-label="Custom duration in minutes"
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            className="grid min-h-0 flex-1 grid-cols-5"
            aria-hidden
          >
            <div className="border-r border-slate-200 dark:border-zinc-700" />
            <div className="border-r border-slate-200 dark:border-zinc-700" />
            <div className="border-r border-slate-200 dark:border-zinc-700" />
            <div className="border-r border-slate-200 dark:border-zinc-700" />
            <div />
          </div>
        </div>
      </section>

      {/* Section 2 — Demographics (read-only, auto) */}
      <section className="flex h-full min-h-0 flex-col p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Section 2 — Class profile (auto-filled)
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">
          Registered counts come from active enrolment for the class. Present
          counts students marked present or late in saved attendance for the
          selected date (0 if none recorded), split by gender where known.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                <th
                  colSpan={6}
                  className="px-4 py-2 text-center font-semibold text-slate-900 dark:text-white"
                >
                  Number of Pupils
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                <th
                  colSpan={3}
                  className="px-4 py-2 text-center font-semibold text-slate-900 dark:text-white"
                >
                  Registered
                </th>
                <th
                  colSpan={3}
                  className="px-4 py-2 text-center font-semibold text-slate-900 dark:text-white"
                >
                  Present
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                <th className="px-2 py-2 text-center font-semibold text-slate-900 dark:text-white">
                  Girls
                </th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900 dark:text-white">
                  Boys
                </th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900 dark:text-white">
                  Total
                </th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900 dark:text-white">
                  Girls
                </th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900 dark:text-white">
                  Boys
                </th>
                <th className="px-2 py-2 text-center font-semibold text-slate-900 dark:text-white">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-2 text-center tabular-nums text-slate-900 dark:text-white">
                  {loadingStats && classId ? (
                    <span className="inline-block h-5 w-8 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
                  ) : (
                    demographics.girls
                  )}
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-slate-900 dark:text-white">
                  {loadingStats && classId ? (
                    <span className="inline-block h-5 w-8 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
                  ) : (
                    demographics.boys
                  )}
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-slate-900 dark:text-white">
                  {loadingStats && classId ? (
                    <span className="inline-block h-5 w-8 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
                  ) : (
                    demographics.total
                  )}
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                  {loadingStats && classId && lessonDate ? (
                    <span className="inline-block h-5 w-8 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
                  ) : (
                    presentByGender.girls
                  )}
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                  {loadingStats && classId && lessonDate ? (
                    <span className="inline-block h-5 w-8 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
                  ) : (
                    presentByGender.boys
                  )}
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                  {loadingStats && classId && lessonDate ? (
                    <span className="inline-block h-5 w-8 animate-pulse rounded bg-slate-200 dark:bg-zinc-600" />
                  ) : (
                    presentByGender.total
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      </div>

      {/* Hidden fields: synced with auto-calculated values on submit */}
      <input type="hidden" name="total_boys" value={demographics.boys} />
      <input type="hidden" name="total_girls" value={demographics.girls} />
      <input type="hidden" name="total_pupils" value={demographics.total} />
      <input type="hidden" name="present_count" value={presentCount} />

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

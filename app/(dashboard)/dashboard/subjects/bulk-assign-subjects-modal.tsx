"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  bulkAssignSubjectsAction,
  fetchStudentsForBulkSubjectAssign,
  type BulkStudentOption,
  type SubjectRow,
  type SubjectActionState,
} from "./actions";
import { sortClassRowsByHierarchy } from "@/lib/class-options";
import { getCurrentAcademicYearAndTerm } from "@/lib/student-subject-enrollment";

type ClassOption = {
  id: string;
  name: string;
  parent_class_id: string | null;
};

interface BulkAssignSubjectsModalProps {
  open: boolean;
  onClose: () => void;
  classOptions: ClassOption[];
  subjects: SubjectRow[];
  /** Called after successful assign + server revalidation from parent router.refresh(). */
  onSuccess: () => void;
}

function flashMessage(state: SubjectActionState | null) {
  if (!state) return null;
  if (state.ok && state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }
  if (!state.ok) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
        {state.error}
      </p>
    );
  }
  return null;
}

function StudentMultiPicker({
  students,
  selectedIds,
  onSelectedIdsChange,
}: {
  students: BulkStudentOption[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...students].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
    );
    if (!q) return sorted;
    return sorted.filter((s) => {
      if (selectedSet.has(s.id)) return true;
      const hay = `${s.full_name} ${s.class_name}`.toLowerCase();
      return hay.includes(q);
    });
  }, [students, query, selectedSet]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students…"
          autoComplete="off"
          aria-label="Search students"
          aria-controls={listboxId}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-school-primary/20 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-school-primary dark:focus:ring-school-primary/20"
        />
      </div>
      <div
        id={listboxId}
        role="group"
        aria-label="Students"
        className="max-h-[14rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-sm dark:border-zinc-600 dark:bg-zinc-900"
      >
        {students.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-zinc-400">
            No active students in the selected classes.
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-zinc-400">
            No matching students.
          </p>
        ) : (
          filtered.map((s) => {
            const checked = selectedSet.has(s.id);
            return (
              <label
                key={s.id}
                className={`flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "bg-[rgb(var(--school-primary-rgb)/0.10)]/80 dark:bg-[rgb(var(--school-primary-rgb)/0.12)]"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-school-primary"
                />
                <span className={checked ? "font-medium text-school-primary dark:text-school-primary" : "text-slate-800 dark:text-zinc-100"}>
                  {s.full_name}{" "}
                  <span className="font-normal text-slate-500 dark:text-zinc-400">
                    ({s.class_name})
                  </span>
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function BulkAssignSubjectsModal({
  open,
  onClose,
  classOptions,
  subjects,
  onSuccess,
}: BulkAssignSubjectsModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [assignEntireClasses, setAssignEntireClasses] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentOptions, setStudentOptions] = useState<BulkStudentOption[]>([]);
  const [submitState, setSubmitState] = useState<SubjectActionState | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [loadStudentsPending, setLoadStudentsPending] = useState(false);
  const loadGeneration = useRef(0);

  const sortedClasses = useMemo(
    () => sortClassRowsByHierarchy([...classOptions]),
    [classOptions]
  );
  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects]
  );

  const { academicYear, term } = useMemo(
    () => getCurrentAcademicYearAndTerm(),
    []
  );

  const studentIdSet = useMemo(
    () => new Set(studentOptions.map((s) => s.id)),
    [studentOptions]
  );
  const resolvedStudentIds = useMemo(
    () => selectedStudentIds.filter((id) => studentIdSet.has(id)),
    [selectedStudentIds, studentIdSet]
  );

  async function loadStudentsForPicker(
    classIdsSnap: string[],
    afterLoad?: () => void
  ) {
    const gen = ++loadGeneration.current;
    setLoadStudentsPending(true);
    try {
      const rows = await fetchStudentsForBulkSubjectAssign(classIdsSnap);
      if (gen !== loadGeneration.current) return;
      setStudentOptions(rows);
      setSelectedStudentIds([]);
      afterLoad?.();
    } finally {
      if (gen === loadGeneration.current) setLoadStudentsPending(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const allClassSelected =
    sortedClasses.length > 0 &&
    sortedClasses.every((c) => selectedClassIds.includes(c.id));
  const allSubjectSelected =
    sortedSubjects.length > 0 &&
    sortedSubjects.every((s) => selectedSubjectIds.includes(s.id));

  function toggleClass(id: string) {
    setSelectedStudentIds([]);
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function canGoNext(): boolean {
    if (step === 1) return selectedClassIds.length > 0;
    if (step === 2) return selectedSubjectIds.length > 0;
    if (step === 3) {
      if (assignEntireClasses) return true;
      return resolvedStudentIds.length > 0;
    }
    return true;
  }

  function nextStep() {
    setSubmitState(null);
    if (!(step < 4 && canGoNext())) return;
    if (step === 2) {
      if (!assignEntireClasses && selectedClassIds.length > 0) {
        void loadStudentsForPicker(selectedClassIds, () => setStep(3));
        return;
      }
      setStep(3);
      return;
    }
    setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  }

  function prevStep() {
    setSubmitState(null);
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  }

  function submit() {
    setSubmitState(null);
    startTransition(() => {
      bulkAssignSubjectsAction({
        classIds: selectedClassIds,
        subjectIds: selectedSubjectIds,
        assignAllStudentsInSelectedClasses: assignEntireClasses,
        studentIds: assignEntireClasses ? [] : resolvedStudentIds,
      }).then((res) => {
        setSubmitState(res);
        if (res.ok) {
          if (res.enrollmentSummary) {
            const { created, skipped } = res.enrollmentSummary;
            toast.success(
              `${created} new assignment${created === 1 ? "" : "s"} created. ${skipped} skipped (already existed).`,
              { duration: 5000 }
            );
          }
          onSuccess();
          onClose();
        }
      });
    });
  }

  const stepTitles = ["Classes", "Subjects", "Who", "Assign"];

  const summarySubjects = sortedSubjects.filter((s) =>
    selectedSubjectIds.includes(s.id)
  );
  const summaryClasses = sortedClasses.filter((c) =>
    selectedClassIds.includes(c.id)
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-assign-subjects-title"
      onClick={(e) => {
        if (!isPending && !loadStudentsPending && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="animate-subject-modal-in flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-100 p-6 pb-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                id="bulk-assign-subjects-title"
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                Bulk assign subjects
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Offer subjects on classes and enrol students for {term}{" "}
                {academicYear}.
              </p>
            </div>
            <button
              type="button"
              disabled={isPending || loadStudentsPending}
              onClick={() => !isPending && !loadStudentsPending && onClose()}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.4)] disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <nav
            aria-label="Progress"
            className="mt-5 flex gap-2"
          >
            {([1, 2, 3, 4] as const).map((s) => {
              const active = step === s;
              const complete = step > s;
              return (
                <div key={s} className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        active
                          ? "bg-school-primary text-white"
                          : complete
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {complete ? "✓" : s}
                    </span>
                    <span
                      className={`hidden text-xs font-medium sm:inline ${
                        active
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-500 dark:text-zinc-500"
                      }`}
                    >
                      {stepTitles[s - 1]}
                    </span>
                  </div>
                  <div
                    className={`h-1 rounded-full ${
                      complete || active
                        ? "bg-school-primary/40"
                        : "bg-slate-100 dark:bg-zinc-800"
                    }`}
                  />
                </div>
              );
            })}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  Select classes
                </p>
                {sortedClasses.length > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-school-primary hover:opacity-90">
                    <input
                      type="checkbox"
                      checked={allClassSelected}
                      onChange={() => {
                        const nextIds = allClassSelected
                          ? []
                          : sortedClasses.map((c) => c.id);
                        setSelectedStudentIds([]);
                        setSelectedClassIds(nextIds);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900"
                    />
                    Select all
                  </label>
                ) : null}
              </div>
              {sortedClasses.length === 0 ? (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                  No classes configured. Add classes first.
                </p>
              ) : (
                <ul
                  className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-zinc-800 dark:border-zinc-700"
                  role="group"
                >
                  {sortedClasses.map((c) => (
                    <li key={c.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800/80 ${
                          c.parent_class_id ? "pl-10" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(c.id)}
                          onChange={() => toggleClass(c.id)}
                          className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900"
                        />
                        <span className="text-slate-800 dark:text-zinc-100">
                          {c.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                  Select subjects
                </p>
                {sortedSubjects.length > 0 ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-school-primary hover:opacity-90">
                    <input
                      type="checkbox"
                      checked={allSubjectSelected}
                      onChange={() => {
                        const nextIds = allSubjectSelected
                          ? []
                          : sortedSubjects.map((s) => s.id);
                        setSelectedSubjectIds(nextIds);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900"
                    />
                    Select all
                  </label>
                ) : null}
              </div>
              {sortedSubjects.length === 0 ? (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                  No subjects yet. Create subjects on this page first.
                </p>
              ) : (
                <ul
                  className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-zinc-800 dark:border-zinc-700"
                  role="group"
                >
                  {sortedSubjects.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800/80">
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.includes(s.id)}
                          onChange={() => toggleSubject(s.id)}
                          className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900"
                        />
                        <span className="text-slate-800 dark:text-zinc-100">
                          {s.name}
                          {s.code ? (
                            <span className="ml-2 text-xs text-slate-500 dark:text-zinc-500">
                              ({s.code})
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <fieldset className="space-y-4 border-0 p-0">
              <legend className="sr-only">Assignment scope</legend>
              <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                Who should receive these enrolments?
              </p>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  checked={assignEntireClasses}
                  onChange={() => {
                    setAssignEntireClasses(true);
                    setSelectedStudentIds([]);
                  }}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900"
                />
                <span className="text-sm text-slate-700 dark:text-zinc-300">
                  Assign to entire class (all active students in each selected
                  class)
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  checked={!assignEntireClasses}
                  onChange={() => {
                    setAssignEntireClasses(false);
                    if (selectedClassIds.length > 0) {
                      void loadStudentsForPicker(selectedClassIds);
                    }
                  }}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-900"
                />
                <span className="text-sm text-slate-700 dark:text-zinc-300">
                  Assign to specific students in the selected classes
                </span>
              </label>
              {!assignEntireClasses ? (
                <div className="ml-0 sm:ml-6">
                  {loadStudentsPending ? (
                    <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading students…
                    </p>
                  ) : (
                    <StudentMultiPicker
                      students={studentOptions}
                      selectedIds={selectedStudentIds}
                      onSelectedIdsChange={setSelectedStudentIds}
                    />
                  )}
                </div>
              ) : null}
            </fieldset>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                Review and assign
              </p>
              {flashMessage(submitState)}
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400">Classes</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-zinc-100">
                    {summaryClasses.map((c) => c.name).join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400">Subjects</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-zinc-100">
                    {summarySubjects.map((s) => s.name).join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400">Scope</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-zinc-100">
                    {assignEntireClasses
                      ? "All active students in the selected classes"
                      : `${resolvedStudentIds.length} selected student${resolvedStudentIds.length === 1 ? "" : "s"}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-zinc-400">Period</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-zinc-100">
                    {term} {academicYear}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            disabled={isPending || loadStudentsPending || step === 1}
            onClick={prevStep}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                disabled={!canGoNext() || loadStudentsPending}
                onClick={nextStep}
                className="inline-flex items-center gap-1 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={submit}
                className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Assigning…
                  </>
                ) : (
                  "Assign subjects"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

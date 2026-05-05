"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import {
  SUBJECT_ENROLLMENT_TERMS,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";
import { formatNativeSelectClassOptionLabel } from "@/lib/class-options";
import {
  blockInvalidKeyDownAdmission,
  blockInvalidKeyDownLettersName,
  blockInvalidKeyDownPhone,
} from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { ClassOption, StudentData } from "@/app/(dashboard)/dashboard/students/student-row";

export interface SubjectEnrollmentEditProps {
  academicYear: number;
  term: SubjectEnrollmentTerm;
  classSubjects: { id: string; name: string }[];
  selectedIds: string[];
  loading: boolean;
  onYearChange: (year: number) => void;
  onTermChange: (term: SubjectEnrollmentTerm) => void;
  onToggleSubject: (subjectId: string, checked: boolean) => void;
  onToggleAllSubjects: (checked: boolean) => void;
}

type InlineFieldErrors = Partial<
  Record<
    "full_name" | "admission_number" | "parent_name" | "parent_phone",
    string
  >
>;

/** Normalized flat snapshot of editable fields for dirty checks. */
type EditFieldSnapshot = Record<string, string>;

const EDIT_COMPARE_KEYS = [
  "full_name",
  "admission_number",
  "class_id",
  "gender",
  "enrollment_date",
  "parent_name",
  "parent_email",
  "parent_phone",
  "date_of_birth",
  "allergies",
  "disability",
  "insurance_provider",
  "insurance_policy",
] as const;

function normStr(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function snapFromStudent(student: StudentData): EditFieldSnapshot {
  const e = student.enrollment_date ?? "";
  const dob = student.date_of_birth ?? "";
  return {
    full_name: normStr(student.full_name),
    admission_number: normStr(student.admission_number),
    class_id: normStr(student.class_id),
    gender: normStr(student.gender),
    enrollment_date: e.length >= 10 ? e.slice(0, 10) : normStr(e),
    parent_name: normStr(student.parent_name),
    parent_email: normStr(student.parent_email),
    parent_phone: normStr(student.parent_phone),
    date_of_birth: dob.length >= 10 ? dob.slice(0, 10) : normStr(dob),
    allergies: normStr(student.allergies),
    disability: normStr(student.disability),
    insurance_provider: normStr(student.insurance_provider),
    insurance_policy: normStr(student.insurance_policy),
  };
}

function snapFromEditValues(
  student: StudentData,
  editValues: Partial<StudentData>
): EditFieldSnapshot {
  const ef = editValues.enrollment_date ?? student.enrollment_date ?? "";
  const dob = editValues.date_of_birth ?? student.date_of_birth ?? "";
  return {
    full_name: normStr(editValues.full_name ?? student.full_name),
    admission_number: normStr(
      editValues.admission_number ?? student.admission_number
    ),
    class_id: normStr(editValues.class_id ?? student.class_id),
    gender: normStr(editValues.gender ?? student.gender),
    enrollment_date: ef.length >= 10 ? ef.slice(0, 10) : normStr(ef),
    parent_name: normStr(editValues.parent_name ?? student.parent_name),
    parent_email: normStr(editValues.parent_email ?? student.parent_email),
    parent_phone: normStr(editValues.parent_phone ?? student.parent_phone),
    date_of_birth: dob.length >= 10 ? dob.slice(0, 10) : normStr(dob),
    allergies: normStr(editValues.allergies ?? student.allergies),
    disability: normStr(editValues.disability ?? student.disability),
    insurance_provider: normStr(
      editValues.insurance_provider ?? student.insurance_provider
    ),
    insurance_policy: normStr(
      editValues.insurance_policy ?? student.insurance_policy
    ),
  };
}

function editFieldsDirty(
  baseline: EditFieldSnapshot | null,
  current: EditFieldSnapshot
): boolean {
  if (!baseline) return false;
  for (const k of EDIT_COMPARE_KEYS) {
    if (baseline[k] !== current[k]) return true;
  }
  return false;
}

function sortedIds(ids: readonly string[]): string[] {
  return [...ids].sort();
}

interface SubjectBaseline {
  ids: string[];
  year: number;
  term: SubjectEnrollmentTerm;
}

const labelClass =
  "mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300";
const hintClass = "text-xs text-slate-500 dark:text-zinc-400";
const inputClass =
  "w-full min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-school-primary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.4)] dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-zinc-500";
const dateInputClass = `${inputClass} [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60`;
const textareaClass = `${inputClass} min-h-[4.5rem] resize-y`;
const flexLabel = "text-sm font-medium text-slate-700 dark:text-zinc-300";
const sectionCard =
  "space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";
const sectionTitle = "text-sm font-semibold text-slate-900 dark:text-white";
const sectionDesc = "text-xs text-slate-500 dark:text-zinc-400";
const gridForm = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3";
const btnCancel =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:px-5";
const btnPrimary =
  "rounded-lg bg-school-primary px-6 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white";

function SubjectBlock({
  studentId,
  se,
}: {
  studentId: string;
  se: SubjectEnrollmentEditProps;
}) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected =
    se.classSubjects.length > 0 &&
    se.selectedIds.length === se.classSubjects.length;
  const someSelected = se.selectedIds.length > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <section className={sectionCard} aria-labelledby={`dr-subj-${studentId}`}>
      <div className="space-y-1">
        <h3 id={`dr-subj-${studentId}`} className={sectionTitle}>
          Subjects this student will study
        </h3>
        <p className={sectionDesc}>
          Only subjects linked to the selected class appear here.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className={`flex flex-col gap-1 ${flexLabel}`}>
          Academic year
          <input
            type="number"
            min={2000}
            max={2100}
            value={se.academicYear}
            onChange={(e) => {
              const y = Number(e.target.value);
              if (Number.isInteger(y) && y >= 2000 && y <= 2100) {
                se.onYearChange(y);
              }
            }}
            className={`${inputClass} w-28`}
          />
        </label>
        <label className={`flex flex-col gap-1 ${flexLabel}`}>
          Term
          <select
            value={se.term}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "Term 1" || v === "Term 2") {
                se.onTermChange(v);
              }
            }}
            className={`${inputClass} min-w-[9rem]`}
          >
            {SUBJECT_ENROLLMENT_TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      {se.loading ? (
        <p className={hintClass}>Loading subjects…</p>
      ) : se.classSubjects.length === 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300/90">
          No subjects linked to this class yet. Configure subjects under Manage
          Subjects first.
        </p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
          <label
            htmlFor={`dr-subj-all-${studentId}`}
            className="flex flex-wrap items-center gap-2 border-b border-slate-200/90 pb-3 dark:border-zinc-600"
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              id={`dr-subj-all-${studentId}`}
              checked={allSelected}
              onChange={(e) => se.onToggleAllSubjects(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.35)] dark:border-zinc-600"
            />
            <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              Select all subjects
            </span>
            <span className="ml-auto text-xs tabular-nums text-slate-500 dark:text-zinc-400">
              {se.selectedIds.length} of {se.classSubjects.length} selected
            </span>
          </label>
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
            {se.classSubjects.map((sub) => (
              <li key={sub.id}>
                <label
                  htmlFor={`dr-subj-${studentId}-${sub.id}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-zinc-700/60"
                >
                  <input
                    type="checkbox"
                    id={`dr-subj-${studentId}-${sub.id}`}
                    checked={se.selectedIds.includes(sub.id)}
                    onChange={(e) =>
                      se.onToggleSubject(sub.id, e.target.checked)
                    }
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-school-primary focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.35)] dark:border-zinc-600"
                  />
                  <span className="text-sm text-slate-800 dark:text-zinc-200">
                    {sub.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function HealthBlock({
  student,
  editValues,
  onChange,
}: {
  student: StudentData;
  editValues: Partial<StudentData>;
  onChange: (field: string, value: string) => void;
}) {
  const dobSource =
    editValues.date_of_birth ?? student.date_of_birth ?? "";
  const dobValue =
    dobSource.length >= 10 ? dobSource.slice(0, 10) : dobSource;

  return (
    <section
      className={`${sectionCard} bg-slate-50/60 dark:bg-zinc-800/35`}
      aria-labelledby={`dr-health-${student.id}`}
    >
      <div className="space-y-1">
        <h3 id={`dr-health-${student.id}`} className={sectionTitle}>
          Health and date of birth
        </h3>
        <p className={sectionDesc}>
          Update health details connected to this student.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex flex-col">
          <label htmlFor={`dr-dob-${student.id}`} className={labelClass}>
            Date of birth
          </label>
          <input
            id={`dr-dob-${student.id}`}
            type="date"
            value={dobValue}
            onChange={(e) => onChange("date_of_birth", e.target.value)}
            className={dateInputClass}
          />
          <p className={`${hintClass} mt-1`}>
            Required for student records.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor={`dr-al-${student.id}`} className={labelClass}>
              Allergies
            </label>
            <textarea
              id={`dr-al-${student.id}`}
              value={editValues.allergies ?? student.allergies ?? ""}
              onChange={(e) => onChange("allergies", e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="e.g., Peanuts, pollen, penicillin"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor={`dr-dis-${student.id}`} className={labelClass}>
              Disability
            </label>
            <textarea
              id={`dr-dis-${student.id}`}
              value={editValues.disability ?? student.disability ?? ""}
              onChange={(e) => onChange("disability", e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="e.g., Uses wheelchair, dyslexia"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor={`dr-inp-${student.id}`} className={labelClass}>
              Health insurance provider
            </label>
            <input
              id={`dr-inp-${student.id}`}
              type="text"
              value={
                editValues.insurance_provider ??
                student.insurance_provider ??
                ""
              }
              onChange={(e) =>
                onChange("insurance_provider", e.target.value)
              }
              className={inputClass}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor={`dr-inn-${student.id}`} className={labelClass}>
              Insurance policy number
            </label>
            <input
              id={`dr-inn-${student.id}`}
              type="text"
              value={
                editValues.insurance_policy ?? student.insurance_policy ?? ""
              }
              onChange={(e) =>
                onChange("insurance_policy", e.target.value)
              }
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PendingSyncBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      title="Saved offline – will sync when online"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Pending sync
    </span>
  );
}

export interface EditStudentDrawerProps {
  isOpen: boolean;
  student: StudentData | null;
  classes: ClassOption[];
  editValues: Partial<StudentData>;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onChange: (field: string, value: string) => void;
  inlineFieldErrors?: InlineFieldErrors;
  subjectEnrollment?: SubjectEnrollmentEditProps;
  isSaving?: boolean;
  pendingSync?: boolean;
  saveError?: string | null;
}

export function EditStudentDrawer({
  isOpen,
  student,
  classes,
  editValues,
  onClose,
  onSave,
  onChange,
  inlineFieldErrors = {},
  subjectEnrollment,
  isSaving = false,
  pendingSync = false,
  saveError,
}: EditStudentDrawerProps) {
  const [entered, setEntered] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [editBaseline, setEditBaseline] = useState<EditFieldSnapshot | null>(
    null
  );
  const [subjectBaseline, setSubjectBaseline] = useState<SubjectBaseline | null>(
    null
  );
  const pendingSubjectBaselineRef = useRef(false);
  const baselineStudentIdRef = useRef<string | null>(null);
  const subjectEnrollmentRef = useRef(subjectEnrollment);
  subjectEnrollmentRef.current = subjectEnrollment;

  useLayoutEffect(() => {
    if (!isOpen || !student) {
      setEditBaseline(null);
      setSubjectBaseline(null);
      pendingSubjectBaselineRef.current = false;
      baselineStudentIdRef.current = null;
      setDiscardConfirmOpen(false);
      return;
    }
    if (baselineStudentIdRef.current !== student.id) {
      baselineStudentIdRef.current = student.id;
      setEditBaseline(snapFromStudent(student));
      setSubjectBaseline(null);
      pendingSubjectBaselineRef.current =
        subjectEnrollmentRef.current != null;
    }
  }, [isOpen, student]);

  useEffect(() => {
    if (!isOpen || !student) return;
    const se = subjectEnrollment;
    if (se == null) {
      pendingSubjectBaselineRef.current = false;
      return;
    }
    if (se.loading) {
      pendingSubjectBaselineRef.current = true;
      return;
    }
    if (pendingSubjectBaselineRef.current) {
      setSubjectBaseline({
        ids: sortedIds(se.selectedIds),
        year: se.academicYear,
        term: se.term,
      });
      pendingSubjectBaselineRef.current = false;
    }
  }, [
    isOpen,
    student?.id,
    subjectEnrollment?.loading,
    subjectEnrollment?.selectedIds,
    subjectEnrollment?.academicYear,
    subjectEnrollment?.term,
    subjectEnrollment,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!student || !editBaseline) return false;
    const curEdit = snapFromEditValues(student, editValues);
    if (editFieldsDirty(editBaseline, curEdit)) return true;
    if (!subjectEnrollment) return false;
    if (subjectEnrollment.loading || subjectBaseline === null) return false;
    const curIds = sortedIds(subjectEnrollment.selectedIds);
    if (curIds.length !== subjectBaseline.ids.length) return true;
    for (let i = 0; i < curIds.length; i++) {
      if (curIds[i] !== subjectBaseline.ids[i]) return true;
    }
    return (
      subjectEnrollment.academicYear !== subjectBaseline.year ||
      subjectEnrollment.term !== subjectBaseline.term
    );
  }, [
    student,
    editBaseline,
    editValues,
    subjectEnrollment,
    subjectBaseline,
  ]);

  const keepEditing = useCallback(() => {
    setDiscardConfirmOpen(false);
  }, []);

  const tryClose = useCallback(() => {
    if (isSaving) return;
    if (!hasUnsavedChanges) {
      setDiscardConfirmOpen(false);
      onClose();
      return;
    }
    setDiscardConfirmOpen(true);
  }, [hasUnsavedChanges, isSaving, onClose]);

  const confirmDiscard = useCallback(() => {
    setDiscardConfirmOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !student) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen, student]);

  useEffect(() => {
    if (!isOpen || !student) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, student]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (discardConfirmOpen) {
        keepEditing();
        return;
      }
      tryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, discardConfirmOpen, tryClose, keepEditing]);

  if (!isOpen || !student) return null;

  const subtitleName =
    (editValues.full_name ?? student.full_name).trim() || "Student";
  const subtitleAdm =
    (editValues.admission_number ?? student.admission_number ?? "").trim() ||
    "—";

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close edit panel"
        className={cn(
          "pointer-events-auto absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ease-out",
          entered ? "opacity-100" : "opacity-0"
        )}
        onClick={() => tryClose()}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-drawer-title"
        className={cn(
          "pointer-events-auto absolute right-0 top-0 flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-900",
          "md:w-[600px] lg:w-[720px]",
          entered ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2
                id="edit-student-drawer-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Edit student
              </h2>
              {pendingSync ? <PendingSyncBadge /> : null}
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              <span className="font-medium text-slate-800 dark:text-zinc-200">
                {subtitleName}
              </span>
              <span
                aria-hidden
                className="mx-1.5 text-slate-300 dark:text-zinc-600"
              >
                ·
              </span>
              <span className="font-mono text-slate-600 dark:text-zinc-400">
                ADM {subtitleAdm}
              </span>
            </p>
            {hasUnsavedChanges && !isSaving ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-1 flex items-center gap-2 opacity-100 transition-opacity duration-200 motion-reduce:transition-none"
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
                  Unsaved changes
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => tryClose()}
            disabled={isSaving}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5 [-webkit-overflow-scrolling:touch]">
            <div className="space-y-6">
              {saveError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {saveError}
                </p>
              ) : null}

              <section
                className={sectionCard}
                aria-labelledby={`dr-info-${student.id}`}
              >
                <div className="space-y-1">
                  <h3 id={`dr-info-${student.id}`} className={sectionTitle}>
                    Student information
                  </h3>
                  <p className={sectionDesc}>
                    Basic student details required for enrollment
                  </p>
                </div>
                <div className={gridForm}>
                  <div className="flex flex-col">
                    <label htmlFor={`dr-fn-${student.id}`} className={labelClass}>
                      Full name
                    </label>
                    <input
                      id={`dr-fn-${student.id}`}
                      type="text"
                      value={editValues.full_name ?? ""}
                      onChange={(e) => onChange("full_name", e.target.value)}
                      onKeyDown={blockInvalidKeyDownLettersName}
                      className={inputClass}
                    />
                    {inlineFieldErrors.full_name ? (
                      <p className="mt-0.5 text-xs text-red-500" role="alert">
                        {inlineFieldErrors.full_name}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor={`dr-adm-${student.id}`} className={labelClass}>
                      Admission number
                    </label>
                    <input
                      id={`dr-adm-${student.id}`}
                      type="text"
                      value={editValues.admission_number ?? ""}
                      onChange={(e) =>
                        onChange("admission_number", e.target.value)
                      }
                      onKeyDown={blockInvalidKeyDownAdmission}
                      className={inputClass}
                    />
                    {inlineFieldErrors.admission_number ? (
                      <p className="mt-0.5 text-xs text-red-500" role="alert">
                        {inlineFieldErrors.admission_number}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col">
                    <label
                      htmlFor={`dr-class-${student.id}`}
                      className={labelClass}
                    >
                      Class
                    </label>
                    <select
                      id={`dr-class-${student.id}`}
                      value={editValues.class_id ?? student.class_id}
                      onChange={(e) => onChange("class_id", e.target.value)}
                      className={inputClass}
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatNativeSelectClassOptionLabel(
                            c.name,
                            c.parent_class_id
                          )}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor={`dr-g-${student.id}`} className={labelClass}>
                      Gender
                    </label>
                    <select
                      id={`dr-g-${student.id}`}
                      value={editValues.gender ?? ""}
                      onChange={(e) => onChange("gender", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">—</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="flex flex-col md:col-span-2 lg:col-span-1">
                    <label htmlFor={`dr-en-${student.id}`} className={labelClass}>
                      Enrollment date
                    </label>
                    <input
                      id={`dr-en-${student.id}`}
                      type="date"
                      value={
                        editValues.enrollment_date ?? student.enrollment_date
                      }
                      onChange={(e) =>
                        onChange("enrollment_date", e.target.value)
                      }
                      className={dateInputClass}
                    />
                    <p className={`${hintClass} mt-1`}>
                      Adjust if the enrolment date was recorded incorrectly.
                    </p>
                  </div>
                </div>
              </section>

              <section
                className={sectionCard}
                aria-labelledby={`dr-par-${student.id}`}
              >
                <div className="space-y-1">
                  <h3 id={`dr-par-${student.id}`} className={sectionTitle}>
                    Parent contact
                  </h3>
                  <p className={sectionDesc}>
                    Guardian details shown on communications
                  </p>
                </div>
                <div className={gridForm}>
                  <div className="flex flex-col">
                    <label htmlFor={`dr-pn-${student.id}`} className={labelClass}>
                      Parent name
                    </label>
                    <input
                      id={`dr-pn-${student.id}`}
                      type="text"
                      value={editValues.parent_name ?? ""}
                      onChange={(e) => onChange("parent_name", e.target.value)}
                      onKeyDown={blockInvalidKeyDownLettersName}
                      className={inputClass}
                      placeholder="Parent name"
                    />
                    {inlineFieldErrors.parent_name ? (
                      <p className="mt-0.5 text-xs text-red-500" role="alert">
                        {inlineFieldErrors.parent_name}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor={`dr-pe-${student.id}`} className={labelClass}>
                      Parent email
                    </label>
                    <input
                      id={`dr-pe-${student.id}`}
                      type="email"
                      value={editValues.parent_email ?? ""}
                      onChange={(e) => onChange("parent_email", e.target.value)}
                      className={inputClass}
                      placeholder="Email"
                    />
                  </div>
                  <div className="flex flex-col md:col-span-2 lg:col-span-3">
                    <label htmlFor={`dr-pp-${student.id}`} className={labelClass}>
                      Parent phone
                    </label>
                    <input
                      id={`dr-pp-${student.id}`}
                      type="tel"
                      value={editValues.parent_phone ?? ""}
                      onChange={(e) => onChange("parent_phone", e.target.value)}
                      onKeyDown={blockInvalidKeyDownPhone}
                      className={inputClass}
                      placeholder="Phone"
                    />
                    {inlineFieldErrors.parent_phone ? (
                      <p className="mt-0.5 text-xs text-red-500" role="alert">
                        {inlineFieldErrors.parent_phone}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              {subjectEnrollment ? (
                <SubjectBlock studentId={student.id} se={subjectEnrollment} />
              ) : null}

              <HealthBlock
                student={student}
                editValues={editValues}
                onChange={onChange}
              />
            </div>
          </div>

          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white/90 px-6 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/85 dark:border-zinc-800 dark:bg-zinc-900/90 dark:supports-[backdrop-filter]:bg-zinc-900/85">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Review changes before saving.
              </p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => tryClose()}
                  disabled={isSaving}
                  className={`${btnCancel} w-full sm:w-auto`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={isSaving}
                  className={`${btnPrimary} w-full sm:w-auto`}
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </footer>
        </div>
      </aside>

      {discardConfirmOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[110] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={keepEditing}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-edit-title"
            aria-describedby="discard-edit-desc"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="discard-edit-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Discard changes?
            </h3>
            <p
              id="discard-edit-desc"
              className="mt-2 text-sm text-slate-500 dark:text-zinc-400"
            >
              You have unsaved edits. If you leave now, your changes will be
              lost.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={keepEditing}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:min-w-[7.5rem]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-500 sm:min-w-[7.5rem]"
              >
                Discard changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

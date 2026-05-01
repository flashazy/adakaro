"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { Pencil, Trash2, UserCircle } from "lucide-react";
import { deleteStudent } from "./actions";
import { enqueueOrRun } from "@/lib/offline/enqueue-or-run";
import { formatEnrollmentDateDisplay } from "@/lib/enrollment-date";
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

interface ClassOption {
  id: string;
  name: string;
  parent_class_id: string | null;
}

interface StudentClassRef {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  class: StudentClassRef | null;
  gender: string | null;
  enrollment_date: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  subject_enrollment_count?: number;
}

export interface SubjectEnrollmentEditProps {
  academicYear: number;
  term: SubjectEnrollmentTerm;
  classSubjects: { id: string; name: string }[];
  selectedIds: string[];
  loading: boolean;
  onYearChange: (year: number) => void;
  onTermChange: (term: SubjectEnrollmentTerm) => void;
  onToggleSubject: (subjectId: string, checked: boolean) => void;
  /** Bulk select/deselect every subject in `classSubjects`. */
  onToggleAllSubjects: (checked: boolean) => void;
}

function genderAbbrev(g: string | null | undefined): string {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return "—";
}

const inlineCls =
  "h-9 w-full rounded-md border border-gray-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";

interface SubjectEnrollmentFieldsProps {
  studentId: string;
  se: SubjectEnrollmentEditProps;
}

function SubjectEnrollmentFields({
  studentId,
  se,
}: SubjectEnrollmentFieldsProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected =
    se.classSubjects.length > 0 &&
    se.selectedIds.length === se.classSubjects.length;
  const someSelected = se.selectedIds.length > 0 && !allSelected;
  // Native indeterminate state has no React prop — sync it imperatively.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <div className="rounded-lg border border-[rgb(var(--school-primary-rgb)/0.18)] bg-[rgb(var(--school-primary-rgb)/0.10)]/40 p-3 dark:border-[rgb(var(--school-primary-rgb)/0.28)] dark:bg-[rgb(var(--school-primary-rgb)/0.12)]">
      <p className="text-xs font-semibold text-school-primary dark:text-school-primary">
        Subjects this student will study
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
        Only subjects linked to the selected class appear here. Changing year
        or term loads enrolment for that period.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
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
            className="h-9 w-28 rounded-md border border-gray-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
          Term
          <select
            value={se.term}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "Term 1" || v === "Term 2") {
                se.onTermChange(v);
              }
            }}
            className="h-9 min-w-[8rem] rounded-md border border-gray-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
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
        <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
          Loading subjects…
        </p>
      ) : se.classSubjects.length === 0 ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/90">
          No subjects linked to this class yet. Configure subjects under Manage
          Subjects first.
        </p>
      ) : (
        <>
          <label
            htmlFor={`subj-${studentId}-select-all`}
            className="mt-2 flex items-center gap-2 border-b border-[rgb(var(--school-primary-rgb)/0.18)] pb-2 dark:border-[rgb(var(--school-primary-rgb)/0.28)]"
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              id={`subj-${studentId}-select-all`}
              checked={allSelected}
              onChange={(e) => se.onToggleAllSubjects(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
            />
            <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              Select All subjects
            </span>
            <span className="ml-auto text-xs text-slate-600 dark:text-zinc-400">
              {se.selectedIds.length} of {se.classSubjects.length} selected
            </span>
          </label>
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {se.classSubjects.map((sub) => (
              <li key={sub.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`subj-${studentId}-${sub.id}`}
                  checked={se.selectedIds.includes(sub.id)}
                  onChange={(e) =>
                    se.onToggleSubject(sub.id, e.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
                />
                <label
                  htmlFor={`subj-${studentId}-${sub.id}`}
                  className="text-sm text-slate-800 dark:text-zinc-200"
                >
                  {sub.name}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface DeleteConfirmDialogProps {
  studentName: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({
  studentName,
  isPending,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Delete &ldquo;{studentName}&rdquo;?
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
          This will permanently remove the student record. Any associated
          payments must be removed first.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StudentRowProps {
  student: StudentData;
  classes: ClassOption[];
  editingId: string | null;
  editValues: Partial<StudentData>;
  onInlineEdit: (student: StudentData) => void;
  onInlineChange: (field: string, value: string) => void;
  onInlineSave: () => void | Promise<void>;
  onInlineCancel: () => void;
  isSaving?: boolean;
  subjectEnrollmentEdit?: SubjectEnrollmentEditProps;
  /** Called after a successful delete (parent should refresh data). */
  onDeleted?: () => void;
  /** True when this row represents an offline-queued create or edit
   * that hasn't synced yet. Renders a "Pending sync" badge next to the
   * name. */
  pendingSync?: boolean;
  /** Red inline hints under validated fields (only set while input has invalid chars). */
  inlineFieldErrors?: Partial<
    Record<
      "full_name" | "admission_number" | "parent_name" | "parent_phone",
      string
    >
  >;
}

/**
 * Small reusable badge — same style for both desktop row and mobile card.
 * Kept in this module so changes to the badge propagate everywhere.
 */
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

export function StudentRow({
  student,
  classes,
  editingId,
  editValues,
  onInlineEdit,
  onInlineChange,
  onInlineSave,
  onInlineCancel,
  isSaving = false,
  subjectEnrollmentEdit,
  onDeleted,
  pendingSync = false,
  inlineFieldErrors = {},
}: StudentRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInline = editingId === student.id;

  function handleDelete() {
    startTransition(async () => {
      const wrapped = await enqueueOrRun({
        kind: "delete-student",
        payload: { _targetStudentId: student.id },
        run: () => deleteStudent(student.id),
        hint: {
          label: `Delete · ${student.full_name}`,
          students: {
            tempStudentId: student.id,
            fullName: student.full_name,
            classId: student.class_id ?? null,
            parentPhone: student.parent_phone ?? null,
            op: "delete",
          },
        },
      });
      if (!wrapped.ok) {
        setError(wrapped.error);
        setShowDeleteConfirm(false);
        return;
      }
      if (wrapped.queued) {
        setError(null);
        setShowDeleteConfirm(false);
        onDeleted?.();
        return;
      }
      const result = wrapped.result;
      if (result.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
        return;
      }
      setError(null);
      setShowDeleteConfirm(false);
      onDeleted?.();
    });
  }

  const parentName = student.parent_name || "—";
  const parentEmail = student.parent_email || "";
  const parentPhone = student.parent_phone || "";

  return (
    <Fragment>
      <tr>
        <td className="w-[120px] px-4 py-3 align-middle">
          {isInline ? (
            <div className="min-w-0">
              <input
                type="text"
                value={editValues.admission_number ?? ""}
                onChange={(e) =>
                  onInlineChange("admission_number", e.target.value)
                }
                onKeyDown={blockInvalidKeyDownAdmission}
                className={inlineCls}
              />
              {inlineFieldErrors.admission_number ? (
                <p
                  className="mt-0.5 text-[10px] leading-tight text-red-500"
                  role="alert"
                >
                  {inlineFieldErrors.admission_number}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="truncate font-mono text-sm text-gray-700 dark:text-zinc-300">
              {student.admission_number || "—"}
            </span>
          )}
        </td>
        <td className="w-[220px] px-4 py-3 align-middle">
          {isInline ? (
            <div className="min-w-0">
              <input
                type="text"
                value={editValues.full_name ?? ""}
                onChange={(e) => onInlineChange("full_name", e.target.value)}
                onKeyDown={blockInvalidKeyDownLettersName}
                className={inlineCls}
              />
              {inlineFieldErrors.full_name ? (
                <p
                  className="mt-0.5 text-[10px] leading-tight text-red-500"
                  role="alert"
                >
                  {inlineFieldErrors.full_name}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span className="truncate">{student.full_name}</span>
                {pendingSync ? <PendingSyncBadge /> : null}
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                ADM: {student.admission_number || "—"}
              </span>
            </div>
          )}
        </td>
        <td className="w-[120px] px-4 py-3 align-middle">
          {isInline ? (
            <select
              value={editValues.class_id ?? student.class_id}
              onChange={(e) => onInlineChange("class_id", e.target.value)}
              className={inlineCls}
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
          ) : (
            <span className="text-sm text-gray-700 dark:text-zinc-300">
              {student.class?.name || "—"}
            </span>
          )}
        </td>
        <td className="w-[72px] px-4 py-3 align-middle">
          <span className="text-sm tabular-nums text-gray-700 dark:text-zinc-300">
            {student.subject_enrollment_count ?? 0}
          </span>
        </td>
        <td className="w-[118px] px-4 py-3 align-middle">
          {isInline ? (
            <input
              type="date"
              value={editValues.enrollment_date ?? student.enrollment_date}
              onChange={(e) =>
                onInlineChange("enrollment_date", e.target.value)
              }
              className={inlineCls}
            />
          ) : (
            <span className="text-sm tabular-nums text-gray-700 dark:text-zinc-300">
              {formatEnrollmentDateDisplay(student.enrollment_date)}
            </span>
          )}
        </td>
        <td className="w-[80px] px-4 py-3 align-middle">
          {isInline ? (
            <select
              value={editValues.gender ?? ""}
              onChange={(e) => onInlineChange("gender", e.target.value)}
              className={inlineCls}
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          ) : (
            <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-zinc-300">
              {genderAbbrev(student.gender)}
            </span>
          )}
        </td>
        <td className="w-[280px] px-4 py-3 align-middle">
          {isInline ? (
            <div className="flex min-w-0 flex-col gap-1">
              <input
                type="text"
                value={editValues.parent_name ?? ""}
                onChange={(e) => onInlineChange("parent_name", e.target.value)}
                onKeyDown={blockInvalidKeyDownLettersName}
                className={inlineCls}
                placeholder="Parent name"
              />
              {inlineFieldErrors.parent_name ? (
                <p
                  className="text-[10px] leading-tight text-red-500"
                  role="alert"
                >
                  {inlineFieldErrors.parent_name}
                </p>
              ) : null}
              <input
                type="email"
                value={editValues.parent_email ?? ""}
                onChange={(e) => onInlineChange("parent_email", e.target.value)}
                className={inlineCls}
                placeholder="Email"
              />
              <input
                type="tel"
                value={editValues.parent_phone ?? ""}
                onChange={(e) => onInlineChange("parent_phone", e.target.value)}
                onKeyDown={blockInvalidKeyDownPhone}
                className={inlineCls}
                placeholder="Phone"
              />
              {inlineFieldErrors.parent_phone ? (
                <p
                  className="text-[10px] leading-tight text-red-500"
                  role="alert"
                >
                  {inlineFieldErrors.parent_phone}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {parentName}
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                {parentEmail || "—"}
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {parentPhone || "—"}
              </span>
            </div>
          )}
        </td>
        <td className="sticky right-0 z-20 w-[112px] min-w-[112px] border-l border-slate-200 bg-white px-2 py-3 align-middle shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.35)]">
          <div
            className={
              isInline
                ? "flex flex-col gap-1"
                : "flex flex-nowrap items-center gap-1"
            }
          >
            {isInline ? (
              <>
                <button
                  type="button"
                  onClick={onInlineCancel}
                  disabled={isSaving}
                  className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onInlineSave()}
                  disabled={isSaving}
                  className="w-full rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <>
                <NavLinkWithLoading
                  href={`/dashboard/students/${student.id}/profile`}
                  title="View profile"
                  aria-label="View profile"
                  className="inline-flex items-center rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-school-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-school-primary/30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:opacity-90"
                >
                  <UserCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </NavLinkWithLoading>
                <button
                  type="button"
                  onClick={() => onInlineEdit(student)}
                  title="Edit student"
                  aria-label="Edit student"
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete student"
                  aria-label="Delete student"
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {isInline && subjectEnrollmentEdit ? (
        <tr>
          <td
            colSpan={8}
            className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <SubjectEnrollmentFields
              studentId={student.id}
              se={subjectEnrollmentEdit}
            />
          </td>
        </tr>
      ) : null}

      {error && (
        <tr>
          <td
            colSpan={8}
            className="border-b border-slate-200 bg-red-50/50 px-4 py-2 dark:border-zinc-800 dark:bg-red-950/20"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </td>
        </tr>
      )}

      {showDeleteConfirm && (
        <tr>
          <td colSpan={8} className="p-0">
            <DeleteConfirmDialog
              studentName={student.full_name}
              isPending={isPending}
              onCancel={() => setShowDeleteConfirm(false)}
              onConfirm={handleDelete}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

type StudentCardProps = StudentRowProps;

export function StudentCard({
  student,
  classes,
  editingId,
  editValues,
  onInlineEdit,
  onInlineChange,
  onInlineSave,
  onInlineCancel,
  isSaving = false,
  subjectEnrollmentEdit,
  onDeleted,
  pendingSync = false,
  inlineFieldErrors = {},
}: StudentCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInline = editingId === student.id;

  function handleDelete() {
    startTransition(async () => {
      const wrapped = await enqueueOrRun({
        kind: "delete-student",
        payload: { _targetStudentId: student.id },
        run: () => deleteStudent(student.id),
        hint: {
          label: `Delete · ${student.full_name}`,
          students: {
            tempStudentId: student.id,
            fullName: student.full_name,
            classId: student.class_id ?? null,
            parentPhone: student.parent_phone ?? null,
            op: "delete",
          },
        },
      });
      if (!wrapped.ok) {
        setError(wrapped.error);
        setShowDeleteConfirm(false);
        return;
      }
      if (wrapped.queued) {
        setError(null);
        setShowDeleteConfirm(false);
        onDeleted?.();
        return;
      }
      const result = wrapped.result;
      if (result.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
        return;
      }
      setError(null);
      setShowDeleteConfirm(false);
      onDeleted?.();
    });
  }

  const parentName = student.parent_name || "—";
  const parentEmail = student.parent_email || "";
  const parentPhone = student.parent_phone || "";
  const hasParentContact = Boolean(parentEmail || parentPhone || student.parent_name);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {isInline ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editValues.full_name ?? ""}
            onChange={(e) => onInlineChange("full_name", e.target.value)}
            onKeyDown={blockInvalidKeyDownLettersName}
            className={inlineCls}
            placeholder="Full name"
          />
          {inlineFieldErrors.full_name ? (
            <p className="text-[10px] leading-tight text-red-500" role="alert">
              {inlineFieldErrors.full_name}
            </p>
          ) : null}
          <input
            type="text"
            value={editValues.admission_number ?? ""}
            onChange={(e) =>
              onInlineChange("admission_number", e.target.value)
            }
            onKeyDown={blockInvalidKeyDownAdmission}
            className={inlineCls}
            placeholder="Admission #"
          />
          {inlineFieldErrors.admission_number ? (
            <p className="text-[10px] leading-tight text-red-500" role="alert">
              {inlineFieldErrors.admission_number}
            </p>
          ) : null}
          <select
            value={editValues.class_id ?? student.class_id}
            onChange={(e) => onInlineChange("class_id", e.target.value)}
            className={inlineCls}
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
          {subjectEnrollmentEdit ? (
            <SubjectEnrollmentFields
              studentId={student.id}
              se={subjectEnrollmentEdit}
            />
          ) : null}
          <select
            value={editValues.gender ?? ""}
            onChange={(e) => onInlineChange("gender", e.target.value)}
            className={inlineCls}
          >
            <option value="">Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <input
            type="date"
            value={editValues.enrollment_date ?? student.enrollment_date}
            onChange={(e) =>
              onInlineChange("enrollment_date", e.target.value)
            }
            className={inlineCls}
            title="Enrollment date"
          />
          <input
            type="text"
            value={editValues.parent_name ?? ""}
            onChange={(e) => onInlineChange("parent_name", e.target.value)}
            onKeyDown={blockInvalidKeyDownLettersName}
            className={inlineCls}
            placeholder="Parent name"
          />
          {inlineFieldErrors.parent_name ? (
            <p className="text-[10px] leading-tight text-red-500" role="alert">
              {inlineFieldErrors.parent_name}
            </p>
          ) : null}
          <input
            type="email"
            value={editValues.parent_email ?? ""}
            onChange={(e) => onInlineChange("parent_email", e.target.value)}
            className={inlineCls}
            placeholder="Parent email"
          />
          <input
            type="tel"
            value={editValues.parent_phone ?? ""}
            onChange={(e) => onInlineChange("parent_phone", e.target.value)}
            onKeyDown={blockInvalidKeyDownPhone}
            className={inlineCls}
            placeholder="Parent phone"
          />
          {inlineFieldErrors.parent_phone ? (
            <p className="text-[10px] leading-tight text-red-500" role="alert">
              {inlineFieldErrors.parent_phone}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onInlineCancel}
              disabled={isSaving}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-800 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onInlineSave()}
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-gray-900 dark:text-white">
                <span className="truncate">{student.full_name}</span>
                {pendingSync ? <PendingSyncBadge /> : null}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-zinc-400">
                <span>
                  ADM:{" "}
                  <span className="font-mono">
                    {student.admission_number || "—"}
                  </span>
                </span>
                <span aria-hidden className="text-gray-300 dark:text-zinc-600">
                  •
                </span>
                <span>{student.class?.name || "—"}</span>
                <span aria-hidden className="text-gray-300 dark:text-zinc-600">
                  •
                </span>
                <span>{genderAbbrev(student.gender)}</span>
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[rgb(var(--school-primary-rgb)/0.10)] px-2.5 py-0.5 text-xs font-medium text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.18)] dark:text-school-primary">
              {student.subject_enrollment_count ?? 0} subj
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex items-baseline gap-2">
              <dt className="shrink-0 text-gray-500 dark:text-zinc-400">
                Enrolled:
              </dt>
              <dd className="text-gray-800 tabular-nums dark:text-zinc-200">
                {formatEnrollmentDateDisplay(student.enrollment_date)}
              </dd>
            </div>
            {hasParentContact ? (
              <div className="flex items-baseline gap-2">
                <dt className="shrink-0 text-gray-500 dark:text-zinc-400">
                  Parent:
                </dt>
                <dd className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900 dark:text-white">
                    {parentName}
                  </span>
                  {parentEmail ? (
                    <a
                      href={`mailto:${parentEmail}`}
                      className="block truncate text-school-primary hover:underline dark:text-school-primary"
                    >
                      {parentEmail}
                    </a>
                  ) : null}
                  {parentPhone ? (
                    <a
                      href={`tel:${parentPhone}`}
                      className="block truncate text-school-primary hover:underline dark:text-school-primary"
                    >
                      {parentPhone}
                    </a>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
            <NavLinkWithLoading
              href={`/dashboard/students/${student.id}/profile`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-school-primary hover:bg-[rgb(var(--school-primary-rgb)/0.10)] dark:border-zinc-600 dark:text-school-primary dark:hover:bg-[rgb(var(--school-primary-rgb)/0.18)]"
            >
              <UserCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              View profile
            </NavLinkWithLoading>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onInlineEdit(student)}
                title="Edit student"
                aria-label="Edit student"
                className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-blue-400"
              >
                <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete student"
                aria-label="Delete student"
                className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <p
          className="mt-3 rounded-md bg-red-50/70 px-2 py-1.5 text-sm text-red-600 dark:bg-red-950/20 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {showDeleteConfirm ? (
        <DeleteConfirmDialog
          studentName={student.full_name}
          isPending={isPending}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </article>
  );
}

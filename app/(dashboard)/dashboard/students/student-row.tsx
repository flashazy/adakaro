"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, UserCircle } from "lucide-react";
import { deleteStudent } from "./actions";
import { formatEnrollmentDateDisplay } from "@/lib/enrollment-date";
import {
  SUBJECT_ENROLLMENT_TERMS,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";

interface ClassOption {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  class: ClassOption | null;
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
}

const inlineCls =
  "h-9 w-full rounded-md border border-gray-200 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white";

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
}: StudentRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInline = editingId === student.id;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteStudent(student.id);
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

  function SubjectEnrollmentFields({
    se,
  }: {
    se: SubjectEnrollmentEditProps;
  }) {
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
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
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
              htmlFor={`subj-${student.id}-select-all`}
              className="mt-2 flex items-center gap-2 border-b border-indigo-100 pb-2 dark:border-indigo-900/40"
            >
              <input
                ref={selectAllRef}
                type="checkbox"
                id={`subj-${student.id}-select-all`}
                checked={allSelected}
                onChange={(e) => se.onToggleAllSubjects(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
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
                    id={`subj-${student.id}-${sub.id}`}
                    checked={se.selectedIds.includes(sub.id)}
                    onChange={(e) =>
                      se.onToggleSubject(sub.id, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
                  />
                  <label
                    htmlFor={`subj-${student.id}-${sub.id}`}
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

  return (
    <Fragment>
      <tr className="hidden md:table-row">
        <td className="w-[120px] px-4 py-3 align-middle">
          {isInline ? (
            <input
              type="text"
              value={editValues.admission_number ?? ""}
              onChange={(e) =>
                onInlineChange("admission_number", e.target.value)
              }
              className={inlineCls}
            />
          ) : (
            <span className="truncate font-mono text-sm text-gray-700 dark:text-zinc-300">
              {student.admission_number || "—"}
            </span>
          )}
        </td>
        <td className="w-[220px] px-4 py-3 align-middle">
          {isInline ? (
            <input
              type="text"
              value={editValues.full_name ?? ""}
              onChange={(e) => onInlineChange("full_name", e.target.value)}
              className={inlineCls}
            />
          ) : (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {student.full_name}
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
                  {c.name}
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
                className={inlineCls}
                placeholder="Parent name"
              />
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
                className={inlineCls}
                placeholder="Phone"
              />
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
                <Link
                  href={`/dashboard/students/${student.id}/profile`}
                  title="View profile"
                  aria-label="View profile"
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-indigo-400"
                >
                  <UserCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </Link>
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
        <tr className="hidden md:table-row">
          <td
            colSpan={8}
            className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <SubjectEnrollmentFields se={subjectEnrollmentEdit} />
          </td>
        </tr>
      ) : null}

      <tr className="md:hidden">
        <td
          colSpan={8}
          className="border-b border-slate-200 px-4 py-3 align-middle dark:border-zinc-800"
        >
          {isInline ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editValues.full_name ?? ""}
                onChange={(e) => onInlineChange("full_name", e.target.value)}
                className={inlineCls}
                placeholder="Full name"
              />
              <input
                type="text"
                value={editValues.admission_number ?? ""}
                onChange={(e) =>
                  onInlineChange("admission_number", e.target.value)
                }
                className={inlineCls}
                placeholder="Admission #"
              />
              <select
                value={editValues.class_id ?? student.class_id}
                onChange={(e) => onInlineChange("class_id", e.target.value)}
                className={inlineCls}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {subjectEnrollmentEdit ? (
                <SubjectEnrollmentFields se={subjectEnrollmentEdit} />
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
                className={inlineCls}
                placeholder="Parent name"
              />
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
                className={inlineCls}
                placeholder="Parent phone"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={onInlineCancel}
                  disabled={isSaving}
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-800 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onInlineSave()}
                  disabled={isSaving}
                  className="rounded-md bg-blue-600 px-2 py-1 text-sm text-white disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {student.full_name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-zinc-400">
                      ADM: {student.admission_number || "—"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {student.class?.name || "—"}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-zinc-400">
                    {genderAbbrev(student.gender)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Subjects (this year):{" "}
                <span className="font-medium text-gray-800 dark:text-zinc-200">
                  {student.subject_enrollment_count ?? 0}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Enrolled:{" "}
                {formatEnrollmentDateDisplay(student.enrollment_date)}
              </p>
              <div className="flex flex-col">
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
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <Link
                  href={`/dashboard/students/${student.id}/profile`}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-zinc-600 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                >
                  View profile
                </Link>
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
              </div>
            </div>
          )}
        </td>
      </tr>

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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Delete &ldquo;{student.full_name}&rdquo;?
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                  This will permanently remove the student record. Any associated
                  payments must be removed first.
                </p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isPending}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                  >
                    {isPending ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

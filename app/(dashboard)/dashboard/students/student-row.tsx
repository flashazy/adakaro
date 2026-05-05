"use client";

import { Fragment, useState, useTransition } from "react";
import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { Pencil, Trash2, UserCircle } from "lucide-react";
import { deleteStudent } from "./actions";
import { enqueueOrRun } from "@/lib/offline/enqueue-or-run";
import { formatEnrollmentDateDisplay } from "@/lib/enrollment-date";
import { cn } from "@/lib/utils";

export interface ClassOption {
  id: string;
  name: string;
  parent_class_id: string | null;
}

export interface StudentClassRef {
  id: string;
  name: string;
}

export interface StudentData {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  class: StudentClassRef | null;
  gender: string | null;
  enrollment_date: string;
  date_of_birth?: string | null;
  allergies?: string | null;
  disability?: string | null;
  insurance_provider?: string | null;
  insurance_policy?: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  subject_enrollment_count?: number;
}

function genderAbbrev(g: string | null | undefined): string {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return "—";
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

export interface StudentRowProps {
  student: StudentData;
  onEdit: (student: StudentData) => void;
  /** Called after a successful delete (parent should refresh data). */
  onDeleted?: () => void;
  /** True when this row represents an offline-queued create or edit
   * that hasn't synced yet. Renders a "Pending sync" badge next to the
   * name. */
  pendingSync?: boolean;
}

/**
 * Small reusable badge — same style for both desktop row and mobile card.
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

const tcCells = {
  adm: "w-[120px]",
  student: "w-[220px]",
  klass: "w-[120px]",
  subjects: "w-[72px]",
  enrolled: "w-[118px]",
  gender: "w-[80px]",
  parent: "w-[280px]",
  actions: "w-[112px] min-w-[112px]",
} as const;

export function StudentRow({
  student,
  onEdit,
  onDeleted,
  pendingSync = false,
}: StudentRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const tc = tcCells;

  return (
    <Fragment>
      <tr>
        <td className={cn("px-4 py-3 align-middle", tc.adm)}>
          <span className="truncate font-mono text-sm text-gray-700 dark:text-zinc-300">
            {student.admission_number || "—"}
          </span>
        </td>
        <td className={cn("px-4 py-3 align-middle", tc.student)}>
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <span className="truncate">{student.full_name}</span>
              {pendingSync ? <PendingSyncBadge /> : null}
            </span>
            <span className="text-xs text-gray-500 dark:text-zinc-400">
              ADM: {student.admission_number || "—"}
            </span>
          </div>
        </td>
        <td className={cn("px-4 py-3 align-middle", tc.klass)}>
          <span className="text-sm text-gray-700 dark:text-zinc-300">
            {student.class?.name || "—"}
          </span>
        </td>
        <td className={cn("px-4 py-3 align-middle", tc.subjects)}>
          <span className="text-sm tabular-nums text-gray-700 dark:text-zinc-300">
            {student.subject_enrollment_count ?? 0}
          </span>
        </td>
        <td className={cn("px-4 py-3 align-middle", tc.enrolled)}>
          <span className="text-sm tabular-nums text-gray-700 dark:text-zinc-300">
            {formatEnrollmentDateDisplay(student.enrollment_date)}
          </span>
        </td>
        <td className={cn("px-4 py-3 align-middle", tc.gender)}>
          <span className="text-sm font-medium tabular-nums text-gray-700 dark:text-zinc-300">
            {genderAbbrev(student.gender)}
          </span>
        </td>
        <td className={cn("px-4 py-3 align-middle", tc.parent)}>
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
        </td>
        <td
          className={cn(
            "sticky right-0 z-20 shrink-0 border-l border-slate-200 bg-white px-2 py-3 align-middle shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.35)]",
            tc.actions
          )}
        >
          <div className="flex flex-nowrap items-center gap-1">
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
              onClick={() => onEdit(student)}
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

export function StudentCard({
  student,
  onEdit,
  onDeleted,
  pendingSync = false,
}: StudentRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
  const hasParentContact = Boolean(
    parentEmail || parentPhone || student.parent_name
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
              onClick={() => onEdit(student)}
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

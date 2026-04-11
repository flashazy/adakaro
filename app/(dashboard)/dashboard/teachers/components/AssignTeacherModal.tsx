"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { TeacherActionState } from "../actions";

/** Fields the assign/edit modal needs from an assignment row. */
export interface AssignmentModalRow {
  id: string;
  classId: string;
  subjectId: string | null;
  /** Display label if subject is not in the class mapping (legacy). */
  subjectName?: string | null;
  academicYear: string;
}

export type AssignModalState =
  | { mode: "assign"; teacherId: string; teacherName: string }
  | { mode: "edit"; row: AssignmentModalRow };

interface AssignTeacherModalProps {
  modal: AssignModalState;
  onClose: () => void;
  classOptions: { id: string; name: string }[];
  subjectOptionsByClassId: Record<
    string,
    { id: string; name: string; code: string | null }[]
  >;
  modalFormAction: (formData: FormData) => void;
  modalPending: boolean;
  modalFlash: TeacherActionState | null;
}

function flash(state: TeacherActionState | null) {
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

export function AssignTeacherModal({
  modal,
  onClose,
  classOptions,
  subjectOptionsByClassId,
  modalFormAction,
  modalPending,
  modalFlash,
}: AssignTeacherModalProps) {
  const [classId, setClassId] = useState(
    modal.mode === "edit" ? modal.row.classId : ""
  );
  const [subjectId, setSubjectId] = useState(
    modal.mode === "edit" && modal.row.subjectId ? modal.row.subjectId : ""
  );

  useEffect(() => {
    if (modal.mode === "edit") {
      setClassId(modal.row.classId);
      setSubjectId(modal.row.subjectId ?? "");
    } else {
      setClassId("");
      setSubjectId("");
    }
  }, [modal]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filteredSubjects = useMemo(() => {
    if (!classId) return [];
    const mapped = subjectOptionsByClassId[classId] ?? [];
    if (
      modal.mode === "edit" &&
      modal.row.subjectId &&
      classId === modal.row.classId &&
      !mapped.some((s) => s.id === modal.row.subjectId)
    ) {
      return [
        ...mapped,
        {
          id: modal.row.subjectId,
          name: modal.row.subjectName ?? "Current subject",
          code: null as string | null,
        },
      ];
    }
    return mapped;
  }, [classId, subjectOptionsByClassId, modal]);

  const subjectPlaceholder = !classId
    ? "Select a class first…"
    : filteredSubjects.length === 0
      ? "No subjects assigned to this class. Go to Manage Subjects first."
      : "Select…";

  const canSubmit =
    Boolean(classId) &&
    Boolean(subjectId) &&
    filteredSubjects.length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-subject-modal-in max-h-[90vh] w-full max-w-md overflow-y-auto overflow-x-visible rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            id="assign-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            {modal.mode === "edit"
              ? "Edit assignment"
              : `Assign ${modal.teacherName}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <form
          key={
            modal.mode === "edit"
              ? modal.row.id
              : `assign-${modal.teacherId}`
          }
          action={modalFormAction}
          className="mt-4 space-y-3"
        >
          {flash(modalFlash)}
          {modal.mode === "assign" ? (
            <input type="hidden" name="teacher_id" value={modal.teacherId} />
          ) : (
            <input type="hidden" name="assignment_id" value={modal.row.id} />
          )}
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-zinc-300">Class</span>
            <select
              name="class_id"
              required
              value={classId}
              onChange={(e) => {
                const v = e.target.value;
                setClassId(v);
                const next = subjectOptionsByClassId[v] ?? [];
                const keepOrphan =
                  modal.mode === "edit" &&
                  modal.row.subjectId &&
                  v === modal.row.classId &&
                  !next.some((s) => s.id === modal.row.subjectId);
                if (keepOrphan && modal.row.subjectId) {
                  setSubjectId(modal.row.subjectId);
                } else {
                  setSubjectId("");
                }
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">Select…</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-zinc-300">Subject</span>
            <select
              name="subject_id"
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!classId || filteredSubjects.length === 0}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
            >
              <option value="">{subjectPlaceholder}</option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.code ? ` (${s.code})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-zinc-300">
              Academic year (optional)
            </span>
            <input
              name="academic_year"
              type="text"
              defaultValue={
                modal.mode === "edit" ? modal.row.academicYear : ""
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="2025–2026"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalPending || !canSubmit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {modalPending
                ? "Saving…"
                : modal.mode === "edit"
                  ? "Save changes"
                  : "Save assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

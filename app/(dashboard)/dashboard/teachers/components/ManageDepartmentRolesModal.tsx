"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  TEACHER_DEPARTMENTS,
  type TeacherActionState,
  type TeacherDepartment,
} from "../types";

interface ManageDepartmentRolesModalProps {
  teacherUserId: string;
  teacherName: string;
  initialDepartments: TeacherDepartment[];
  onClose: () => void;
  formAction: (formData: FormData) => void;
  pending: boolean;
  flash: TeacherActionState | null;
}

const DEPARTMENT_LABELS: Record<TeacherDepartment, string> = {
  academic: "Academic",
  discipline: "Discipline",
  health: "Health",
  finance: "Finance",
};

const DEPARTMENT_DESCRIPTIONS: Record<TeacherDepartment, string> = {
  academic: "View the Academic tab on student profiles.",
  discipline: "View the Discipline tab on student profiles.",
  health: "View the Health tab on student profiles.",
  finance: "View the Finance tab on student profiles.",
};

function renderFlash(state: TeacherActionState | null) {
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

export function ManageDepartmentRolesModal({
  teacherUserId,
  teacherName,
  initialDepartments,
  onClose,
  formAction,
  pending,
  flash,
}: ManageDepartmentRolesModalProps) {
  const [selected, setSelected] = useState<Set<TeacherDepartment>>(
    () => new Set(initialDepartments)
  );

  useEffect(() => {
    setSelected(new Set(initialDepartments));
  }, [initialDepartments, teacherUserId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (dep: TeacherDepartment) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dep)) next.delete(dep);
      else next.add(dep);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-roles-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="animate-subject-modal-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="manage-roles-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Manage department roles
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              {teacherName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-primary-rgb)/0.4)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <form action={formAction} className="mt-4 space-y-4">
          {renderFlash(flash)}
          <input
            type="hidden"
            name="teacher_user_id"
            value={teacherUserId}
          />
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Select which department(s) this teacher belongs to. Department
            users can view their assigned section(s) on student profiles.
            Admins can always see and edit every section.
          </p>
          <div className="space-y-2">
            {TEACHER_DEPARTMENTS.map((dep) => {
              const checked = selected.has(dep);
              return (
                <label
                  key={dep}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors ${
                    checked
                      ? "border-[rgb(var(--school-primary-rgb)/0.35)] bg-[rgb(var(--school-primary-rgb)/0.10)] dark:border-[rgb(var(--school-primary-rgb)/0.35)] dark:bg-[rgb(var(--school-primary-rgb)/0.18)]"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="departments"
                    value={dep}
                    checked={checked}
                    onChange={() => toggle(dep)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {DEPARTMENT_LABELS[dep]}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {DEPARTMENT_DESCRIPTIONS[dep]}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

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
              disabled={pending}
              className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save roles"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

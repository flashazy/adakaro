"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { SubjectCompatibilityBatchResult } from "@/lib/student-subject-enrollment/subject-compatibility-types";

export interface SubjectCompatibilityModalProps {
  open: boolean;
  mode: "warning" | "blocked";
  result: SubjectCompatibilityBatchResult | null;
  onClose: () => void;
  onContinue?: () => void;
  isContinuing?: boolean;
}

export function SubjectCompatibilityModal({
  open,
  mode,
  result,
  onClose,
  onContinue,
  isContinuing = false,
}: SubjectCompatibilityModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isContinuing) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isContinuing, onClose]);

  if (!open || !result) return null;

  const warningStudents = result.students.filter((s) => s.status === "warning");
  const blockedStudents = result.students.filter((s) => s.status === "blocked");
  const isBlocked = mode === "blocked";

  const title = isBlocked ? "Cannot Move Student" : "Subject Compatibility Warning";

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-compatibility-title"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close dialog"
        onClick={isContinuing ? undefined : onClose}
      />
      <div
        className={`relative z-10 flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl transition-all duration-200 dark:bg-zinc-900 sm:rounded-2xl ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 sm:translate-y-2"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
          <div className="min-w-0">
            <h2
              id="subject-compatibility-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              {title}
              {isBlocked && blockedStudents.length > 1 ? "s" : ""}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              {isBlocked
                ? blockedStudents.length === 1
                  ? "This class does not offer any of the student's enrolled subjects. Moving this student would leave them without a valid subject pathway."
                  : "These students cannot be moved because their destination classes do not offer any of their enrolled subjects."
                : "The following subjects are not offered in the selected class and will be removed if you continue:"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isContinuing}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <ul className="space-y-4">
            {(isBlocked ? blockedStudents : warningStudents).map((student) => (
              <li
                key={`${student.studentId}-${student.targetClassId}`}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                {warningStudents.length > 1 || blockedStudents.length > 1 ? (
                  <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {student.studentName}
                  </p>
                ) : null}
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
                  {student.missingSubjectNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-4 dark:border-zinc-800 sm:px-6">
          {isBlocked ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isContinuing}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel Move
              </button>
              <button
                type="button"
                onClick={onContinue}
                disabled={isContinuing}
                className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isContinuing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Continuing…
                  </>
                ) : (
                  "Continue Anyway"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  COMMON_REJECTION_ISSUE_LABELS,
  composeRejectionReason,
} from "@/lib/rejection-guidance";
import { cn } from "@/lib/utils";

export interface RejectEnrollmentGuidanceDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /**
   * Composed plain text for `rejection_reason`, or `null` when admin leaves
   * templates + note empty (Enrollment Desk shows the generic fallback).
   */
  onConfirm: (rejectionReason: string | null) => void | Promise<void>;
  isSubmitting?: boolean;
}

/**
 * Correction guidance picker: template chips + optional admin note → composed
 * rejection_reason text. Used by pending approvals and the main students table.
 */
export function RejectEnrollmentGuidanceDialog({
  open,
  title,
  subtitle = "Tap all that apply. These become clear instructions on the Enrollment Desk correction screen.",
  onClose,
  onConfirm,
  isSubmitting = false,
}: RejectEnrollmentGuidanceDialogProps) {
  const titleId = useId();
  const noteFieldId = useId();
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useState<string[]>([]);
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setTemplates([]);
      setAdminNote("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    const combined = composeRejectionReason(templates, adminNote);
    await onConfirm(combined);
  }

  const node = (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-2">
          <h2
            id={titleId}
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={() => (!isSubmitting ? onClose() : undefined)}
            disabled={isSubmitting}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="mt-4 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Common issues
            </p>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
              {subtitle}
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_REJECTION_ISSUE_LABELS.map((label) => {
                const selected = templates.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setTemplates((prev) =>
                        prev.includes(label)
                          ? prev.filter((x) => x !== label)
                          : [...prev, label]
                      )
                    }
                    className={cn(
                      "min-h-11 max-w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors touch-manipulation sm:text-sm",
                      selected
                        ? "border-red-400 bg-red-50 font-medium text-red-950 shadow-sm dark:border-red-700 dark:bg-red-950/35 dark:text-red-50"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor={noteFieldId}
              className="block text-sm font-medium text-slate-900 dark:text-white"
            >
              Additional instructions (optional)
            </label>
            <textarea
              id={noteFieldId}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder={`Example:\nPlease upload a clearer face photo and confirm the guardian number.`}
              rows={4}
              disabled={isSubmitting}
              className="min-h-[5.5rem] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base leading-relaxed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  /** Portal: StudentRow lives inside <tbody>; only <tr> is valid there. */
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

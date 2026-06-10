"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  /** Default `danger` (red). Use `primary` for non-destructive confirmations. */
  confirmVariant?: "danger" | "primary";
  /** Shown as: “NAME” will be deleted. */
  itemName?: string;
  /** Inline error when the confirm action fails. */
  error?: string | null;
  /** Warning trash icon in header (syllabus / premium delete flows). */
  showWarningIcon?: boolean;
}

/**
 * Accessible delete confirmation dialog with fade/scale animation.
 */
export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title = "Delete broadcast",
  message = "Delete this broadcast? School admins will no longer see it in their history.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isDeleting = false,
  confirmVariant = "danger",
  itemName,
  error = null,
  showWarningIcon = false,
}: ConfirmDeleteModalProps) {
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rendered, isDeleting, onClose]);

  if (!rendered) {
    return null;
  }

  const node = (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out dark:bg-black/70 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close"
        onClick={isDeleting ? undefined : onClose}
        disabled={isDeleting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        className={`relative mx-4 mb-0 w-full max-w-md rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 sm:mb-0 sm:rounded-2xl ${
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.98] opacity-0 sm:translate-y-0"
        }`}
      >
        <div className="relative border-b border-slate-200 px-4 py-4 dark:border-zinc-700 sm:px-5">
          <button
            type="button"
            onClick={isDeleting ? undefined : onClose}
            disabled={isDeleting}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-10">
            {showWarningIcon ? (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                aria-hidden
              >
                <Trash2 className="h-5 w-5" />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2
                id="confirm-delete-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {title}
              </h2>
            </div>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p
            id="confirm-delete-desc"
            className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300"
          >
            {message}
          </p>
          {itemName ? (
            <p className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100">
              &ldquo;{itemName}&rdquo; will be deleted.
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden
              />
              <span>{error}</span>
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className={cn(
                "w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 sm:w-auto",
                showWarningIcon
                  ? "border-violet-200 bg-violet-50/80 text-violet-800 hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-200 dark:hover:bg-violet-950/50"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className={
                confirmVariant === "primary"
                  ? "inline-flex w-full items-center justify-center rounded-lg bg-school-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 dark:bg-school-primary dark:hover:brightness-110 sm:w-auto"
                  : "inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-500 sm:w-auto"
              }
            >
              {isDeleting ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Deleting…
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Important: render in a portal so this modal can be used inside tables
  // (e.g. within <tbody>) without producing invalid HTML / hydration errors.
  if (!mounted) return null;
  return createPortal(node, document.body);
}

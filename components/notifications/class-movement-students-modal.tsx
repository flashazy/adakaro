"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Users, X } from "lucide-react";
import type {
  ClassMovementNotificationMetadataClient,
  ClassMovementNotificationMoveDetailClient,
} from "@/lib/notifications/in-app-notification-types";
import { ClassMovementMoveList } from "@/components/notifications/class-movement-move-list";

export function ClassMovementStudentsModal({
  open,
  title,
  subtitle,
  moves,
  direction,
  onClose,
  onStudentNavigate,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  moves: ClassMovementNotificationMoveDetailClient[];
  direction: ClassMovementNotificationMetadataClient["direction"];
  onClose: () => void;
  onStudentNavigate?: () => void;
}) {
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
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rendered, onClose]);

  if (!mounted || !rendered) return null;

  const handleStudentNavigate = () => {
    onClose();
    onStudentNavigate?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out dark:bg-black/70 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-movement-students-title"
        aria-describedby="class-movement-students-desc"
        className={`relative flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ease-out dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl ${
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.98] opacity-0 sm:translate-y-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-slate-200 px-4 py-4 dark:border-zinc-700 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--school-primary-rgb)/0.12)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.2)]"
              aria-hidden
            >
              <Users className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2
                id="class-movement-students-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {title}
              </h2>
              <p
                id="class-movement-students-desc"
                className="mt-1 text-sm text-slate-600 dark:text-zinc-400"
              >
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <ClassMovementMoveList
            moves={moves}
            direction={direction}
            onStudentNavigate={handleStudentNavigate}
            textSize="sm"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

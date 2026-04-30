"use client";

import { Loader2 } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { deleteLessonPlan } from "../actions";

type LessonPlanDeleteButtonProps = {
  planId: string;
  /** Called after server delete succeeds, before toast. */
  onDeleted?: () => void;
  buttonClassName?: string;
};

export function LessonPlanDeleteButton({
  planId,
  onDeleted,
  buttonClassName = "",
}: LessonPlanDeleteButtonProps) {
  const id = useId();
  const dialogTitleId = `${id}-title`;
  const dialogDescId = `${id}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    (
      panelRef.current?.querySelector(
        "button:not([disabled])"
      ) as HTMLButtonElement | null
    )?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isPending]);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      openerRef.current?.focus();
    }
    prevOpenRef.current = open;
  }, [open]);

  function closeUnlessPending() {
    if (!isPending) setOpen(false);
  }

  function confirmDelete() {
    startTransition(async () => {
      try {
        await deleteLessonPlan(planId);
        onDeleted?.();
        toast.success("Lesson plan deleted.");
        setOpen(false);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not delete lesson plan.";
        toast.error(msg);
      }
    });
  }

  const baseBtn =
    "inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-lg px-4 text-center text-sm font-medium touch-manipulation disabled:opacity-60";

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`${baseBtn} text-red-600 underline-offset-4 hover:bg-red-50 hover:underline disabled:cursor-not-allowed dark:text-red-400 dark:hover:bg-red-950/50 ${buttonClassName}`}
        onClick={() => setOpen(true)}
      >
        Delete
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 pb-8 sm:items-center sm:pb-4"
          aria-modal="true"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close dialog"
            disabled={isPending}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px] dark:bg-black/65"
            onClick={closeUnlessPending}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescId}
            className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id={dialogTitleId}
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Delete lesson plan?
            </h2>
            <p
              id={dialogDescId}
              className="mt-2 text-sm text-slate-600 dark:text-zinc-400"
            >
              Are you sure? This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={isPending}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:w-auto"
                onClick={closeUnlessPending}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed dark:bg-red-600 dark:hover:bg-red-500 sm:w-auto"
                onClick={confirmDelete}
              >
                {isPending ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden
                    />
                    Deleting…
                  </>
                ) : (
                  "Yes, Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

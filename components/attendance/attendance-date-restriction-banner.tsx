import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttendanceDateEditMode } from "@/lib/attendance-date-policy";
import {
  ATTENDANCE_EDIT_BANNER_MESSAGE,
  ATTENDANCE_FUTURE_BLOCKED_MESSAGE,
} from "@/lib/attendance-date-policy";

export function AttendanceDateRestrictionBanner({
  mode,
  className,
}: {
  mode: AttendanceDateEditMode;
  className?: string;
}) {
  if (mode === "editable") return null;

  const isFuture = mode === "future_blocked";
  const message = isFuture
    ? ATTENDANCE_FUTURE_BLOCKED_MESSAGE
    : ATTENDANCE_EDIT_BANNER_MESSAGE;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        isFuture
          ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-slate-200 bg-slate-50 text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200",
        className
      )}
    >
      {isFuture ? null : (
        <Lock
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400"
          aria-hidden
        />
      )}
      <div>
        <p className="font-semibold">{message}</p>
        {!isFuture ? (
          <p className="mt-1 text-slate-600 dark:text-zinc-400">
            This day is read-only. You can review who was marked, but changes
            cannot be saved.
          </p>
        ) : (
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
            {ATTENDANCE_EDIT_BANNER_MESSAGE}
          </p>
        )}
      </div>
    </div>
  );
}

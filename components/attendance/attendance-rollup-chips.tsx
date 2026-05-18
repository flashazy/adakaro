import { cn } from "@/lib/utils";
import type { AttendanceRollupCounts } from "@/lib/attendance-counts";
import {
  ILL_STATUS_DISPLAY_BADGE,
  ILL_STATUS_DISPLAY_LOWER,
} from "@/lib/student-attendance-status";

const CHIP =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export function AttendanceRollupChips(props: {
  counts: AttendanceRollupCounts;
  className?: string;
  /** Desktop inline text with middots instead of pills. */
  variant?: "chips" | "inline";
}) {
  const { counts, className, variant = "chips" } = props;

  if (variant === "inline") {
    return (
      <span className={cn("text-slate-600 dark:text-zinc-400", className)}>
        <span className="text-green-600 dark:text-green-400">
          {counts.present} present
        </span>
        <span className="mx-1.5 text-gray-300 dark:text-zinc-600">·</span>
        <span className="text-orange-600 dark:text-orange-400">
          {counts.ill} {ILL_STATUS_DISPLAY_LOWER}
        </span>
        <span className="mx-1.5 text-gray-300 dark:text-zinc-600">·</span>
        <span className="text-blue-600 dark:text-blue-400">
          {counts.permitted} permitted
        </span>
        <span className="mx-1.5 text-gray-300 dark:text-zinc-600">·</span>
        <span className="text-yellow-600 dark:text-yellow-400">
          {counts.late} late
        </span>
        <span className="mx-1.5 text-gray-300 dark:text-zinc-600">·</span>
        <span className="text-red-600 dark:text-red-400">
          {counts.absent} absent
        </span>
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span
        className={cn(
          CHIP,
          "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
        )}
      >
        {counts.present} present
      </span>
      <span
        className={cn(
          CHIP,
          "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
        )}
      >
        {counts.ill} {ILL_STATUS_DISPLAY_BADGE}
      </span>
      <span
        className={cn(
          CHIP,
          "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
        )}
      >
        {counts.permitted} permitted 📝
      </span>
      <span
        className={cn(
          CHIP,
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300"
        )}
      >
        {counts.late} late
      </span>
      <span
        className={cn(
          CHIP,
          "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        )}
      >
        {counts.absent} absent
      </span>
    </div>
  );
}

import {
  REJECTION_GUIDANCE_FALLBACK,
  parseRejectionReasonForDisplay,
} from "@/lib/rejection-guidance";
import { cn } from "@/lib/utils";

interface RejectionGuidanceDisplayProps {
  rejectionReason: string | null | undefined;
  className?: string;
  /** Slightly tighter gaps for dashboards; default is roomy for correction alerts */
  density?: "default" | "comfortable";
}

/**
 * Structured correction guidance block (templates + optional admin note + fallback).
 */
export function RejectionGuidanceDisplay({
  rejectionReason,
  className,
  density = "default",
}: RejectionGuidanceDisplayProps) {
  const parsed = parseRejectionReasonForDisplay(rejectionReason);
  const gapIssues = density === "comfortable" ? "gap-2" : "gap-3";
  const mtNote = density === "comfortable" ? "mt-3" : "mt-4";

  if (parsed.useFallback) {
    return (
      <p
        className={cn(
          "text-sm leading-relaxed text-red-700 dark:text-red-100/95",
          className
        )}
      >
        {REJECTION_GUIDANCE_FALLBACK}
      </p>
    );
  }

  const hasIssues = parsed.issues.length > 0;
  const hasNote = Boolean(parsed.adminNote?.trim());

  return (
    <div className={cn("space-y-0 text-red-900 dark:text-red-50", className)}>
      {hasIssues ? (
        <div className={cn("flex flex-col", gapIssues)}>
          <p className="text-sm font-semibold text-red-900 dark:text-red-100">
            Issues found:
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-sm leading-relaxed text-red-800 marker:text-red-600 dark:text-red-100/95 dark:marker:text-red-400">
            {parsed.issues.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasNote ? (
        <div className={cn(hasIssues ? mtNote : "", "flex flex-col gap-1.5")}>
          <p className="text-sm font-semibold text-red-900 dark:text-red-100">
            Admin note:
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-red-800 dark:text-red-100/95">
            {parsed.adminNote!.trim()}
          </p>
        </div>
      ) : null}
      {!hasIssues && !hasNote ? (
        <p className="text-sm leading-relaxed text-red-700 dark:text-red-100/95">
          {REJECTION_GUIDANCE_FALLBACK}
        </p>
      ) : null}
    </div>
  );
}

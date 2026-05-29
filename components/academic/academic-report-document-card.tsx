import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import {
  academicCardBaseClass,
  academicCardInteractiveClass,
  academicIconContainerMdClass,
} from "@/components/academic/academic-ui-styles";
import { cn } from "@/lib/utils";

interface AcademicReportDocumentCardProps {
  href: string;
  classTitle: string;
  schoolName: string;
  term: string;
  academicYear: string;
  generatedAtLabel: string;
}

function reportDocumentDescriptor(schoolName: string): string {
  const trimmed = schoolName.trim();
  if (!trimmed || trimmed === "School") {
    return "Performance Summary";
  }
  return trimmed;
}

/** Clickable report row styled as an openable document. */
export function AcademicReportDocumentCard({
  href,
  classTitle,
  schoolName,
  term,
  academicYear,
  generatedAtLabel,
}: AcademicReportDocumentCardProps) {
  const descriptor = reportDocumentDescriptor(schoolName);
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-0",
        academicCardBaseClass,
        academicCardInteractiveClass
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:pr-4">
        <span
          className={cn(
            academicIconContainerMdClass,
            "h-11 w-11 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:group-hover:bg-indigo-950/60"
          )}
        >
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-slate-900 transition-colors duration-200 group-hover:text-school-primary dark:text-white dark:group-hover:text-school-primary">
            {classTitle}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-zinc-300">
            {term} {academicYear}
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-zinc-500">
            {descriptor}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col justify-center gap-2 border-slate-200/90 sm:border-l sm:pl-4 dark:border-zinc-800">
        <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">
          Generated {generatedAtLabel}
        </span>
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1.5 text-xs font-bold text-school-primary shadow-sm transition-all duration-200 group-hover:border-[rgb(var(--school-primary-rgb)/0.3)] group-hover:bg-[rgb(var(--school-primary-rgb)/0.08)] group-hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800/80 dark:group-hover:border-[rgb(var(--school-primary-rgb)/0.35)]">
          View Report
          <ChevronRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

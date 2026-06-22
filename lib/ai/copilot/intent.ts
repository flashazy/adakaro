import type { ConversationFilters } from "./types";

export interface DetectedIntent {
  tool: string;
  classFilter?: string;
  reportType?: string;
}

export function detectCopilotIntent(
  message: string,
  priorContext: string,
  filters: ConversationFilters
): DetectedIntent | null {
  const text = `${priorContext} ${message}`.toLowerCase();

  if (
    text.includes("generate finance report") ||
    text.includes("finance report") ||
    text.includes("finance summary")
  ) {
    return { tool: "finance_report" };
  }
  if (
    text.includes("generate attendance report") ||
    text.includes("attendance report")
  ) {
    return { tool: "attendance_report" };
  }
  if (
    text.includes("generate academic report") ||
    text.includes("academic report") ||
    text.includes("exam performance")
  ) {
    return { tool: "academic_report" };
  }
  if (
    text.includes("generate management report") ||
    text.includes("management report") ||
    text.includes("school report") ||
    text.includes("school performance report") ||
    text.includes("generate school report")
  ) {
    return { tool: "management_report" };
  }

  if (
    text.includes("who has not paid") ||
    text.includes("not paid fees") ||
    text.includes("fee balance") ||
    text.includes("outstanding") ||
    text.includes("debtor") ||
    (text.includes("fee") && (text.includes("balance") || text.includes("owe")))
  ) {
    return {
      tool: filters.sortByBalance ? "top_debtors" : "fee_balances_summary",
      classFilter: filters.gradeFilter
        ? `Grade ${filters.gradeFilter}`
        : filters.classFilter,
    };
  }

  if (
    text.includes("absent") ||
    text.includes("who is absent") ||
    text.includes("not present")
  ) {
    return { tool: "absent_students", classFilter: filters.classFilter };
  }

  if (text.includes("attendance")) {
    const formMatch = text.match(/form\s*(\d+)/i);
    return {
      tool: "attendance_overview",
      classFilter:
        filters.gradeFilter
          ? `Grade ${filters.gradeFilter}`
          : formMatch
            ? `Form ${formMatch[1]}`
            : filters.classFilter,
    };
  }

  if (
    text.includes("how many students") ||
    text.includes("student count") ||
    text.includes("total students")
  ) {
    return { tool: "student_count" };
  }

  if (
    text.includes("admission") ||
    text.includes("enrolled") ||
    text.includes("joined this week") ||
    text.includes("new students")
  ) {
    return { tool: "admissions_summary" };
  }

  if (text.includes("report card")) {
    return { tool: "report_card_completion" };
  }

  if (
    text.includes("syllabus") ||
    text.includes("coverage") ||
    text.includes("behind")
  ) {
    return { tool: "syllabus_coverage_summary" };
  }

  if (
    text.includes("collected this month") ||
    text.includes("collection") ||
    text.includes("how much have we collected")
  ) {
    return { tool: "collection_performance" };
  }

  if (
    text.includes("school performance") ||
    text.includes("summarize school")
  ) {
    return { tool: "school_performance_summary" };
  }

  if (text.includes("teacher") && text.includes("assignment")) {
    return { tool: "syllabus_coverage_summary" };
  }

  return null;
}

import type { AISuggestion } from "@/lib/ai/types";

export function followUpActionsForTool(
  tool: string,
  userMessage: string
): AISuggestion[] {
  const lower = userMessage.toLowerCase();

  switch (tool) {
    case "fee_balances_summary":
    case "top_debtors":
    case "collection_performance":
      return [
        { id: "full-list", label: "View Full List", prompt: "Show the full list of students with fee balances." },
        { id: "top-debtors", label: "Top Debtors", prompt: "Show top debtors sorted by highest balance." },
        { id: "reminders", label: "Send Reminders", prompt: "How can I send fee reminders to parents?" },
        { id: "export-finance", label: "Export Report", prompt: "Generate finance report." },
      ];
    case "attendance_overview":
    case "absent_students":
      return [
        { id: "absent-today", label: "Absent Today", prompt: "Show absent students today." },
        { id: "weekly-trend", label: "Weekly Trend", prompt: "Show weekly attendance trend." },
        { id: "export-attendance", label: "Export Attendance", prompt: "Generate attendance report." },
        { id: "contact-parents", label: "Contact Parents", prompt: "Which parents should I contact about absences?" },
      ];
    case "syllabus_coverage_summary":
      return [
        { id: "view-coverage", label: "View Coverage", prompt: "Which classes are behind on syllabus coverage?" },
        { id: "show-teachers", label: "Show Teachers", prompt: "Which teachers have classes behind syllabus?" },
        { id: "generate-report", label: "Generate Report", prompt: "Generate academic report." },
        { id: "subject-breakdown", label: "See Subject Breakdown", prompt: "Show syllabus breakdown by subject." },
      ];
    case "report_card_completion":
      return [
        { id: "incomplete", label: "Incomplete Cards", prompt: "Which report cards are incomplete?" },
        { id: "class-rankings", label: "Class Rankings", prompt: "Show class rankings." },
        { id: "export-cards", label: "Export Report Cards", prompt: "How do I export report cards?" },
        { id: "academic-report", label: "Generate Report", prompt: "Generate academic report." },
      ];
    case "student_count":
    case "admissions_summary":
      return [
        { id: "new-enrollments", label: "New Enrollments", prompt: "Show newly enrolled students." },
        { id: "by-class", label: "By Class", prompt: "How many students per class?" },
        { id: "admissions-month", label: "This Month", prompt: "How many admissions this month?" },
        { id: "school-report", label: "Generate Report", prompt: "Generate management report." },
      ];
    case "finance_report":
    case "attendance_report":
    case "academic_report":
    case "management_report":
    case "school_performance_summary":
      return [
        { id: "finance", label: "Finance Summary", prompt: "Generate finance report." },
        { id: "attendance", label: "Attendance Report", prompt: "Generate attendance report." },
        { id: "academic", label: "Academic Report", prompt: "Generate academic report." },
        { id: "management", label: "Management Report", prompt: "Generate management report." },
      ];
    default:
      if (lower.includes("fee") || lower.includes("balance")) {
        return followUpActionsForTool("fee_balances_summary", userMessage);
      }
      if (lower.includes("attendance")) {
        return followUpActionsForTool("attendance_overview", userMessage);
      }
      return [
        { id: "fees", label: "Review Fees", prompt: "Show students with fee balances." },
        { id: "attendance", label: "Attendance Summary", prompt: "Show today's attendance summary." },
        { id: "coverage", label: "Review Coverage", prompt: "Which classes are behind syllabus coverage?" },
        { id: "report", label: "Generate Report", prompt: "Generate school performance report." },
      ];
  }
}

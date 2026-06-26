import type { AISuggestion } from "@/lib/ai/types";

export const PUBLIC_WELCOME_SUGGESTIONS: AISuggestion[] = [
  {
    id: "what-is",
    label: "What is Adakaro?",
    prompt: "What is Adakaro?",
  },
  {
    id: "pricing",
    label: "How much does Adakaro cost?",
    prompt: "How much does Adakaro cost?",
  },
  {
    id: "report-cards",
    label: "How do report cards work?",
    prompt: "How do report cards work?",
  },
  {
    id: "request-demo",
    label: "Can I request a demo?",
    prompt: "How can I request a demo of Adakaro?",
  },
];

export const COPILOT_WELCOME_SUGGESTIONS: AISuggestion[] = [
  {
    id: "fee-balances",
    label: "Which students have fee balances?",
    prompt: "Which students have fee balances?",
  },
  {
    id: "attendance-today",
    label: "Show today's attendance summary",
    prompt: "Show today's attendance summary.",
  },
  {
    id: "collected-term",
    label: "How much have we collected this term?",
    prompt: "How much have we collected this term?",
  },
  {
    id: "syllabus-behind",
    label: "Which classes are behind syllabus coverage?",
    prompt: "Which classes are behind syllabus coverage?",
  },
  {
    id: "performance-report",
    label: "Generate a school performance report",
    prompt: "Generate a school performance report.",
  },
  {
    id: "new-enrollments",
    label: "Show newly enrolled students",
    prompt: "Show newly enrolled students.",
  },
];

export function suggestionsAfterResponse(
  userMessage: string,
  assistantContent: string,
  product: "public" | "copilot"
): AISuggestion[] {
  const lower = `${userMessage} ${assistantContent}`.toLowerCase();

  if (product === "public") {
    if (lower.includes("price") || lower.includes("cost") || lower.includes("tzs")) {
      return [
        { id: "yearly", label: "Yearly vs monthly", prompt: "What's the difference between monthly and yearly billing?" },
        { id: "free-tier", label: "Free tier limits", prompt: "What is included in the free tier?" },
        { id: "demo", label: "Request a demo", prompt: "I'd like to request a demo." },
      ];
    }
    if (lower.includes("report card")) {
      return [
        { id: "grades", label: "Grading setup", prompt: "How does grading work in report cards?" },
        { id: "pdf", label: "PDF export", prompt: "Can we export report cards as PDF?" },
        { id: "templates", label: "Report templates", prompt: "Can we customize report card templates?" },
      ];
    }
    if (
      lower.includes("finance") ||
      lower.includes("fee") ||
      lower.includes("payment") ||
      lower.includes("receipt")
    ) {
      return [
        { id: "collection", label: "Fee collection", prompt: "How does fee collection work in Adakaro?" },
        { id: "receipts", label: "Receipts", prompt: "Can Adakaro generate payment receipts?" },
        { id: "reports", label: "Finance reports", prompt: "What finance reports are available?" },
      ];
    }
    if (lower.includes("attendance")) {
      return [
        { id: "daily", label: "Daily attendance", prompt: "How do teachers mark daily attendance?" },
        { id: "parents", label: "Parent notifications", prompt: "Can parents see attendance updates?" },
        { id: "reports", label: "Reports", prompt: "Can I export attendance reports?" },
      ];
    }
    if (
      lower.includes("parent") ||
      lower.includes("parents") ||
      lower.includes("guardian") ||
      lower.includes("parent portal")
    ) {
      return [
        { id: "attendance", label: "Parent attendance", prompt: "Can parents see attendance updates?" },
        { id: "report-cards", label: "Report cards", prompt: "Can parents download report cards?" },
        { id: "fees", label: "Fee visibility", prompt: "Can parents see fee balances?" },
      ];
    }
    return [
      { id: "pricing", label: "View pricing", prompt: "How much does Adakaro cost?" },
      { id: "demo", label: "Request a demo", prompt: "How do I request a demo?" },
      { id: "onboarding", label: "Getting started", prompt: "How do we get started with Adakaro?" },
    ];
  }

  if (lower.includes("fee") || lower.includes("balance") || lower.includes("payment")) {
    return [
      { id: "full-list", label: "View Full List", prompt: "Show the full list of students with fee balances." },
      { id: "top-debtors", label: "Top Debtors", prompt: "Show top debtors sorted by highest balance." },
      { id: "reminders", label: "Send Reminders", prompt: "How can I send fee reminders to parents?" },
      { id: "export-finance", label: "Export Report", prompt: "Generate finance report." },
    ];
  }

  if (lower.includes("attendance") || lower.includes("absent")) {
    return [
      { id: "absent-today", label: "Absent Today", prompt: "Show absent students today." },
      { id: "weekly-trend", label: "Weekly Trend", prompt: "Show weekly attendance trend." },
      { id: "export-attendance", label: "Export Attendance", prompt: "Generate attendance report." },
      { id: "contact-parents", label: "Contact Parents", prompt: "Which parents should I contact about absences?" },
    ];
  }

  if (lower.includes("syllabus") || lower.includes("coverage")) {
    return [
      { id: "view-coverage", label: "View Coverage", prompt: "Which classes are behind on syllabus coverage?" },
      { id: "show-teachers", label: "Show Teachers", prompt: "Which teachers have classes behind syllabus?" },
      { id: "generate-report", label: "Generate Report", prompt: "Generate academic report." },
      { id: "subject-breakdown", label: "See Subject Breakdown", prompt: "Show syllabus breakdown by subject." },
    ];
  }

  if (lower.includes("report card")) {
    return [
      { id: "incomplete", label: "Incomplete Cards", prompt: "Which report cards are incomplete?" },
      { id: "class-rankings", label: "Class Rankings", prompt: "Show class rankings." },
      { id: "export-cards", label: "Export Report Cards", prompt: "How do I export report cards?" },
      { id: "academic-report", label: "Generate Report", prompt: "Generate academic report." },
    ];
  }

  return [
    { id: "review-fees", label: "Review Fees", prompt: "Show students with fee balances." },
    { id: "attendance", label: "Attendance Summary", prompt: "Show today's attendance summary." },
    { id: "coverage", label: "Review Coverage", prompt: "Which classes are behind syllabus coverage?" },
    { id: "report", label: "Generate Report", prompt: "Generate school performance report." },
  ];
}

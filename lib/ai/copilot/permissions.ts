import type { CopilotRole } from "@/lib/ai/types";

const FINANCE_TOOLS = new Set([
  "fee_balances_summary",
  "top_debtors",
  "collection_performance",
  "monthly_income",
  "finance_report",
]);

const ATTENDANCE_TOOLS = new Set([
  "attendance_overview",
  "attendance_today",
  "absent_students",
  "attendance_report",
]);

const ACADEMIC_TOOLS = new Set([
  "report_card_completion",
  "syllabus_coverage_summary",
  "academic_report",
  "class_performance_summary",
]);

const MANAGEMENT_TOOLS = new Set([
  "school_performance_summary",
  "management_report",
  "student_count",
  "class_count",
  "admissions_summary",
]);

export function roleLabel(role: CopilotRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "School Admin";
    case "finance":
      return "Finance Officer";
    case "coordinator":
      return "Coordinator";
    case "teacher":
      return "Teacher";
    case "parent":
      return "Parent";
    default:
      return role;
  }
}

export function roleCapabilitiesDescription(role: CopilotRole): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "students, finance, attendance, teachers, classes, reports, syllabus coverage, and school settings";
    case "finance":
      return "payments, balances, collections, and finance reports";
    case "coordinator":
      return "academic records, report cards, and performance analytics";
    case "teacher":
      return "your own classes, subjects, attendance, and reports";
    case "parent":
      return "your children's attendance information";
    default:
      return "limited school data based on your assignment";
  }
}

export function permissionAreaForTool(tool: string): string {
  if (FINANCE_TOOLS.has(tool)) return "financial information";
  if (ATTENDANCE_TOOLS.has(tool)) return "attendance records";
  if (ACADEMIC_TOOLS.has(tool)) return "academic records";
  if (MANAGEMENT_TOOLS.has(tool)) return "school management reports";
  return "that information";
}

export function permissionDeniedMessage(tool: string, role: CopilotRole): string {
  const area = permissionAreaForTool(tool);
  return [
    `I don't currently have permission to access ${area} for your role (${roleLabel(role)}).`,
    "",
    "If you believe you should have access, please contact your school administrator.",
  ].join("\n");
}

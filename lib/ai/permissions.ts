import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { CopilotContext, CopilotRole } from "@/lib/ai/types";

const FINANCE_TOOLS = [
  "fee_balances_summary",
  "collection_performance",
  "top_debtors",
] as const;

const ADMIN_TOOLS = [
  ...FINANCE_TOOLS,
  "attendance_overview",
  "absent_students",
  "report_card_completion",
  "syllabus_coverage_summary",
  "school_performance_summary",
  "student_count",
  "admissions_summary",
  "finance_report",
  "attendance_report",
  "academic_report",
  "management_report",
] as const;

const TEACHER_TOOLS = [
  "attendance_overview",
  "class_performance_summary",
  "syllabus_coverage_summary",
] as const;

const COORDINATOR_TOOLS = [
  "report_card_completion",
  "class_performance_summary",
  "attendance_overview",
] as const;

function normalizeRole(
  profileRole: string | null,
  isSuperAdmin: boolean,
  departments: string[]
): CopilotRole {
  if (isSuperAdmin) return "super_admin";
  const role = (profileRole ?? "").toLowerCase();
  if (role === "admin" || role === "finance" || role === "accounts") {
    if (departments.includes("finance") || departments.includes("accounts")) {
      return "finance";
    }
    return "admin";
  }
  if (departments.includes("academic")) return "coordinator";
  if (role === "teacher") return "teacher";
  if (role === "parent") return "parent";
  return "teacher";
}

function toolsForRole(role: CopilotRole): string[] {
  switch (role) {
    case "super_admin":
    case "admin":
      return [...ADMIN_TOOLS];
    case "finance":
      return [...FINANCE_TOOLS, "attendance_overview"];
    case "coordinator":
      return [...COORDINATOR_TOOLS];
    case "teacher":
      return [...TEACHER_TOOLS];
    case "parent":
      return ["attendance_overview"];
    default:
      return [];
  }
}

export async function resolveCopilotContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CopilotContext | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {} as never);
  const { data: schoolId } = await supabase.rpc("get_my_school_id", {} as never);

  const profileRow = profile as { full_name: string | null; role: string } | null;
  const departments: string[] = [];

  if (schoolId) {
    const { data: deptRows } = await supabase
      .from("teacher_department_roles")
      .select("department")
      .eq("user_id", userId)
      .eq("school_id", schoolId);
    for (const row of deptRows ?? []) {
      const d = (row as { department: string }).department;
      if (d) departments.push(d);
    }
  }

  let schoolName: string | null = null;
  if (schoolId) {
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle();
    schoolName = (school as { name: string } | null)?.name ?? null;
  }

  const role = normalizeRole(
    profileRow?.role ?? null,
    isSuperAdmin === true,
    departments
  );

  return {
    userId,
    schoolId: (schoolId as string | null) ?? null,
    schoolName,
    role,
    displayName: profileRow?.full_name?.trim() || "User",
    allowedTools: toolsForRole(role),
  };
}

export function canUseTool(ctx: CopilotContext, toolName: string): boolean {
  return ctx.allowedTools.includes(toolName);
}

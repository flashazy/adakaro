import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { CopilotContext, CopilotRole } from "@/lib/ai/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { readSuperAdminWorkspaceSchoolId } from "@/lib/super-admin/workspace-school";

const FINANCE_TOOLS = [
  "fee_balances_summary",
  "collection_performance",
  "monthly_income",
  "top_debtors",
] as const;

const ADMIN_TOOLS = [
  ...FINANCE_TOOLS,
  "attendance_overview",
  "attendance_today",
  "absent_students",
  "report_card_completion",
  "syllabus_coverage_summary",
  "school_performance_summary",
  "student_count",
  "class_count",
  "admissions_summary",
  "finance_report",
  "attendance_report",
  "academic_report",
  "management_report",
] as const;

const TEACHER_TOOLS = [
  "attendance_overview",
  "attendance_today",
  "class_performance_summary",
  "syllabus_coverage_summary",
] as const;

const COORDINATOR_TOOLS = [
  "report_card_completion",
  "class_performance_summary",
  "attendance_overview",
] as const;

/**
 * Resolve the trusted Copilot role from authoritative sources.
 *
 * Precedence (matching dashboard/middleware): platform super admin, then the
 * school membership role, then department roles, then the profile role.
 * Returns `null` when no trusted role can be determined — callers must NOT
 * fall back to "teacher".
 */
function resolveTrustedRole(args: {
  isSuperAdmin: boolean;
  membershipRole: string | null;
  profileRole: string | null;
  departments: string[];
}): CopilotRole | null {
  if (args.isSuperAdmin) return "super_admin";

  const base = (args.membershipRole ?? args.profileRole ?? "")
    .toLowerCase()
    .trim();

  // School administrators get full access — never downgrade an admin.
  if (base === "admin" || base === "owner") return "admin";

  // Department roles refine non-admin staff.
  if (args.departments.includes("academic")) return "coordinator";
  if (
    base === "finance" ||
    base === "accounts" ||
    args.departments.includes("finance") ||
    args.departments.includes("accounts")
  ) {
    return "finance";
  }

  if (base === "teacher") return "teacher";
  if (base === "parent") return "parent";

  return null;
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

/** Best-effort service-role client (bypasses RLS). Null when not configured. */
function tryAdminClient(): SupabaseClient<Database> | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** Resolve the user's primary school id from the most trusted available source. */
async function resolveSchoolId(
  supabase: SupabaseClient<Database>,
  admin: SupabaseClient<Database> | null,
  userId: string,
  isSuperAdmin: boolean
): Promise<string | null> {
  if (isSuperAdmin) {
    const workspaceSchoolId = await readSuperAdminWorkspaceSchoolId();
    if (workspaceSchoolId) return workspaceSchoolId;
  }

  const { data: rpcSchoolId } = await supabase.rpc(
    "get_my_school_id",
    {} as never
  );
  if (rpcSchoolId) return rpcSchoolId as string;

  if (admin) {
    const { data: mem } = await admin
      .from("school_members")
      .select("school_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const schoolId = (mem as { school_id: string } | null)?.school_id ?? null;
    if (schoolId) return schoolId;
  }

  return null;
}

export async function resolveCopilotContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CopilotContext | null> {
  const admin = tryAdminClient();
  const db = admin ?? supabase;

  const isSuperAdmin = await checkIsSuperAdmin(supabase, userId);
  const schoolId = await resolveSchoolId(supabase, admin, userId, isSuperAdmin);

  // Profile (display name + fallback role).
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();
  const profileRow = profile as { full_name: string | null; role: string } | null;

  // Trusted school membership role (authoritative for in-school permissions).
  let membershipRole: string | null = null;
  const departments: string[] = [];
  let schoolName: string | null = null;
  let copilotEnabled = false;

  if (schoolId) {
    const { data: member } = await db
      .from("school_members")
      .select("role")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .maybeSingle();
    membershipRole = (member as { role: string } | null)?.role ?? null;

    const { data: deptRows } = await db
      .from("teacher_department_roles")
      .select("department")
      .eq("user_id", userId)
      .eq("school_id", schoolId);
    for (const row of deptRows ?? []) {
      const d = (row as { department: string }).department;
      if (d) departments.push(d);
    }

    const { data: school } = await db
      .from("schools")
      .select("name, copilot_enabled")
      .eq("id", schoolId)
      .maybeSingle();
    const schoolRow = school as {
      name: string;
      copilot_enabled: boolean | null;
    } | null;
    schoolName = schoolRow?.name ?? null;
    copilotEnabled = Boolean(schoolRow?.copilot_enabled);
  }

  const resolvedRole = resolveTrustedRole({
    isSuperAdmin,
    membershipRole,
    profileRole: profileRow?.role ?? null,
    departments,
  });

  // Never default to "teacher": surface the unresolved state to the caller.
  const roleResolved = resolvedRole !== null;
  const role: CopilotRole = resolvedRole ?? "teacher";

  return {
    userId,
    schoolId,
    schoolName,
    role,
    displayName: profileRow?.full_name?.trim() || "User",
    allowedTools: roleResolved ? toolsForRole(role) : [],
    copilotEnabled,
    roleResolved,
  };
}

export function canUseTool(ctx: CopilotContext, toolName: string): boolean {
  return ctx.allowedTools.includes(toolName);
}

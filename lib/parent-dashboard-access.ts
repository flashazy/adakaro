import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { UserRole } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ParentDashboardShellResult {
  profileRole: UserRole | null;
  profileFullName: string | null;
  hasAdminDashboardAccess: boolean;
  studentLinkIds: string[];
  /** True when session + admin profile reads both failed. */
  profileAccessBlocked: boolean;
  profileAccessError?: string;
  /** True when session + admin parent_students reads both failed. */
  parentStudentsAccessBlocked: boolean;
  parentStudentsAccessError?: string;
}

/**
 * Resolves parent dashboard shell data without alerting on non-fatal probe failures.
 * Mirrors resolveTeacherAccess: fallbacks must be attempted before treating errors as fatal.
 */
export async function resolveParentDashboardShell(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ParentDashboardShellResult> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  let profileRole = (profile as { role: UserRole; full_name: string } | null)
    ?.role ?? null;
  let profileFullName =
    (profile as { full_name: string } | null)?.full_name ?? null;

  let profileAccessBlocked = false;
  let profileAccessError: string | undefined;

  if (profileError) {
    profileAccessError = profileError.message;
    try {
      const admin = createAdminClient();
      const { data: profRow, error: adminProfErr } = await admin
        .from("profiles")
        .select("full_name, role")
        .eq("id", userId)
        .maybeSingle();
      if (!adminProfErr && profRow) {
        const row = profRow as { role: UserRole; full_name: string };
        profileRole = row.role ?? profileRole;
        profileFullName = row.full_name ?? profileFullName;
      } else {
        profileAccessBlocked = true;
        if (adminProfErr?.message) {
          profileAccessError = adminProfErr.message;
        }
      }
    } catch {
      profileAccessBlocked = true;
    }
  }

  let hasAdminDashboardAccess = profileRole === "admin";
  if (!hasAdminDashboardAccess) {
    try {
      const admin = createAdminClient();
      if (!profileRole) {
        const { data: profRow } = await admin
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        if ((profRow as { role: string } | null)?.role === "admin") {
          hasAdminDashboardAccess = true;
          profileRole = "admin";
        }
      }
      if (!hasAdminDashboardAccess) {
        const { data: memRow } = await admin
          .from("school_members")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();
        if (memRow) hasAdminDashboardAccess = true;
      }
    } catch {
      /* no service role */
    }
  }

  const { data: linksData, error: linksError } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", userId);

  let studentLinkIds = ((linksData ?? []) as { student_id: string }[]).map(
    (l) => l.student_id
  );

  let parentStudentsAccessBlocked = false;
  let parentStudentsAccessError: string | undefined;

  if (linksError) {
    parentStudentsAccessError = linksError.message;
    try {
      const admin = createAdminClient();
      const { data: adminLinks, error: adminLinkErr } = await admin
        .from("parent_students")
        .select("student_id")
        .eq("parent_id", userId);
      if (!adminLinkErr && adminLinks) {
        studentLinkIds = (adminLinks as { student_id: string }[]).map(
          (l) => l.student_id
        );
      } else {
        parentStudentsAccessBlocked = true;
        if (adminLinkErr?.message) {
          parentStudentsAccessError = adminLinkErr.message;
        }
      }
    } catch {
      parentStudentsAccessBlocked = true;
    }
  } else if (
    studentLinkIds.length === 0 &&
    profileRole === "parent"
  ) {
    try {
      const admin = createAdminClient();
      const { data: adminLinks, error: adminLinkErr } = await admin
        .from("parent_students")
        .select("student_id")
        .eq("parent_id", userId);
      if (!adminLinkErr && adminLinks && adminLinks.length > 0) {
        studentLinkIds = (adminLinks as { student_id: string }[]).map(
          (l) => l.student_id
        );
      }
    } catch {
      /* no service role */
    }
  }

  return {
    profileRole,
    profileFullName,
    hasAdminDashboardAccess,
    studentLinkIds,
    profileAccessBlocked,
    profileAccessError,
    parentStudentsAccessBlocked,
    parentStudentsAccessError,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { readSuperAdminWorkspaceSchoolId } from "@/lib/super-admin/workspace-school";

export interface CanManageSchoolSettingsInput {
  supabase: SupabaseClient<Database>;
  user: { id: string };
  schoolId: string;
  /** Active Super Admin workspace school id (cookie). */
  supportAccessSchoolId?: string | null;
  isSuperAdmin?: boolean;
}

/**
 * True when the user may view/edit/save school settings for `schoolId`.
 * Super Admins must have an active workspace cookie matching the school.
 */
export async function canManageSchoolSettings(
  input: CanManageSchoolSettingsInput
): Promise<boolean> {
  const schoolId = input.schoolId?.trim();
  if (!schoolId) return false;

  const isSuperAdmin =
    input.isSuperAdmin ??
    (await checkIsSuperAdmin(input.supabase, input.user.id));

  if (isSuperAdmin) {
    const workspaceId =
      input.supportAccessSchoolId !== undefined
        ? input.supportAccessSchoolId
        : await readSuperAdminWorkspaceSchoolId();
    return Boolean(workspaceId && workspaceId === schoolId);
  }

  const { data: isAdmin, error } = await input.supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );
  return !error && !!isAdmin;
}

export type SchoolSettingsAccessResult =
  | {
      ok: true;
      userId: string;
      schoolId: string;
      isSuperAdminWorkspace: boolean;
    }
  | { ok: false; error: string };

/**
 * Resolves the school id in scope and verifies manage permission for server actions.
 */
export async function requireSchoolSettingsAccess(
  supabase: SupabaseClient<Database>
): Promise<SchoolSettingsAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be logged in." };
  }

  const isSuperAdmin = await checkIsSuperAdmin(supabase, user.id);
  const supportAccessSchoolId = isSuperAdmin
    ? await readSuperAdminWorkspaceSchoolId()
    : null;

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return {
      ok: false,
      error: isSuperAdmin
        ? "Open a school workspace from Super Admin before editing settings."
        : "No school found for your account.",
    };
  }

  if (isSuperAdmin) {
    if (!supportAccessSchoolId) {
      return {
        ok: false,
        error:
          "Support access school is not set. Re-open the school workspace and try again.",
      };
    }
    if (supportAccessSchoolId !== schoolId) {
      return {
        ok: false,
        error:
          "Support access school does not match the current page. Re-open the school workspace and try again.",
      };
    }
  }

  const allowed = await canManageSchoolSettings({
    supabase,
    user,
    schoolId,
    supportAccessSchoolId,
    isSuperAdmin,
  });

  if (!allowed) {
    return {
      ok: false,
      error: "You do not have permission to manage school settings.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    schoolId,
    isSuperAdminWorkspace: isSuperAdmin,
  };
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { normalizeSchoolLifecycleStatus } from "@/lib/super-admin/school-lifecycle";
import { readSuperAdminWorkspaceSchoolId } from "@/lib/super-admin/workspace-school";

export interface SuperAdminWorkspaceMode {
  schoolId: string;
  schoolName: string;
}

export type ResolveSuperAdminWorkspaceModeResult =
  | { ok: true; mode: SuperAdminWorkspaceMode }
  | { ok: false; reason: "not_super_admin" | "no_workspace" }
  | { ok: false; reason: "school_unavailable" };

/**
 * True when a Super Admin explicitly opened a school via workspace mode
 * (httpOnly cookie) and the school is still available.
 */
export async function resolveSuperAdminWorkspaceMode(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ResolveSuperAdminWorkspaceModeResult> {
  if (!(await checkIsSuperAdmin(supabase, userId))) {
    return { ok: false, reason: "not_super_admin" };
  }

  const schoolId = await readSuperAdminWorkspaceSchoolId();
  if (!schoolId) {
    return { ok: false, reason: "no_workspace" };
  }

  try {
    const admin = createAdminClient();
    const { data: school, error } = await admin
      .from("schools")
      .select("id, name, school_status")
      .eq("id", schoolId)
      .maybeSingle();

    if (error || !school) {
      return { ok: false, reason: "school_unavailable" };
    }

    const row = school as {
      id: string;
      name: string;
      school_status?: string | null;
    };

    const status = normalizeSchoolLifecycleStatus(row.school_status);
    if (status === "archived") {
      return { ok: false, reason: "school_unavailable" };
    }

    const schoolName = row.name?.trim();
    if (!schoolName) {
      return { ok: false, reason: "school_unavailable" };
    }

    return {
      ok: true,
      mode: { schoolId: row.id, schoolName },
    };
  } catch {
    return { ok: false, reason: "school_unavailable" };
  }
}

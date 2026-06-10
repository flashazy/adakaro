import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { canAccessSchoolPromotions } from "@/lib/promotions/promotions-access.server";
import type { Database } from "@/types/supabase";

export async function resolveCurriculumCoverageSchoolId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: schoolIdRpc } = await supabase.rpc("get_my_school_id");
  if (schoolIdRpc != null && String(schoolIdRpc).length > 0) {
    return schoolIdRpc as string;
  }
  return getSchoolIdForUser(supabase, userId);
}

/** Academic staff, coordinators, head teachers, and school admins. */
export async function canAccessCurriculumCoverage(
  supabase: SupabaseClient<Database>,
  userId: string,
  schoolId: string
): Promise<boolean> {
  if (await canAccessSchoolPromotions(supabase, userId, schoolId)) {
    return true;
  }

  const { data: isHead } = await supabase.rpc("is_school_head_teacher", {
    p_school_id: schoolId,
  } as never);
  if (isHead) return true;

  const { data: coordinator } = await supabase
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", userId)
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();

  return Boolean(coordinator);
}

export async function requireCurriculumCoverageAccess(): Promise<
  | { ok: true; userId: string; schoolId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await resolveCurriculumCoverageSchoolId(supabase, user.id);
  if (!schoolId) return { ok: false, error: "School not found." };

  if (!(await canAccessCurriculumCoverage(supabase, user.id, schoolId))) {
    return {
      ok: false,
      error:
        "Curriculum Coverage is available to Academic staff, coordinators, head teachers, and administrators.",
    };
  }

  return { ok: true, userId: user.id, schoolId };
}

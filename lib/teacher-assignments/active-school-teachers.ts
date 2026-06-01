import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export const TEACHER_NO_LONGER_ACTIVE_ERROR =
  "This teacher is no longer active in this school.";

/** Teachers with an active `school_members` row (role teacher) for the school. */
export async function fetchActiveSchoolTeacherUserIds(
  admin: AdminClient,
  schoolId: string
): Promise<Set<string>> {
  const { data } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "teacher");

  return new Set(
    ((data ?? []) as { user_id: string }[]).map((row) => row.user_id)
  );
}

export async function assertTeacherIsActiveSchoolMember(
  admin: AdminClient,
  schoolId: string,
  teacherId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: mem } = await admin
    .from("school_members")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", teacherId)
    .eq("role", "teacher")
    .maybeSingle();

  if (!mem) {
    return { ok: false, error: TEACHER_NO_LONGER_ACTIVE_ERROR };
  }

  return { ok: true };
}

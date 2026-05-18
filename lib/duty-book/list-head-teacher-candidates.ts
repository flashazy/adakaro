import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserDisplayNames } from "@/lib/users/resolve-user-display-name";

export interface HeadTeacherCandidate {
  id: string;
  fullName: string;
}

export async function listHeadTeacherCandidates(
  schoolId: string
): Promise<HeadTeacherCandidate[]> {
  const admin = createAdminClient();
  const ids = new Set<string>();

  const { data: assignments } = await admin
    .from("teacher_assignments")
    .select("teacher_id")
    .eq("school_id", schoolId);
  for (const row of assignments ?? []) {
    const id = (row as { teacher_id: string }).teacher_id;
    if (id) ids.add(id);
  }

  const { data: members } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .in("role", ["teacher", "admin"]);
  for (const row of members ?? []) {
    const id = (row as { user_id: string }).user_id;
    if (id) ids.add(id);
  }

  if (ids.size === 0) return [];

  const names = await resolveUserDisplayNames([...ids]);

  return [...ids]
    .map((id) => ({
      id,
      fullName: names.get(id) ?? "Unnamed teacher",
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import type { Database } from "@/types/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase v2 update payload narrows to `never` without full generated types in this path
type Db = any;

export async function updateClassTeacherOwnPhoneAction(
  raw: string
): Promise<{ ok: true; phone: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in" };

  if (!(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Not allowed" };
  }

  const trimmed = raw.trim();
  const phone = trimmed.length === 0 ? null : trimmed;

  type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
  const { error } = await (supabase as Db)
    .from("profiles")
    .update({ phone } satisfies ProfileUpdate)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, phone };
}

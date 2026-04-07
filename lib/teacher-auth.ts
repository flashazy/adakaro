import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createClient } from "@/lib/supabase/server";

/** True when the profile role is `teacher`. */
export async function checkIsTeacher(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if ((profile as { role: string } | null)?.role === "teacher") {
    return true;
  }

  const { data: asTeacher, error } = await supabase.rpc(
    "is_teacher",
    {} as never
  );
  return !error && asTeacher === true;
}

/** Server-only: current session user has `profiles.role === 'teacher'`. */
export async function isTeacher(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return checkIsTeacher(supabase, user.id);
}

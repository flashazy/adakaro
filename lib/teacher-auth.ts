import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createClient } from "@/lib/supabase/server";

export interface TeacherAccessResult {
  isTeacher: boolean;
  /** Set when profile read and is_teacher RPC both fail unexpectedly. */
  authCheckError?: string;
}

/**
 * Resolves teacher access without treating a failed profile probe as fatal when
 * the SECURITY DEFINER is_teacher() RPC succeeds.
 */
export async function resolveTeacherAccess(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TeacherAccessResult> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!profileError && (profile as { role: string } | null)?.role === "teacher") {
    return { isTeacher: true };
  }

  const { data: asTeacher, error: rpcError } = await supabase.rpc(
    "is_teacher",
    {} as never
  );
  if (!rpcError && asTeacher === true) {
    return { isTeacher: true };
  }

  if (profileError && rpcError) {
    return {
      isTeacher: false,
      authCheckError: rpcError.message || profileError.message,
    };
  }

  return { isTeacher: false };
}

/** True when the profile role is `teacher`. */
export async function checkIsTeacher(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const result = await resolveTeacherAccess(supabase, userId);
  return result.isTeacher;
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

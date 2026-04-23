import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { TEACHER_TEMP_EXPIRED_ERROR } from "@/lib/teacher-temp-password-constants";

type ProfExpiry = {
  role: string;
  password_forced_reset: boolean | null;
  teacher_temp_password_expires_at: string | null;
} | null;

function isExpiredTeacherTemp(p: ProfExpiry): boolean {
  if (p?.role !== "teacher") return false;
  if (p.password_forced_reset !== true) return false;
  if (!p.teacher_temp_password_expires_at) return false;
  return new Date(p.teacher_temp_password_expires_at).getTime() <= Date.now();
}

async function clearExpiredTeacherAuthAndFlags(userId: string): Promise<void> {
  const admin = createAdminClient();
  const newPassword = randomBytes(32).toString("base64url");
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (authErr) {
    console.error(
      "[teacher-temp-password] failed to invalidate expired password",
      authErr
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  await db
    .from("profiles")
    .update({
      password_forced_reset: false,
      teacher_temp_password_expires_at: null,
    })
    .eq("id", userId);
}

/**
 * After a successful password sign-in: if the teacher's admin-issued temp
 * password window has passed, invalidate the auth password, clear flags,
 * sign out, and return an error for the login form. Otherwise return null.
 */
export async function blockLoginIfTeacherTempPasswordExpired(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: pr } = await supabase
    .from("profiles")
    .select("role, password_forced_reset, teacher_temp_password_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const p = pr as ProfExpiry;
  if (!isExpiredTeacherTemp(p)) {
    return null;
  }
  await clearExpiredTeacherAuthAndFlags(userId);
  await supabase.auth.signOut();
  return TEACHER_TEMP_EXPIRED_ERROR;
}

/**
 * If the teacher is past the admin-issued temp password window, randomize
 * their auth password (invalidating the temp), clear flags, sign out, and
 * send them to login. No-op for other roles or valid windows.
 */
export async function invalidateExpiredTeacherTempPasswordIfNeeded(
  userId: string
): Promise<void> {
  const supabase = await createClient();
  const { data: pr } = await supabase
    .from("profiles")
    .select("role, password_forced_reset, teacher_temp_password_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const p = pr as ProfExpiry;
  if (!isExpiredTeacherTemp(p)) {
    return;
  }
  await clearExpiredTeacherAuthAndFlags(userId);
  await supabase.auth.signOut();
  redirect(`/login?error=${encodeURIComponent(TEACHER_TEMP_EXPIRED_ERROR)}`);
}

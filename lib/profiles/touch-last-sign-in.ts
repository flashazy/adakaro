import type { SupabaseClient } from "@supabase/supabase-js";

/** Record a successful sign-in on the profile (duty rotation eligibility, etc.). */
export async function touchProfileLastSignInAt(
  supabase: SupabaseClient,
  userId: string,
  at: Date = new Date()
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ last_sign_in_at: at.toISOString() } as never)
    .eq("id", userId);
}

import type { User } from "@supabase/supabase-js";

/**
 * Best-effort display name: profile.full_name, then auth metadata, then email local-part.
 */
export function getDisplayName(
  user: User | null | undefined,
  profileFullName: string | null | undefined
): string {
  const fromProfile = profileFullName?.trim();
  if (fromProfile) return fromProfile;

  if (!user) return "User";

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta) {
    const fn = meta.full_name;
    if (typeof fn === "string" && fn.trim()) return fn.trim();
    const nm = meta.name;
    if (typeof nm === "string" && nm.trim()) return nm.trim();
  }

  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0] ?? "";
    if (local) {
      return local
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  return "User";
}

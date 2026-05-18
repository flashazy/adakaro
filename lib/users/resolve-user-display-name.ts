import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolve a display name for a user id.
 * Canonical table: public.profiles (not users / user_profiles).
 */
export async function resolveUserDisplayName(
  userId: string,
  fallback = "User"
): Promise<string> {
  const id = userId.trim();
  if (!id) return fallback;

  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", id)
      .maybeSingle();

    if (!error && profile) {
      const name = (profile as { full_name: string }).full_name?.trim();
      if (name) return name;
    }

    const { data: authData, error: authErr } =
      await admin.auth.admin.getUserById(id);
    if (!authErr && authData.user) {
      const meta = authData.user.user_metadata as Record<string, unknown>;
      const fromMeta =
        typeof meta.full_name === "string" ? meta.full_name.trim() : "";
      if (fromMeta) return fromMeta;
      const email = authData.user.email?.trim();
      if (email) return email.split("@")[0] ?? email;
    }
  } catch {
    /* service role unavailable */
  }

  return fallback;
}

export async function resolveUserDisplayNames(
  userIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return out;

  try {
    const admin = createAdminClient();
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", unique);

    if (!error && profiles) {
      for (const row of profiles) {
        const id = (row as { id: string }).id;
        const name = (row as { full_name: string }).full_name?.trim();
        if (id && name) out.set(id, name);
      }
    }

    const missing = unique.filter((id) => !out.has(id));
    await Promise.all(
      missing.map(async (id) => {
        out.set(id, await resolveUserDisplayName(id, "Unnamed"));
      })
    );
  } catch {
    for (const id of unique) {
      out.set(id, "Unnamed");
    }
  }

  return out;
}

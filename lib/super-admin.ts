import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type ProfileRole = Database["public"]["Tables"]["profiles"]["Row"]["role"];

export function isSuperAdminRole(
  role: ProfileRole | string | null | undefined
): boolean {
  return role === "super_admin";
}

/** Server-side: true if current user is platform super admin. */
export async function checkIsSuperAdmin(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data: rpc, error: rpcErr } = await supabase.rpc(
    "is_super_admin",
    {} as never
  );

  if (process.env.NODE_ENV === "development") {
    console.info("[checkIsSuperAdmin] is_super_admin RPC", {
      userId,
      rpc,
      rpcError: rpcErr?.message ?? null,
    });
  }

  if (!rpcErr && rpc === true) {
    return true;
  }

  const { data, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (process.env.NODE_ENV === "development") {
    console.info("[checkIsSuperAdmin] profiles.role fallback", {
      userId,
      role: (data as { role: string } | null)?.role ?? null,
      profileError: profileErr?.message ?? null,
    });
  }

  const row = data as { role: ProfileRole } | null;
  return isSuperAdminRole(row?.role);
}

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

  // @ts-expect-error get_user_role added in DB; add to types/supabase.ts when regenerated
  const { data: role, error: profileError } = await supabase.rpc("get_user_role", {
    user_id: userId,
  });

  if (process.env.NODE_ENV === "development") {
    console.info("[checkIsSuperAdmin] get_user_role fallback", {
      userId,
      role: role ?? null,
      profileError: profileError?.message ?? null,
    });
  }

  return role === "super_admin";
}

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/supabase";

export interface LoginPageExistingSession {
  /** True when Supabase auth cookies already represent a signed-in user. */
  hasSession: boolean;
  /** Normalized email of the currently signed-in user, or null. */
  sessionEmail: string | null;
  /** Safe internal path to send the user if they cancel switching accounts. */
  cancelHref: string;
}

/**
 * Reads the active session from server cookies (same source as middleware).
 * Used only on the login page to warn before replacing one account with another.
 */
export async function getLoginPageExistingSession(): Promise<LoginPageExistingSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.trim()) {
    return {
      hasSession: false,
      sessionEmail: null,
      cancelHref: "/dashboard",
    };
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const profileRole = (profileRow as { role: UserRole } | null)?.role;

  let role: UserRole =
    profileRole === "admin" ||
    profileRole === "parent" ||
    profileRole === "super_admin" ||
    profileRole === "teacher"
      ? profileRole
      : String(user.user_metadata?.role ?? "")
              .toLowerCase()
              .trim() === "admin"
        ? "admin"
        : "parent";

  const { data: rpcSuper, error: rpcSuperErr } = await supabase.rpc(
    "is_super_admin",
    {} as never
  );
  const isSuper =
    !rpcSuperErr && rpcSuper === true
      ? true
      : profileRole === "super_admin";

  if (role !== "super_admin" && role !== "teacher") {
    const { data: asTeacher, error: teacherRpcErr } = await supabase.rpc(
      "is_teacher",
      {} as never
    );
    if (!teacherRpcErr && asTeacher === true) {
      role = "teacher";
    }
  }

  const cancelHref = isSuper
    ? "/super-admin"
    : role === "admin"
      ? "/dashboard"
      : role === "teacher"
        ? "/teacher-dashboard"
        : "/parent-dashboard";

  return {
    hasSession: true,
    sessionEmail: user.email.trim().toLowerCase(),
    cancelHref,
  };
}

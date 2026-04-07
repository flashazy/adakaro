"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/supabase";

export interface AuthState {
  error?: string;
  success?: string;
}

/** Internal path only; prevents open redirects. */
function safeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const user = authData.user;
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const profileRole = (profileRow as { role: UserRole } | null)?.role;

  const role: UserRole =
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

  const next = safeInternalPath(formData.get("next") as string | null);

  // Platform super admins always land in super admin unless `next` is explicitly that area.
  if (isSuper) {
    if (next?.startsWith("/super-admin")) {
      redirect(next);
    }
    redirect("/super-admin");
  }

  if (next) {
    redirect(next);
  }

  if (role === "admin") {
    redirect("/dashboard");
  }
  if (role === "teacher") {
    redirect("/teacher-dashboard");
  }
  redirect("/parent-dashboard");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;
  const phone = (formData.get("phone") as string) || "";
  const role = (formData.get("role") as UserRole) || "parent";

  if (role === "teacher" || role === "super_admin") {
    return {
      error:
        "This role cannot be self-registered. Use a school invitation or contact support.",
    };
  }

  if (!fullName || !email || !password) {
    return { error: "Full name, email, and password are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();

  const headersList = await headers();
  const origin = headersList.get("origin") || "http://localhost:3000";

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role, phone },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  // Profile is created automatically by the handle_new_user database
  // trigger, which reads full_name, role, and phone from user metadata.

  if (!data.session) {
    return {
      success:
        "Account created! Check your email for a confirmation link, then log in.",
    };
  }

  const next = safeInternalPath(formData.get("next") as string | null);
  if (next) {
    redirect(next);
  }

  if (role === "admin") {
    redirect("/dashboard");
  }
  redirect("/parent-dashboard");
}

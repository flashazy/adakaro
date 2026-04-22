"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLoginEmailForSignIn } from "@/lib/resolve-teacher-login-email";
import type { UserRole } from "@/types/supabase";

export interface AuthState {
  error?: string;
  success?: string;
  /**
   * Login form only: which inputs to show a validation border for.
   * Distinguishes unknown email (no profile) vs wrong password when the message is generic.
   */
  loginFieldHighlight?: { identifier: boolean; password: boolean };
}

function isInvalidLoginCredentialsMessage(message: string): boolean {
  const t = message.toLowerCase();
  if (t.includes("invalid") && t.includes("credential")) return true;
  if (t.includes("invalid") && t.includes("password")) return true;
  return false;
}

/** Used after signIn fails: profile email match implies the account exists, so password was wrong. */
async function profileExistsByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<boolean> {
  const t = email.trim();
  if (!t) return false;
  const variants = Array.from(
    new Set([t, t.toLowerCase(), t.toUpperCase()].filter((x) => x.length > 0))
  );
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .in("email", variants);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export type SignOutState = { error?: string };

/** Internal path only; prevents open redirects. */
function safeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

export async function signOut(
  _prevState: SignOutState,
  _formData: FormData
): Promise<SignOutState> {
  void _prevState;
  void _formData;
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }
  redirect("/login");
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const loginRaw = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!loginRaw || !password) {
    return {
      error: "Email or name and password are required.",
      loginFieldHighlight: {
        identifier: !String(loginRaw ?? "").trim(),
        password: !password,
      },
    };
  }

  const admin = createAdminClient();
  const resolved = await resolveLoginEmailForSignIn(admin, loginRaw);
  if (!resolved.ok) {
    return {
      error: resolved.error,
      loginFieldHighlight: { identifier: true, password: false },
    };
  }
  const email = resolved.email;

  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message;
    if (isInvalidLoginCredentialsMessage(msg)) {
      const exists = await profileExistsByEmail(admin, email);
      return {
        error: msg,
        loginFieldHighlight: exists
          ? { identifier: false, password: true }
          : { identifier: true, password: false },
      };
    }
    return {
      error: msg,
      loginFieldHighlight: { identifier: true, password: true },
    };
  }

  const user = authData.user;
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, password_changed")
    .eq("id", user.id)
    .maybeSingle();

  const profileRole = (profileRow as { role: UserRole } | null)?.role;
  const passwordChanged = (profileRow as { password_changed?: boolean } | null)
    ?.password_changed;

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

  if (role === "teacher" && passwordChanged === false) {
    const q =
      next && next.startsWith("/") && !next.startsWith("//")
        ? `?next=${encodeURIComponent(next)}`
        : "";
    redirect(`/change-password${q}`);
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
  const phoneRaw = (formData.get("phone") as string) || "";
  const phone = phoneRaw.trim();
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

  if (!phone) {
    return { error: "Phone number is required." };
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

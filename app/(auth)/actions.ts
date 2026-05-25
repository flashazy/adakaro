"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLoginEmailForSignIn } from "@/lib/resolve-teacher-login-email";
import { blockLoginIfTeacherTempPasswordExpired } from "@/lib/teacher-temp-password-expiry";
import { touchProfileLastSignInAt } from "@/lib/profiles/touch-last-sign-in";
import {
  clearCaptureCardSessionCookie,
  setCaptureCardSessionCookie,
} from "@/lib/capture-card/session";
import { performSignOut } from "@/lib/auth/perform-sign-out";
import type { UserRole } from "@/types/supabase";
import bcrypt from "bcryptjs";
import type { User } from "@supabase/supabase-js";

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
  if ((data?.length ?? 0) > 0) return true;
  const { data: cc } = await admin
    .from("capture_card_users")
    .select("id")
    .in("auth_email", variants)
    .limit(1);
  return (cc?.length ?? 0) > 0;
}

export type SignOutState = { ok: true; warnings?: string[] };

/** Internal path only; prevents open redirects. */
function safeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

export async function signOut(
  _prevState: SignOutState | Record<string, never>,
  _formData: FormData
): Promise<SignOutState> {
  void _prevState;
  void _formData;

  try {
    const result = await performSignOut();
    return {
      ok: true,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    };
  } catch (err) {
    console.error("[signOut] action unexpected error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return {
      ok: true,
      warnings: [
        "Unexpected sign-out error; local cookies were cleared where possible.",
      ],
    };
  }
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const loginRaw = formData.get("email") as string;
  const password = formData.get("password") as string;
  const trace = `[login] id=${Math.random().toString(36).slice(2, 10)}`;
  console.info(`${trace} start`, {
    identifierLen: String(loginRaw ?? "").trim().length,
  });

  if (!loginRaw || !password) {
    console.info(`${trace} missing credentials`);
    return {
      error: "Email or name and password are required.",
      loginFieldHighlight: {
        identifier: !String(loginRaw ?? "").trim(),
        password: !password,
      },
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    console.error(`${trace} createAdminClient failed`);
    return {
      error:
        process.env.NODE_ENV === "development"
          ? "Server misconfiguration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local."
          : "Sign-in is temporarily unavailable. Please try again later.",
      loginFieldHighlight: { identifier: true, password: true },
    };
  }

  const identifier = String(loginRaw ?? "").trim();
  const looksLikeEmail = identifier.includes("@");

  const supabase = await createClient();

  // 1) Supabase Auth attempt (treat identifier as email if it looks like email)
  let authUser: User | null = null;
  let resolvedEmail: string | null = null;

  if (looksLikeEmail) {
    console.info(`${trace} supabase attempt#1 (direct email)`, { identifier });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password,
    });
    if (!error && data.user) {
      authUser = data.user;
      await clearCaptureCardSessionCookie();
    } else if (error) {
      console.info(`${trace} supabase attempt#1 failed`, { message: error.message });
    }
  }

  // 2) Supabase Auth attempt (resolve username/name → email, for teacher username logins)
  if (!authUser) {
    console.info(`${trace} supabase attempt#2 (resolve email)`, { identifier });
    const resolved = await resolveLoginEmailForSignIn(admin, identifier);
    if (resolved.ok) {
      resolvedEmail = resolved.email;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolved.email,
        password,
      });
      if (!error && data.user) {
        authUser = data.user;
        await clearCaptureCardSessionCookie();
      } else if (error) {
        console.info(`${trace} supabase attempt#2 failed`, { message: error.message });
      }
    } else {
      console.info(`${trace} resolveLoginEmailForSignIn not ok`, { error: resolved.error });
    }
  }

  // Supabase succeeded: proceed with original role routing.
  if (authUser) {
    const user = authUser;

    try {
      await touchProfileLastSignInAt(supabase, user.id);
    } catch {
      /* non-fatal until migration 00142 is applied */
    }

    const expiredBlock = await blockLoginIfTeacherTempPasswordExpired(
      supabase,
      user.id
    );
    if (expiredBlock) {
      return {
        error: expiredBlock,
        loginFieldHighlight: { identifier: false, password: true },
      };
    }

    const { data: sessionProf } = await supabase
      .from("profiles")
      .select(
        "role, password_changed, password_forced_reset, recovery_reset_required, must_change_password"
      )
      .eq("id", user.id)
      .maybeSingle();

    type LoginProfileRow = {
      role: UserRole;
      password_changed?: boolean;
      password_forced_reset?: boolean;
      recovery_reset_required?: boolean;
      must_change_password?: boolean;
    } | null;

    let profileRowTyped = sessionProf as LoginProfileRow;

    try {
      const adm = createAdminClient();
      const { data: adminProf } = await adm
        .from("profiles")
        .select(
          "role, password_changed, password_forced_reset, recovery_reset_required, must_change_password"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (adminProf) {
        profileRowTyped = adminProf as LoginProfileRow;
      }
    } catch {
      /* service role unavailable — keep session read */
    }

    const profileRole = profileRowTyped?.role;
    const passwordChanged = profileRowTyped?.password_changed;
    const passwordForcedReset = profileRowTyped?.password_forced_reset;
    const recoveryResetRequired = profileRowTyped?.recovery_reset_required;
    const mustChangePassword = profileRowTyped?.must_change_password === true;

    const role: UserRole =
      profileRole === "admin" ||
      profileRole === "parent" ||
      profileRole === "super_admin" ||
      profileRole === "teacher" ||
      profileRole === "capture_card_user"
        ? profileRole
        : String(user.user_metadata?.role ?? "")
                .toLowerCase()
                .trim() === "admin"
          ? "admin"
          : String(user.user_metadata?.role ?? "")
                  .toLowerCase()
                  .trim() === "capture_card_user"
            ? "capture_card_user"
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

    if (role === "capture_card_user" || profileRole === "capture_card_user") {
      const { data: ccu } = await supabase
        .from("capture_card_users")
        .select("school_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      const schoolId = (ccu as { school_id: string } | null)?.school_id;
      if (schoolId) {
        const jar = await cookies();
        jar.set("capture_card_school_id", schoolId, {
          path: "/",
          maxAge: 60 * 60 * 24 * 400,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
        });
      }
      if (next?.startsWith("/capture-card")) {
        redirect(next);
      }
      redirect("/capture-card");
    }

    // Platform super admins always land in super admin unless `next` is explicitly that area.
    if (isSuper) {
      if (next?.startsWith("/super-admin")) {
        redirect(next);
      }
      redirect("/super-admin");
    }

    if (
      role === "teacher" &&
      (passwordChanged === false || passwordForcedReset === true)
    ) {
      const q =
        next && next.startsWith("/") && !next.startsWith("//")
          ? `?next=${encodeURIComponent(next)}`
          : "";
      redirect(`/change-password${q}`);
    }
    if (role === "parent" && mustChangePassword) {
      const q =
        next && next.startsWith("/") && !next.startsWith("//")
          ? `?next=${encodeURIComponent(next)}`
          : "";
      redirect(`/change-password${q}`);
    }
    if (
      role === "parent" &&
      (recoveryResetRequired === true || passwordForcedReset === true)
    ) {
      redirect("/reset-password");
    }

    if (next) {
      redirect(next);
    }

    if (
      role === "admin" ||
      profileRole === "finance" ||
      profileRole === "accounts"
    ) {
      redirect("/dashboard");
    }
    if (role === "teacher") {
      redirect("/teacher-dashboard");
    }
    redirect("/parent-dashboard");
  }

  // 3) Capture-card fallback (only after BOTH Supabase attempts fail)
  console.info(`${trace} capture-card fallback`, { identifier });
  const wanted = identifier;
  const variants = Array.from(
    new Set([wanted, wanted.toLowerCase(), wanted.toUpperCase()].filter(Boolean))
  );
  console.info(`${trace} capture query`, { variants });
  const { data: rows, error: qErr } = await admin
    .from("capture_card_users")
    .select("id, username, password_hash, school_id, is_active, expires_at")
    .in("username", variants)
    .limit(5);

  if (qErr) {
    console.error("[login] capture_card_users query error", qErr);
    return {
      error: looksLikeEmail || resolvedEmail
        ? "Invalid email or password."
        : "Invalid username or password.",
      loginFieldHighlight: { identifier: true, password: true },
    };
  }
  console.info(`${trace} capture query result`, { count: rows?.length ?? 0 });

  const row = (rows ?? []).find(
    (r) =>
      String((r as { username?: string }).username ?? "")
        .trim()
        .toLowerCase() === wanted.trim().toLowerCase()
  ) as
    | {
        id: string;
        password_hash: string | null;
        school_id: string;
        is_active: boolean;
        expires_at: string | null;
      }
    | undefined;

  if (!row || !row.is_active || !row.password_hash) {
    return {
      error: "Invalid username or password.",
      loginFieldHighlight: { identifier: true, password: true },
    };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return {
      error: "Invalid username or password.",
      loginFieldHighlight: { identifier: true, password: true },
    };
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  console.info(`${trace} bcrypt.compare`, { ok, ccuId: row.id });
  if (!ok) {
    return {
      error: "Invalid username or password.",
      loginFieldHighlight: { identifier: true, password: true },
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.auth.signOut as any)({ scope: "local" });
  } catch {
    // ignore
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  try {
    await setCaptureCardSessionCookie({
      v: 1,
      ccu_id: row.id,
      school_id: row.school_id,
      username: wanted,
      exp,
    });
    console.info(`${trace} cc_session set ok`, {
      ccuId: row.id,
      schoolId: row.school_id,
    });
  } catch (e) {
    console.error(`${trace} cc_session set failed`, e);
    return {
      error: "Sign-in is temporarily unavailable. Please try again later.",
      loginFieldHighlight: { identifier: true, password: true },
    };
  }

  console.info(`${trace} redirect /capture-card`);
  redirect("/capture-card");
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

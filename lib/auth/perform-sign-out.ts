import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { clearCaptureCardSessionCookie } from "@/lib/capture-card/session";

const SCHOOL_DASHBOARD_MODE_COOKIE = "school_dashboard_mode";

export type SignOutResult = {
  ok: true;
  warnings: string[];
};

function logSignOut(
  step: string,
  detail?: Record<string, unknown> | Error | string
): void {
  if (detail instanceof Error) {
    console.error(`[signOut] ${step}`, {
      message: detail.message,
      name: detail.name,
      stack: detail.stack,
    });
    return;
  }
  if (detail != null) {
    console.error(`[signOut] ${step}`, detail);
    return;
  }
  console.error(`[signOut] ${step}`);
}

function isSupabaseAuthCookieName(name: string): boolean {
  return (
    name.startsWith("sb-") ||
    name.includes("auth-token") ||
    name.includes("auth-code-verifier")
  );
}

/** Best-effort session teardown. Never throws — always returns ok for client redirect. */
export async function performSignOut(): Promise<SignOutResult> {
  const trace = `trace=${Date.now().toString(36)}`;
  const warnings: string[] = [];
  logSignOut(`start ${trace}`, {
    nodeEnv: process.env.NODE_ENV,
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
  });

  try {
    await clearCaptureCardSessionCookie();
    logSignOut(`capture_session_cookie ok ${trace}`);
  } catch (err) {
    logSignOut(`capture_session_cookie failed ${trace}`, err);
    warnings.push("Enrollment desk session cookie could not be cleared.");
  }

  try {
    const jar = await cookies();

    try {
      jar.set(SCHOOL_DASHBOARD_MODE_COOKIE, "", {
        path: "/",
        maxAge: 0,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      logSignOut(`school_dashboard_mode ok ${trace}`);
    } catch (err) {
      logSignOut(`school_dashboard_mode failed ${trace}`, err);
      warnings.push("Dashboard mode cookie could not be cleared.");
    }

    let clearedAuthCookies = 0;
    for (const c of jar.getAll()) {
      if (!isSupabaseAuthCookieName(c.name)) continue;
      try {
        jar.set(c.name, "", {
          path: "/",
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
        clearedAuthCookies += 1;
      } catch (err) {
        logSignOut(`clear_auth_cookie failed name=${c.name} ${trace}`, err);
      }
    }
    logSignOut(`auth_cookies_cleared ${trace}`, { count: clearedAuthCookies });
  } catch (err) {
    logSignOut(`cookies() access failed ${trace}`, err);
    warnings.push("Server could not read cookies; try signing out again from login.");
  }

  try {
    const supabase = await createClient();
    logSignOut(`createClient ok ${trace}`);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logSignOut(`supabase_signOut_global error ${trace}`, {
          message: error.message,
          status: (error as { status?: number }).status,
        });
        warnings.push(`Supabase sign-out: ${error.message}`);
      } else {
        logSignOut(`supabase_signOut_global ok ${trace}`);
      }
    } catch (err) {
      logSignOut(`supabase_signOut_global threw ${trace}`, err);
      warnings.push("Supabase global sign-out request failed.");
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: localErr } = await (supabase.auth.signOut as any)({
        scope: "local",
      });
      if (localErr) {
        logSignOut(`supabase_signOut_local error ${trace}`, {
          message: localErr.message,
        });
      } else {
        logSignOut(`supabase_signOut_local ok ${trace}`);
      }
    } catch (err) {
      logSignOut(`supabase_signOut_local threw ${trace}`, err);
    }
  } catch (err) {
    logSignOut(`createClient failed ${trace}`, err);
    warnings.push(
      err instanceof Error
        ? `Supabase client: ${err.message}`
        : "Supabase client could not be created."
    );
  }

  logSignOut(`complete ${trace}`, {
    ok: true,
    warningCount: warnings.length,
    warnings,
  });

  return { ok: true, warnings };
}

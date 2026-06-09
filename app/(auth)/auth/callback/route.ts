import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  reportAuthCallbackAlert,
  resolveAuthCallbackAlert,
} from "@/lib/watchdog/auth-health-alerts";
import { AUTH_CALLBACK_REASONS } from "@/lib/watchdog/auth-reasons";

interface ProfileRoleRow {
  role: string;
}

const ROLE_REDIRECTS: Record<string, string> = {
  teacher: "/teacher-dashboard",
  admin: "/dashboard",
  parent: "/parent-dashboard",
  super_admin: "/super-admin",
};

function redirectForRole(
  role: string | null | undefined,
  origin: string
): NextResponse | null {
  const normalized = role?.trim();
  if (!normalized) return null;
  const path = ROLE_REDIRECTS[normalized];
  if (!path) return null;
  return NextResponse.redirect(new URL(path, origin));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      reportAuthCallbackAlert({
        reason: AUTH_CALLBACK_REASONS.sessionExchangeFailed,
        error: error.message,
      });
      return NextResponse.redirect(new URL("/login", requestUrl.origin));
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    reportAuthCallbackAlert({
      reason: AUTH_CALLBACK_REASONS.sessionMissingAfterCallback,
    });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const allowedNext = [
    "/dashboard",
    "/teacher-dashboard",
    "/parent-dashboard",
    "/super-admin",
  ];
  if (next && allowedNext.includes(next)) {
    resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.sessionExchangeFailed);
    resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.sessionMissingAfterCallback);
    resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.profileLookupFailed);
    resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.profileRoleMissing);
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    const metaRole = String(user.user_metadata?.role ?? "")
      .toLowerCase()
      .trim();
    const metaRedirect = redirectForRole(metaRole, requestUrl.origin);
    if (metaRedirect) {
      resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.profileLookupFailed);
      return metaRedirect;
    }
    reportAuthCallbackAlert({
      reason: AUTH_CALLBACK_REASONS.profileLookupFailed,
      metadata: { user_id: user.id },
      error: profileErr?.message ?? "profile_missing",
    });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const profileRow = profile as ProfileRoleRow;
  const userRole = profileRow.role?.trim();
  if (!userRole) {
    const metaRole = String(user.user_metadata?.role ?? "")
      .toLowerCase()
      .trim();
    const metaRedirect = redirectForRole(metaRole, requestUrl.origin);
    if (metaRedirect) {
      resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.profileRoleMissing);
      return metaRedirect;
    }
    reportAuthCallbackAlert({
      reason: AUTH_CALLBACK_REASONS.profileRoleMissing,
      metadata: { user_id: user.id },
    });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.sessionExchangeFailed);
  resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.sessionMissingAfterCallback);
  resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.profileLookupFailed);
  resolveAuthCallbackAlert(AUTH_CALLBACK_REASONS.profileRoleMissing);

  const redirectTo = ROLE_REDIRECTS[userRole] || "/login";

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}

import { NextResponse } from "next/server";

import { getLoginPageExistingSession } from "@/app/(auth)/login/get-existing-session";

/**
 * Current Supabase session email + cancel path for the login-page warning.
 * Reads cookies on this request (reflects other tabs that overwrote the session).
 */
export async function GET() {
  const s = await getLoginPageExistingSession();
  return NextResponse.json({
    email: s.sessionEmail,
    cancelHref: s.cancelHref,
    hasSession: s.hasSession,
  });
}

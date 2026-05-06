import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { readCaptureCardSession } from "@/lib/capture-card/session";

/**
 * Current Supabase session email + cancel path for the login-page warning.
 * Reads cookies on this request (reflects other tabs that overwrote the session).
 */
export async function GET() {
  const capture = await readCaptureCardSession();
  if (capture) {
    return NextResponse.json({
      email: null,
      cancelHref: "/capture-card",
      hasSession: true,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? null;
  let cancelHref = "/dashboard";
  if (user) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profileRow as { role?: string } | null)?.role ?? "";
    cancelHref =
      role === "teacher"
        ? "/teacher-dashboard"
        : role === "super_admin"
          ? "/super-admin"
          : role === "admin" || role === "finance" || role === "accounts"
            ? "/dashboard"
            : "/parent-dashboard";
  }

  return NextResponse.json({
    email,
    cancelHref,
    hasSession: Boolean(user),
  });
}

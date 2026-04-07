import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface ProfileRoleRow {
  role: string;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login", requestUrl.origin));
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const allowedNext = [
    "/dashboard",
    "/teacher-dashboard",
    "/parent-dashboard",
    "/super-admin",
  ];
  if (next && allowedNext.includes(next)) {
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const profileRow = profile as ProfileRoleRow;
  const userRole = profileRow.role?.trim();
  if (!userRole) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const roleRedirects: Record<string, string> = {
    teacher: "/teacher-dashboard",
    admin: "/dashboard",
    parent: "/parent-dashboard",
    super_admin: "/super-admin",
  };

  const redirectTo = roleRedirects[userRole] || "/login";

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}

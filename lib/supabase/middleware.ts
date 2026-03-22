import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/supabase";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not add logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very
  // hard to debug issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthCallback = pathname.startsWith("/auth/callback");

  const isAuthPage =
    !isAuthCallback &&
    (pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/auth"));

  const isAdminRoute = pathname.startsWith("/dashboard");
  const isParentRoute = pathname.startsWith("/parent-dashboard");
  const isProtectedRoute = isAdminRoute || isParentRoute;

  // Unauthenticated users trying to access protected routes → login.
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // JWT metadata first (always available); override from DB when present.
    // Using only metadata while the parent page requires profiles.role caused a
    // loop: page → redirect /dashboard, middleware → redirect /parent-dashboard.
    let role: "admin" | "parent" =
      String(user.user_metadata?.role ?? "")
        .toLowerCase()
        .trim() === "admin"
        ? "admin"
        : "parent";

    if (isAuthPage || isProtectedRoute) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const pr = (profileRow as { role: "admin" | "parent" } | null)?.role;
      if (pr === "admin" || pr === "parent") {
        role = pr;
      }
    }

    // Redirect authenticated users away from auth pages.
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = role === "admin" ? "/dashboard" : "/parent-dashboard";
      return NextResponse.redirect(url);
    }

    // Enforce role-based access on protected routes.
    if (isAdminRoute && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/parent-dashboard";
      return NextResponse.redirect(url);
    }

    if (isParentRoute && role !== "parent") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: Return the supabaseResponse object as-is. Creating a
  // new NextResponse and copying cookies loses session state.
  return supabaseResponse;
}

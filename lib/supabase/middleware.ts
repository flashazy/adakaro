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
  const isSuperAdminRoute = pathname.startsWith("/super-admin");
  const isTeacherRoute = pathname.startsWith("/teacher-dashboard");
  const isProtectedRoute =
    isAdminRoute || isParentRoute || isSuperAdminRoute || isTeacherRoute;
  const isSchoolSuspendedPage = pathname === "/school-suspended";
  const isPaymentPage = pathname === "/payment";
  /** Public marketing landing — allow suspended users to exit here without loop */
  const isLandingPage = pathname === "/";
  const isSchoolReactivationPaymentApi = pathname.startsWith(
    "/api/payment/school-reactivation"
  );

  // Suspension and payment pages are for logged-in users only.
  if (!user && (isSchoolSuspendedPage || isPaymentPage)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

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
    const metaRole = String(user.user_metadata?.role ?? "")
      .toLowerCase()
      .trim();
    let role: "admin" | "parent" | "super_admin" | "teacher" =
      metaRole === "admin"
        ? "admin"
        : metaRole === "teacher"
          ? "teacher"
          : "parent";

    if (
      isAuthPage ||
      isProtectedRoute ||
      isSchoolSuspendedPage ||
      isPaymentPage
    ) {
      // SECURITY DEFINER — reliable even if profiles SELECT is flaky for this user.
      const { data: rpcSuper, error: rpcSuperErr } = await supabase.rpc(
        "is_super_admin",
        {} as never
      );
      if (!rpcSuperErr && rpcSuper === true) {
        role = "super_admin";
      } else {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const pr = (profileRow as {
          role: "admin" | "parent" | "super_admin" | "teacher";
        } | null)?.role;
        if (
          pr === "admin" ||
          pr === "parent" ||
          pr === "super_admin" ||
          pr === "teacher"
        ) {
          role = pr;
        }
      }

      // If profiles SELECT missed the row (RLS timing) but JWT metadata defaulted to
      // parent, we would send teachers parent-dashboard ↔ teacher-dashboard in a loop.
      // is_teacher() is SECURITY DEFINER (see migration 00048).
      if (role !== "super_admin" && role !== "teacher") {
        const { data: asTeacher, error: teacherRpcErr } = await supabase.rpc(
          "is_teacher",
          {} as never
        );
        if (!teacherRpcErr && asTeacher === true) {
          role = "teacher";
        }
      }
    }

    const { data: blockedBySuspension } =
      await supabase.rpc("is_user_blocked_by_school_suspension");

    if (blockedBySuspension === true) {
      if (
        pathname.startsWith("/api") &&
        !isSchoolReactivationPaymentApi
      ) {
        return NextResponse.json(
          {
            error:
              "This school account has been suspended. Please contact support for assistance.",
          },
          { status: 403 }
        );
      }
      if (!isSchoolSuspendedPage && !isPaymentPage && !isLandingPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/school-suspended";
        return NextResponse.redirect(url);
      }
    } else if (isSchoolSuspendedPage) {
      const url = request.nextUrl.clone();
      if (role === "super_admin") {
        url.pathname = "/super-admin";
      } else if (role === "admin") {
        url.pathname = "/dashboard";
      } else if (role === "teacher") {
        url.pathname = "/teacher-dashboard";
      } else {
        url.pathname = "/parent-dashboard";
      }
      return NextResponse.redirect(url);
    } else if (isPaymentPage) {
      const url = request.nextUrl.clone();
      if (role === "super_admin") {
        url.pathname = "/super-admin";
      } else if (role === "admin") {
        url.pathname = "/dashboard";
      } else if (role === "teacher") {
        url.pathname = "/teacher-dashboard";
      } else {
        url.pathname = "/parent-dashboard";
      }
      return NextResponse.redirect(url);
    }

    if (role === "teacher") {
      const { data: profPw } = await supabase
        .from("profiles")
        .select("password_changed")
        .eq("id", user.id)
        .maybeSingle();
      const mustChange =
        (profPw as { password_changed?: boolean } | null)?.password_changed ===
        false;
      if (mustChange) {
        const isChangePasswordPage = pathname.startsWith("/change-password");
        const isAuthApi = pathname.startsWith("/api/auth");
        if (!isChangePasswordPage && !isAuthApi) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              {
                error: "You must change your password before continuing.",
              },
              { status: 403 }
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = "/change-password";
          url.searchParams.set(
            "next",
            `${pathname}${request.nextUrl.search || ""}`
          );
          return NextResponse.redirect(url);
        }
      }
    }

    // Redirect authenticated users away from auth pages.
    if (isAuthPage) {
      const url = request.nextUrl.clone();
      if (role === "super_admin") {
        url.pathname = "/super-admin";
      } else if (role === "admin") {
        url.pathname = "/dashboard";
      } else if (role === "teacher") {
        url.pathname = "/teacher-dashboard";
      } else {
        url.pathname = "/parent-dashboard";
      }
      return NextResponse.redirect(url);
    }

    // Super admin routes: platform owners only.
    if (isSuperAdminRoute && role !== "super_admin") {
      const url = request.nextUrl.clone();
      if (role === "parent") {
        url.pathname = "/parent-dashboard";
      } else if (role === "teacher") {
        url.pathname = "/teacher-dashboard";
      } else {
        url.pathname = "/dashboard";
      }
      return NextResponse.redirect(url);
    }

    if (isTeacherRoute && role !== "teacher") {
      const url = request.nextUrl.clone();
      if (role === "super_admin") {
        url.pathname = "/super-admin";
      } else if (role === "admin") {
        url.pathname = "/dashboard";
      } else {
        url.pathname = "/parent-dashboard";
      }
      return NextResponse.redirect(url);
    }

    // Enforce role-based access on protected routes.
    if (isAdminRoute && role !== "admin" && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname =
        role === "teacher" ? "/teacher-dashboard" : "/parent-dashboard";
      return NextResponse.redirect(url);
    }

    // Parents who are also school admins need both dashboards (fees + admin UI).
    if (isParentRoute && role !== "parent" && role !== "admin") {
      const url = request.nextUrl.clone();
      if (role === "super_admin") {
        url.pathname = "/super-admin";
      } else if (role === "teacher") {
        url.pathname = "/teacher-dashboard";
      } else {
        url.pathname = "/dashboard";
      }
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: Return the supabaseResponse object as-is. Creating a
  // new NextResponse and copying cookies loses session state.
  return supabaseResponse;
}

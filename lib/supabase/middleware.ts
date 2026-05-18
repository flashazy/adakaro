import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { TEACHER_TEMP_EXPIRED_ERROR } from "@/lib/teacher-temp-password-constants";
import type { Database } from "@/types/supabase";

const CAPTURE_SESSION_COOKIE = "cc_session";

type CaptureCookiePayload = {
  v: 1;
  ccu_id: string;
  school_id: string;
  username?: string;
  exp: number; // unix seconds
};

type CaptureSessionReadResult =
  | { ok: true; payload: CaptureCookiePayload }
  | { ok: false; hadCookie: boolean };

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const str = atob(b64 + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256Base64Url(
  secret: string,
  data: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return bytesToBase64Url(sig);
}

async function readCaptureSession(
  request: NextRequest
): Promise<CaptureSessionReadResult> {
  const cookie = request.cookies.get(CAPTURE_SESSION_COOKIE)?.value ?? "";
  if (!cookie) return { ok: false, hadCookie: false };
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return { ok: false, hadCookie: true };

  const secret =
    process.env.CAPTURE_CARD_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "";
  if (!secret) return { ok: false, hadCookie: true };

  let expected = "";
  try {
    expected = await hmacSha256Base64Url(secret, body);
  } catch {
    return { ok: false, hadCookie: true };
  }
  if (expected !== sig) return { ok: false, hadCookie: true };

  let payload: CaptureCookiePayload;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(body));
    payload = JSON.parse(json) as CaptureCookiePayload;
  } catch {
    return { ok: false, hadCookie: true };
  }

  if (payload?.v !== 1) return { ok: false, hadCookie: true };
  if (!payload.ccu_id || !payload.school_id)
    return { ok: false, hadCookie: true };
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000))
    return { ok: false, hadCookie: true };
  return { ok: true, payload };
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isAuthCallback = pathname.startsWith("/auth/callback");

  const isEnrollmentDeskAccessRoute = pathname.startsWith(
    "/enrollment-desk/access"
  );
  const isCaptureCardRoute = pathname.startsWith("/capture-card");

  const isPasswordSetupPage =
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/reset-password");

  const isAuthPage =
    !isAuthCallback &&
    (pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/forgot-password") ||
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

  const debug = process.env.NODE_ENV === "development";
  const rawCc = request.cookies.get(CAPTURE_SESSION_COOKIE)?.value ?? "";
  const captureRead = await readCaptureSession(request);
  const captureSession = captureRead.ok ? captureRead.payload : null;

  if (debug) {
    console.info("[cc_session] check", {
      pathname,
      hasCookie: Boolean(rawCc),
      decodeOk: captureRead.ok,
      ccu_id: captureSession?.ccu_id ?? null,
      school_id: captureSession?.school_id ?? null,
      username: captureSession?.username ?? null,
    });
  }

  let supabaseResponse = NextResponse.next({ request });
  if (!captureRead.ok && captureRead.hadCookie) {
    if (debug) console.warn("[cc_session] invalid cookie cleared");
    supabaseResponse.cookies.set(CAPTURE_SESSION_COOKIE, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
  }

  // IMPORTANT: For capture-card routes, we MUST avoid Supabase auth calls in Edge
  // (they can fail with AuthRetryableFetchError: fetch failed). Cookie session is enough.
  if (captureSession && isCaptureCardRoute) {
    if (debug) console.info("[cc_session] allow capture-card via cookie");
    return supabaseResponse;
  }

  if (captureSession && isAuthPage) {
    if (debug) console.info("[cc_session] redirect away from auth page");
    const url = request.nextUrl.clone();
    url.pathname = "/capture-card";
    return NextResponse.redirect(url);
  }

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

  let user: unknown = null;
  try {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u;
  } catch (e) {
    if (debug) console.warn("[supabase] auth.getUser failed in middleware", e);
    user = null;
  }
  const typedUser = user as { id: string; user_metadata?: Record<string, unknown> } | null;

  // Suspension and payment pages are for logged-in users only.
  if (!typedUser && !captureSession && (isSchoolSuspendedPage || isPaymentPage)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (debug) console.info("[auth] redirect to /login (suspension/payment)");
    return NextResponse.redirect(url);
  }

  // Unauthenticated users trying to access protected routes → login.
  if (!typedUser && !captureSession && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (debug) console.info("[auth] redirect to /login (protected route)");
    return NextResponse.redirect(url);
  }

  // Capture-card pages: allow through even if middleware can't validate Supabase user.
  // The /capture-card route itself will handle legacy Supabase sessions in Node runtime.
  if (!typedUser && !captureSession && isCaptureCardRoute) {
    if (debug) {
      console.info(
        "[auth] allow capture-card without cc_session (legacy handled by route)"
      );
    }
    return supabaseResponse;
  }

  // Capture session should never access normal dashboards.
  if (!typedUser && captureSession && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/capture-card";
    if (debug) console.info("[cc_session] redirect to /capture-card (protected route)");
    return NextResponse.redirect(url);
  }

  if (typedUser) {
    // JWT metadata first (always available); override from DB when present.
    // Using only metadata while the parent page requires profiles.role caused a
    // loop: page → redirect /dashboard, middleware → redirect /parent-dashboard.
    const metaRole = String(typedUser.user_metadata?.role ?? "")
      .toLowerCase()
      .trim();
    let role:
      | "admin"
      | "parent"
      | "super_admin"
      | "teacher"
      | "capture_card_user" =
      metaRole === "admin"
        ? "admin"
        : metaRole === "teacher"
          ? "teacher"
          : metaRole === "capture_card_user"
            ? "capture_card_user"
            : "parent";

    if (
      isAuthPage ||
      isProtectedRoute ||
      isSchoolSuspendedPage ||
      isPaymentPage ||
      isCaptureCardRoute ||
      isPasswordSetupPage
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
          .eq("id", typedUser.id)
          .maybeSingle();

        const pr = (profileRow as {
          role:
            | "admin"
            | "parent"
            | "super_admin"
            | "teacher"
            | "finance"
            | "accounts"
            | "capture_card_user";
        } | null)?.role;
        if (pr === "finance" || pr === "accounts") {
          role = "admin";
        } else if (pr === "capture_card_user") {
          role = "capture_card_user";
        } else if (
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
      if (
        role !== "super_admin" &&
        role !== "teacher" &&
        role !== "capture_card_user"
      ) {
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
      } else if (role === "capture_card_user") {
        url.pathname = "/capture-card";
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
      } else if (role === "capture_card_user") {
        url.pathname = "/capture-card";
      } else {
        url.pathname = "/parent-dashboard";
      }
      return NextResponse.redirect(url);
    }

    // Capture-card users are now authenticated via cookie session (not Supabase Auth),
    // but keep legacy support if a Supabase capture_card_user exists.
    if (role === "capture_card_user") {
      if (isAdminRoute || isTeacherRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/capture-card";
        return NextResponse.redirect(url);
      }
    }

    if (role === "teacher" || role === "admin") {
      const { data: profPw } = await supabase
        .from("profiles")
        .select(
          "role, password_changed, password_forced_reset, teacher_temp_password_expires_at"
        )
        .eq("id", typedUser.id)
        .maybeSingle();
      const pw = profPw as {
        role?: string;
        password_changed?: boolean;
        password_forced_reset?: boolean;
        teacher_temp_password_expires_at?: string | null;
      } | null;

      const dbRole = (pw?.role ?? "").toLowerCase().trim();
      /** `role` can be "teacher" when a school admin is also in `is_teacher()`; trust `profiles.role` for password rules. */
      const isSchoolAdminInProfile = dbRole === "admin";
      const isTeacherInProfile =
        dbRole === "teacher" || (dbRole === "" && role === "teacher");

      if (isSchoolAdminInProfile) {
        // Never apply teacher temp-password or forced /change-password flows to school admins.
      } else if (isTeacherInProfile) {
        if (
          pw?.password_forced_reset === true &&
          pw.teacher_temp_password_expires_at &&
          new Date(pw.teacher_temp_password_expires_at).getTime() <= Date.now()
        ) {
          await supabase.auth.signOut();
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", TEACHER_TEMP_EXPIRED_ERROR);
          return NextResponse.redirect(url);
        }

        const mustChange =
          pw?.password_changed === false || pw?.password_forced_reset === true;
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
    }

    if (role === "parent") {
      const { data: prRec } = await supabase
        .from("profiles")
        .select(
          "recovery_reset_required, password_forced_reset, must_change_password"
        )
        .eq("id", typedUser.id)
        .maybeSingle();
      const r = prRec as {
        recovery_reset_required?: boolean;
        password_forced_reset?: boolean;
        must_change_password?: boolean;
      } | null;

      if (r?.must_change_password === true) {
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

      const needPasswordReset =
        r?.recovery_reset_required === true || r?.password_forced_reset === true;
      if (needPasswordReset) {
        const isResetPasswordPage = pathname.startsWith("/reset-password");
        const isAuthApi = pathname.startsWith("/api/auth");
        if (!isResetPasswordPage && !isAuthApi) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              {
                error:
                  "Set a new password in account recovery before continuing.",
              },
              { status: 403 }
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = "/reset-password";
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
      } else if (role === "capture_card_user") {
        url.pathname = "/capture-card";
      } else {
        url.pathname = "/parent-dashboard";
      }
      return NextResponse.redirect(url);
    }

    if (role === "capture_card_user") {
      if (
        !isCaptureCardRoute &&
        !isAuthCallback &&
        !pathname.startsWith("/api/")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/capture-card";
        return NextResponse.redirect(url);
      }
      if (!isCaptureCardRoute && pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    }

    if (
      role !== "capture_card_user" &&
      isCaptureCardRoute
    ) {
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
      if (role === "capture_card_user") {
        url.pathname = "/capture-card";
      } else if (role === "parent") {
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
      } else if (role === "capture_card_user") {
        url.pathname = "/capture-card";
      } else if (role === "admin") {
        url.pathname = "/dashboard";
      } else {
        url.pathname = "/parent-dashboard";
      }
      return NextResponse.redirect(url);
    }

    // Teachers with department roles may open student profile pages under
    // /dashboard/students/[studentId]/profile. The page itself enforces
    // authorization (teacher-for-class or teacher_department_roles).
    const isTeacherStudentProfileRoute =
      role === "teacher" &&
      /^\/dashboard\/students\/[^/]+\/profile(?:\/|$)/.test(pathname);

    // Teachers on duty (or head teacher) may open the duty book.
    let isTeacherDutyBookRoute = false;
    if (
      role === "teacher" &&
      (pathname === "/dashboard/duty-book" ||
        pathname.startsWith("/dashboard/duty-book/"))
    ) {
      const { data: schoolId } = await supabase.rpc("get_my_school_id", {} as never);
      if (schoolId) {
        const { data: canView } = await supabase.rpc("can_view_duty_book", {
          p_school_id: schoolId,
        } as never);
        isTeacherDutyBookRoute = canView === true;
      }
    }

    // Finance department teachers may open payment receipts (read-only).
    let isTeacherFinanceReceiptRoute = false;
    if (
      role === "teacher" &&
      /^\/dashboard\/receipts\/[^/]+(?:\/|$)/.test(pathname)
    ) {
      const { data: financeDeptRow, error: financeDeptErr } = await supabase
        .from("teacher_department_roles")
        .select("id")
        .eq("user_id", typedUser.id)
        .in("department", ["finance", "accounts"])
        .limit(1)
        .maybeSingle();
      isTeacherFinanceReceiptRoute =
        !financeDeptErr && financeDeptRow != null;
    }

    let isTeacherAllowedAdminRoute =
      isTeacherStudentProfileRoute ||
      isTeacherFinanceReceiptRoute ||
      isTeacherDutyBookRoute;

    if (
      !isTeacherAllowedAdminRoute &&
      isAdminRoute &&
      role === "teacher" &&
      request.cookies.get("school_dashboard_mode")?.value === "admin"
    ) {
      const { data: hasAdminMembership, error: dualErr } =
        await supabase.rpc("user_has_school_admin_membership", {} as never);
      if (!dualErr && hasAdminMembership === true) {
        isTeacherAllowedAdminRoute = true;
      }
    }

    // Enforce role-based access on protected routes.
    if (
      isAdminRoute &&
      role !== "admin" &&
      role !== "super_admin" &&
      role !== "capture_card_user" &&
      !isTeacherAllowedAdminRoute
    ) {
      if (debug) {
        console.info("[middleware] redirect away from admin route", {
          pathname,
          role,
          isTeacherStudentProfileRoute,
          isTeacherFinanceReceiptRoute,
          isTeacherDutyBookRoute,
          schoolDashboardMode:
            request.cookies.get("school_dashboard_mode")?.value ?? null,
        });
      }
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
      } else if (role === "capture_card_user") {
        url.pathname = "/capture-card";
      } else if (role === "teacher") {
        url.pathname = "/teacher-dashboard";
      } else {
        url.pathname = "/dashboard";
      }
      return NextResponse.redirect(url);
    }
  }

  // Capture-session users: block access outside capture-card.
  if (!typedUser && captureSession) {
    if (
      !isCaptureCardRoute &&
      !isEnrollmentDeskAccessRoute &&
      !isAuthCallback &&
      !pathname.startsWith("/api/")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/capture-card";
      return NextResponse.redirect(url);
    }
    if (!isCaptureCardRoute && pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  // IMPORTANT: Return the supabaseResponse object as-is. Creating a
  // new NextResponse and copying cookies loses session state.
  return supabaseResponse;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

const CAPTURE_SESSION_COOKIE = "cc_session";
const SCHOOL_DASHBOARD_MODE_COOKIE = "school_dashboard_mode";

function isSupabaseAuthCookieName(name: string): boolean {
  return (
    name.startsWith("sb-") ||
    name.includes("auth-token") ||
    name.includes("auth-code-verifier")
  );
}

function expiredCookieOptions() {
  return {
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };
}

/** Clear session cookies on the redirect response (reliable on Vercel vs Server Actions). */
function purgeSessionCookies(
  request: NextRequest,
  response: NextResponse
): void {
  for (const c of request.cookies.getAll()) {
    if (isSupabaseAuthCookieName(c.name)) {
      response.cookies.set(c.name, "", expiredCookieOptions());
    }
  }
  response.cookies.set(CAPTURE_SESSION_COOKIE, "", {
    ...expiredCookieOptions(),
    httpOnly: true,
  });
  response.cookies.set(
    SCHOOL_DASHBOARD_MODE_COOKIE,
    "",
    expiredCookieOptions()
  );
}

async function signOutAndRedirect(request: NextRequest): Promise<NextResponse> {
  const loginUrl = new URL("/login", request.url);
  let response = NextResponse.redirect(loginUrl);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[signOut/route] supabase global error", {
        message: error.message,
      });
    }
  } catch (err) {
    console.error("[signOut/route] supabase global threw", err);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: localErr } = await (supabase.auth.signOut as any)({
      scope: "local",
    });
    if (localErr) {
      console.error("[signOut/route] supabase local error", {
        message: localErr.message,
      });
    }
  } catch (err) {
    console.error("[signOut/route] supabase local threw", err);
  }

  purgeSessionCookies(request, response);
  return response;
}

export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}

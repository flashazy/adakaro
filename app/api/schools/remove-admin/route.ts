import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import type { Database } from "@/types/supabase";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isRlsOrPermissionError(err: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!err) return false;
  const code = String(err.code ?? "");
  const msg = String(err.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    code === "PGRST301" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("infinite recursion")
  );
}

export async function POST(request: NextRequest) {
  const supabaseCookieWrites: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseCookieWrites.push(...cookiesToSet);
        },
      },
    }
  );

  function jsonWithSessionCookies(body: object, status: number) {
    const res = NextResponse.json(body, { status });
    for (const { name, value, options } of supabaseCookieWrites) {
      res.cookies.set(name, value, options as never);
    }
    return res;
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonWithSessionCookies({ error: "Unauthorized." }, 401);
    }

    let body: { user_id?: string; userId?: string };
    try {
      body = (await request.json()) as { user_id?: string; userId?: string };
    } catch {
      return jsonWithSessionCookies({ error: "Invalid JSON body." }, 400);
    }

    const targetUserId = String(body.user_id ?? body.userId ?? "").trim();
    if (!targetUserId) {
      return jsonWithSessionCookies({ error: "user_id is required." }, 400);
    }

    const schoolId = await getSchoolIdForUser(supabase, user.id);
    if (!schoolId) {
      return jsonWithSessionCookies(
        { error: "No school found for your account." },
        400
      );
    }

    const { data: isAdmin, error: adminErr } = await supabase.rpc(
      "is_school_admin",
      { p_school_id: schoolId } as never
    );

    if (adminErr || !isAdmin) {
      return jsonWithSessionCookies(
        { error: "You must be a school admin." },
        403
      );
    }

    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("created_by")
      .eq("id", schoolId)
      .maybeSingle();

    let createdBy: string | null = null;
    if (!schoolErr && school) {
      createdBy = (school as { created_by: string }).created_by;
    }

    if (!createdBy) {
      try {
        const admin = createAdminClient();
        const { data: schoolRow, error: adminSchoolErr } = await admin
          .from("schools")
          .select("created_by")
          .eq("id", schoolId)
          .maybeSingle();
        if (!adminSchoolErr && schoolRow) {
          createdBy = (schoolRow as { created_by: string }).created_by;
        }
      } catch {
        /* service role missing */
      }
    }

    if (!createdBy) {
      console.error("[remove-admin] could not resolve created_by", {
        schoolId,
        schoolErr: schoolErr?.message,
      });
      return jsonWithSessionCookies({ error: "Could not load school." }, 500);
    }
    if (targetUserId === createdBy) {
      return jsonWithSessionCookies(
        { error: "The school creator cannot be removed from the team." },
        403
      );
    }

    const { data: deleted, error: delErr } = await supabase
      .from("school_members")
      .delete()
      .eq("school_id", schoolId)
      .eq("user_id", targetUserId)
      .eq("role", "admin")
      .select("user_id");

    const removed = (deleted?.length ?? 0) > 0;

    if (!delErr && removed) {
      return jsonWithSessionCookies({ ok: true }, 200);
    }

    const shouldFallback =
      isRlsOrPermissionError(delErr) || (!delErr && !removed);

    if (shouldFallback) {
      try {
        const admin = createAdminClient();
        const { data: adminDeleted, error: adminDelErr } = await admin
          .from("school_members")
          .delete()
          .eq("school_id", schoolId)
          .eq("user_id", targetUserId)
          .eq("role", "admin")
          .select("user_id");

        if (!adminDelErr && (adminDeleted?.length ?? 0) > 0) {
          return jsonWithSessionCookies({ ok: true }, 200);
        }

        if (adminDelErr) {
          console.error("[remove-admin] service-role delete failed", adminDelErr);
        }
      } catch (e) {
        console.error("[remove-admin] service-role path threw", e);
      }
    }

    if (delErr) {
      console.error("[remove-admin]", delErr);
      return jsonWithSessionCookies(
        { error: delErr.message || "Could not remove member." },
        500
      );
    }

    return jsonWithSessionCookies(
      {
        error:
          "Could not remove that admin. They may have already left or you may lack permission.",
      },
      500
    );
  } catch (e) {
    console.error("[remove-admin]", e);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

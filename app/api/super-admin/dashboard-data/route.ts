import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  loadSuperAdminDashboardData,
  loadSuperAdminDashboardWithServiceRole,
} from "@/lib/super-admin/load-dashboard-data";
import { normalizeServiceRoleKey } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Super-admin dashboard payload. Uses service role reads when
 * SUPABASE_SERVICE_ROLE_KEY is set (after session + super_admin check).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const hasServiceKey = Boolean(
    normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  if (process.env.NODE_ENV === "development") {
    let supabaseHost = "missing";
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (rawUrl) {
      try {
        supabaseHost = new URL(rawUrl).host;
      } catch {
        supabaseHost = "invalid NEXT_PUBLIC_SUPABASE_URL";
      }
    }
    console.info("[api/super-admin/dashboard-data]", {
      hasServiceKey,
      supabaseUrlHost: supabaseHost,
    });
  }

  if (hasServiceKey) {
    const sr = await loadSuperAdminDashboardWithServiceRole();
    if (sr.ok) {
      return NextResponse.json({
        stats: sr.stats,
        schools: sr.schools,
      });
    }
    console.error("[api/super-admin/dashboard-data] service role load:", sr.message);
    const rpcFallback = await loadSuperAdminDashboardData(supabase, {
      skipServiceRole: true,
    });
    if (rpcFallback.ok) {
      return NextResponse.json({
        stats: rpcFallback.stats,
        schools: rpcFallback.schools,
      });
    }
    return NextResponse.json(
      { error: `${sr.message} | RPC fallback: ${rpcFallback.message}` },
      { status: 500 }
    );
  }

  const loaded = await loadSuperAdminDashboardData(supabase);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: 500 });
  }

  return NextResponse.json({
    stats: loaded.stats,
    schools: loaded.schools,
  });
}

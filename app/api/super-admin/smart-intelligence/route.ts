import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { fetchSuperAdminDashboardFromApi } from "@/lib/super-admin/fetch-dashboard-api";
import { loadSuperAdminDashboardData } from "@/lib/super-admin/load-dashboard-data";
import { loadSmartIntelligence } from "@/lib/super-admin/load-smart-intelligence";

export const dynamic = "force-dynamic";

/**
 * Smart Intelligence payload for the super-admin dashboard.
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

  let schools;
  const fromApi = await fetchSuperAdminDashboardFromApi();
  if (fromApi.ok) {
    schools = fromApi.schools;
  } else {
    const loaded = await loadSuperAdminDashboardData(supabase);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.message }, { status: 500 });
    }
    schools = loaded.schools;
  }

  const intelligence = await loadSmartIntelligence(schools);
  if (!intelligence.ok) {
    return NextResponse.json({ error: intelligence.message }, { status: 500 });
  }

  return NextResponse.json(intelligence.data);
}

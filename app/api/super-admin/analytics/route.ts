import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  loadSuperAdminAnalytics,
  parseAnalyticsSearchParams,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[api/super-admin/analytics] admin client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const { fromIso, toIso, preset } = parseAnalyticsSearchParams(
    request.nextUrl.searchParams
  );

  const result = await loadSuperAdminAnalytics(admin, {
    fromIso,
    toIso,
    preset,
  });
  if (!result.ok) {
    console.error("[api/super-admin/analytics]", result.message);
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}

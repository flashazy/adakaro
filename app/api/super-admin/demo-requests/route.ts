import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  computeDemoRequestStats,
  computeExecutiveInsights,
  computePipelineStats,
  computeDailyActivity,
  computeConversionAnalytics,
  DEMO_REQUEST_SELECT_COLS,
  DEMO_REQUEST_STATUSES,
  type DemoRequestRow,
  type TimelineEventLite,
} from "@/lib/demo-requests/types";

export const dynamic = "force-dynamic";

function matchesSearch(row: DemoRequestRow, q: string): boolean {
  const needle = q.toLowerCase();
  const haystack = [
    row.school_name,
    row.full_name,
    row.phone,
    row.email ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

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

  let db = supabase;
  let rows: DemoRequestRow[] = [];

  const first = await supabase
    .from("demo_requests")
    .select(DEMO_REQUEST_SELECT_COLS)
    .order("created_at", { ascending: false });

  if (first.error) {
    try {
      db = createAdminClient();
      const second = await db
        .from("demo_requests")
        .select(DEMO_REQUEST_SELECT_COLS)
        .order("created_at", { ascending: false });
      if (second.error) {
        console.error("[demo-requests] load:", second.error);
        return NextResponse.json(
          { error: "Could not load demo requests." },
          { status: 500 }
        );
      }
      rows = (second.data ?? []) as DemoRequestRow[];
    } catch (e) {
      console.error("[demo-requests] admin client:", e);
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }
  } else {
    rows = (first.data ?? []) as DemoRequestRow[];
  }

  const url = request.nextUrl;
  const status = url.searchParams.get("status")?.trim() ?? "";
  const schoolType = url.searchParams.get("schoolType")?.trim() ?? "";
  const search = url.searchParams.get("search")?.trim() ?? "";

  let filtered = rows;
  if (status && DEMO_REQUEST_STATUSES.includes(status as DemoRequestRow["status"])) {
    filtered = filtered.filter((row) => row.status === status);
  }
  if (schoolType) {
    filtered = filtered.filter((row) => row.school_type === schoolType);
  }
  if (search) {
    filtered = filtered.filter((row) => matchesSearch(row, search));
  }

  const { data: timelineData } = await db
    .from("demo_request_timeline_events")
    .select("event_type, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  const timelineEvents = (timelineData ?? []) as TimelineEventLite[];

  return NextResponse.json({
    rows: filtered,
    allRows: rows,
    stats: computeDemoRequestStats(rows),
    pipelineStats: computePipelineStats(rows),
    insights: computeExecutiveInsights(rows),
    dailyActivity: computeDailyActivity(rows, timelineEvents),
    conversionAnalytics: computeConversionAnalytics(rows),
  });
}

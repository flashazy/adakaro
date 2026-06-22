import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { loadDemoRequestRows } from "@/lib/demo-requests/load-demo-request-rows";
import {
  computeDemoRequestStats,
  computeExecutiveInsights,
  computePipelineStats,
  computeDailyActivity,
  computeConversionAnalytics,
  DEMO_REQUEST_STATUSES,
  DEMO_REQUEST_LEAD_SOURCES,
  DEMO_REQUEST_REQUEST_TYPES,
  type DemoRequestLeadSource,
  type DemoRequestRequestType,
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

  const { rows, error: loadError } = await loadDemoRequestRows(supabase);
  if (loadError) {
    return NextResponse.json({ error: loadError }, { status: 500 });
  }

  const db = supabase;

  const url = request.nextUrl;
  const status = url.searchParams.get("status")?.trim() ?? "";
  const schoolType = url.searchParams.get("schoolType")?.trim() ?? "";
  const source = url.searchParams.get("source")?.trim() ?? "";
  const requestType = url.searchParams.get("requestType")?.trim() ?? "";
  const search = url.searchParams.get("search")?.trim() ?? "";

  let filtered = rows;
  if (status && DEMO_REQUEST_STATUSES.includes(status as DemoRequestRow["status"])) {
    filtered = filtered.filter((row) => row.status === status);
  }
  if (schoolType) {
    filtered = filtered.filter((row) => row.school_type === schoolType);
  }
  if (
    source &&
    DEMO_REQUEST_LEAD_SOURCES.includes(source as DemoRequestLeadSource)
  ) {
    filtered = filtered.filter((row) => row.source === source);
  }
  if (
    requestType &&
    DEMO_REQUEST_REQUEST_TYPES.includes(requestType as DemoRequestRequestType)
  ) {
    filtered = filtered.filter((row) => row.request_type === requestType);
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

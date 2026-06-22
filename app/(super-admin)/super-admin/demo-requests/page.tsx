import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/types/supabase";
import { loadDemoRequestRows } from "@/lib/demo-requests/load-demo-request-rows";
import {
  computeDemoRequestStats,
  computeExecutiveInsights,
  computePipelineStats,
  computeDailyActivity,
  computeConversionAnalytics,
  type DemoRequestRow,
  type TimelineEventLite,
} from "@/lib/demo-requests/types";
import { DemoRequestsClient } from "./demo-requests-client";

export const dynamic = "force-dynamic";

async function loadDemoRequests(
  userClient: SupabaseClient<Database>
): Promise<DemoRequestRow[]> {
  const { rows } = await loadDemoRequestRows(userClient);
  return rows;
}

async function loadTimelineEventsForAnalytics(
  userClient: SupabaseClient<Database>
): Promise<TimelineEventLite[]> {
  const first = await userClient
    .from("demo_request_timeline_events")
    .select("event_type, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!first.error && first.data) {
    return first.data as TimelineEventLite[];
  }

  try {
    const admin = createAdminClient();
    const second = await admin
      .from("demo_request_timeline_events")
      .select("event_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!second.error && second.data) {
      return second.data as TimelineEventLite[];
    }
  } catch {
    /* service role unavailable */
  }

  return [];
}

export default async function DemoRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  const rows = await loadDemoRequests(supabase);
  const timelineEvents = await loadTimelineEventsForAnalytics(supabase);

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-500 sm:px-6 lg:px-8">
          Loading demo requests…
        </div>
      }
    >
      <DemoRequestsClient
        initialRows={rows}
        initialStats={computeDemoRequestStats(rows)}
        initialPipelineStats={computePipelineStats(rows)}
        initialInsights={computeExecutiveInsights(rows)}
        initialDailyActivity={computeDailyActivity(rows, timelineEvents)}
        initialConversionAnalytics={computeConversionAnalytics(rows)}
      />
    </Suspense>
  );
}

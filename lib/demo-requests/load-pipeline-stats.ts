import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computePipelineStats,
  DEMO_REQUEST_SELECT_COLS,
  type DemoLeadPipelineStats,
  type DemoRequestRow,
} from "@/lib/demo-requests/types";
import type { Database } from "@/types/supabase";

export async function loadDemoLeadPipelineStats(
  userClient: SupabaseClient<Database>
): Promise<DemoLeadPipelineStats> {
  const first = await userClient
    .from("demo_requests")
    .select(DEMO_REQUEST_SELECT_COLS)
    .order("created_at", { ascending: false });

  if (!first.error && first.data) {
    return computePipelineStats(first.data as DemoRequestRow[]);
  }

  try {
    const admin = createAdminClient();
    const second = await admin
      .from("demo_requests")
      .select(DEMO_REQUEST_SELECT_COLS)
      .order("created_at", { ascending: false });
    if (!second.error && second.data) {
      return computePipelineStats(second.data as DemoRequestRow[]);
    }
  } catch {
    /* service role unavailable */
  }

  return computePipelineStats([]);
}

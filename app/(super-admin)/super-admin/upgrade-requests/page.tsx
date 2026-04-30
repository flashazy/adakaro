import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/types/supabase";
import { UpgradeRequestsClient, type UpgradeRequestRow } from "./upgrade-requests-client";

export const dynamic = "force-dynamic";

type RawRequest = {
  id: string;
  school_id: string;
  requested_by: string;
  current_plan: string;
  requested_plan: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

async function loadAllUpgradeRequests(
  userClient: SupabaseClient<Database>
): Promise<UpgradeRequestRow[]> {
  const sel =
    "id, school_id, requested_by, current_plan, requested_plan, status, created_at, updated_at";

  let db: SupabaseClient<Database> = userClient;
  let rows: RawRequest[] = [];

  // Try the user-scoped client first; fall back to service role if RLS hides
  // any rows (super-admin RLS policies usually pass, but if `is_super_admin`
  // RPC fails for any reason the service role still returns the data).
  const first = await userClient
    .from("upgrade_requests")
    .select(sel)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (first.error) {
    try {
      db = createAdminClient();
      const second = await db
        .from("upgrade_requests")
        .select(sel)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (!second.error && second.data) {
        rows = second.data as RawRequest[];
      }
    } catch {
      return [];
    }
  } else {
    rows = (first.data ?? []) as RawRequest[];
  }

  if (rows.length === 0) return [];

  const schoolIds = [...new Set(rows.map((r) => r.school_id))];
  const profileIds = [...new Set(rows.map((r) => r.requested_by))];

  let enrichClient: SupabaseClient<Database> = db;
  try {
    enrichClient = createAdminClient();
  } catch {
    /* keep db */
  }

  const [schRes, profRes, countRes] = await Promise.all([
    enrichClient.from("schools").select("id, name, plan").in("id", schoolIds),
    enrichClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds),
    Promise.all(
      schoolIds.map(async (sid) => {
        const { count } = await enrichClient
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("school_id", sid);
        return [sid, count ?? 0] as const;
      })
    ),
  ]);

  const schools = new Map(
    ((schRes.data ?? []) as { id: string; name: string; plan: string }[]).map(
      (s) => [s.id, { name: s.name?.trim() || "", plan: s.plan }]
    )
  );
  const profiles = new Map(
    ((profRes.data ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
    }[]).map((p) => {
      const label = p.full_name?.trim() || p.email?.trim() || "";
      return [p.id, label];
    })
  );
  const studentCounts = new Map(countRes);

  return rows.map((r) => {
    const sch = schools.get(r.school_id);
    const requesterLabel = profiles.get(r.requested_by);
    return {
      id: r.id,
      schoolId: r.school_id,
      schoolName:
        sch?.name && sch.name.length > 0
          ? sch.name
          : `School (${r.school_id.slice(0, 8)}…)`,
      currentPlan: sch?.plan ?? r.current_plan,
      requestedPlan: r.requested_plan,
      status: r.status,
      requesterDisplay:
        requesterLabel && requesterLabel.length > 0
          ? requesterLabel
          : `User ${r.requested_by.slice(0, 8)}…`,
      studentCount: studentCounts.get(r.school_id) ?? 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } satisfies UpgradeRequestRow;
  });
}

export default async function SuperAdminUpgradeRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsSuperAdmin(supabase, user.id))) redirect("/dashboard");

  const rows = await loadAllUpgradeRequests(supabase);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Upgrade Requests
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Schools that hit the free-tier student cap can request an upgrade.
            Approve to lift the dashboard block; reject to keep them on the free
            plan.
          </p>
        </header>

        <UpgradeRequestsClient initialRows={rows} />
      </div>
    </div>
  );
}

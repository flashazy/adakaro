import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { fetchSuperAdminDashboardFromApi } from "@/lib/super-admin/fetch-dashboard-api";
import { loadSuperAdminDashboardData } from "@/lib/super-admin/load-dashboard-data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import {
  SuperAdminDashboardClient,
  type PendingUpgradeRow,
} from "./super-admin-dashboard-client";

export const dynamic = "force-dynamic";

async function loadPendingUpgradeRows(
  userClient: SupabaseClient<Database>
): Promise<PendingUpgradeRow[]> {
  type Row = {
    id: string;
    school_id: string;
    requested_by: string;
    current_plan: string;
    requested_plan: string;
    created_at: string;
  };

  const sel =
    "id, school_id, requested_by, current_plan, requested_plan, created_at";

  let db: SupabaseClient<Database> = userClient;
  let rows: Row[] = [];

  const first = await userClient
    .from("upgrade_requests")
    .select(sel)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (first.error) {
    try {
      db = createAdminClient();
      const second = await db
        .from("upgrade_requests")
        .select(sel)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!second.error && second.data) {
        rows = second.data as Row[];
      }
    } catch {
      return [];
    }
  } else {
    rows = (first.data ?? []) as Row[];
  }

  if (rows.length === 0) {
    return [];
  }

  const schoolIds = [...new Set(rows.map((r) => r.school_id))];
  const profileIds = [...new Set(rows.map((r) => r.requested_by))];

  // Names must not rely on the user JWT: RLS often hides schools/profiles rows even for super admins.
  let enrichClient: SupabaseClient<Database> = db;
  try {
    enrichClient = createAdminClient();
  } catch {
    /* no service role — keep db; names may stay generic */
  }

  const [schRes, profRes] = await Promise.all([
    enrichClient.from("schools").select("id, name").in("id", schoolIds),
    enrichClient.from("profiles").select("id, full_name, email").in("id", profileIds),
  ]);

  const schoolNames = new Map(
    ((schRes.data ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name?.trim() || "",
    ])
  );
  const profileLabels = new Map(
    ((profRes.data ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
    }[]).map((p) => {
      const label =
        p.full_name?.trim() || p.email?.trim() || "";
      return [p.id, label];
    })
  );

  return rows.map((r) => {
    const schoolName = schoolNames.get(r.school_id);
    const requesterLabel = profileLabels.get(r.requested_by);
    return {
      id: r.id,
      school_id: r.school_id,
      school_name:
        schoolName && schoolName.length > 0
          ? schoolName
          : `School (${r.school_id.slice(0, 8)}…)`,
      requester_display:
        requesterLabel && requesterLabel.length > 0
          ? requesterLabel
          : `User ${r.requested_by.slice(0, 8)}…`,
      current_plan: r.current_plan,
      requested_plan: r.requested_plan,
      created_at: r.created_at,
    };
  });
}

export default async function SuperAdminHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Same check as layout + is_super_admin() RPC (do not use profiles.single() — it errors when RLS returns 0 rows).
  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  let loaded = await fetchSuperAdminDashboardFromApi();
  if (!loaded.ok) {
    loaded = await loadSuperAdminDashboardData(supabase);
  }

  if (!loaded.ok) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Could not load super admin data
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
          {loaded.message}
        </p>
        <ul className="mt-4 list-inside list-disc text-sm text-slate-600 dark:text-zinc-400">
          <li>Apply migrations 00028 and 00032; set SUPABASE_SERVICE_ROLE_KEY if needed.</li>
          <li>
            Optional: <code className="rounded bg-slate-200 px-1 dark:bg-zinc-800">NEXT_PUBLIC_APP_URL</code>{" "}
            for local API fetch.
          </li>
        </ul>
      </div>
    );
  }

  const dashboardData = {
    stats: {
      schools: loaded.stats.totalSchools,
      students: loaded.stats.totalStudents,
      admins: loaded.stats.totalAdmins,
      payments: loaded.stats.totalPayments,
    },
    schools: loaded.schools.map((s) => ({
      id: s.id,
      name: s.name,
      currency: s.currency,
      plan: s.plan,
      created_at: s.created_at,
      admin_count: s.admin_count,
      student_count: s.student_count,
    })),
  };

  let initialPendingUpgrades = await loadPendingUpgradeRows(supabase);

  // If enrichment could not resolve a name, reuse the school list already loaded for the dashboard (service role).
  initialPendingUpgrades = initialPendingUpgrades.map((row) => {
    const looksLikePlaceholder =
      row.school_name.startsWith("School (") && row.school_name.endsWith("…)");
    if (looksLikePlaceholder) {
      const fromList = dashboardData.schools.find((s) => s.id === row.school_id);
      if (fromList?.name?.trim()) {
        return { ...row, school_name: fromList.name.trim() };
      }
    }
    return row;
  });

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 dark:bg-zinc-950">
      <SuperAdminDashboardClient
        initialData={dashboardData}
        initialPendingUpgrades={initialPendingUpgrades}
      />
    </div>
  );
}

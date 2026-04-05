import { redirect } from "next/navigation";
import Link from "next/link";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { createClient } from "@/lib/supabase/server";
import { parseSchoolDashboardRpc } from "@/lib/dashboard/parse-school-dashboard-rpc";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import {
  createAdminClient,
  normalizeServiceRoleKey,
} from "@/lib/supabase/admin";
import { formatShortLocaleDate } from "@/lib/format-date";
import { normalizePlanId, planDisplayName } from "@/lib/plans";
import { effectiveAdminLimit } from "@/lib/plan-limits";
import { TeamPageClient, type TeamMemberRow } from "./team-page-client";

export const dynamic = "force-dynamic";

interface SchoolTeamRow {
  id: string;
  name: string;
  plan: string;
  created_by: string;
}

/**
 * Load schools row for team UI. Prefer user-scoped SELECT (RLS); if missing or
 * `.single()`-style failures, mirror dashboard: service role read, then RPC.
 */
async function fetchSchoolRowForTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string
): Promise<SchoolTeamRow | null> {
  const normalize = (r: {
    id: string;
    name: string | null;
    plan: string | null;
    created_by: string | null;
  } | null): SchoolTeamRow | null => {
    if (!r?.id) return null;
    return {
      id: r.id,
      name: r.name?.trim() || "Your school",
      plan: r.plan ?? "free",
      created_by: r.created_by ?? "",
    };
  };

  const { data: userRow } = await supabase
    .from("schools")
    .select("id, name, plan, created_by")
    .eq("id", schoolId)
    .maybeSingle();

  let row = normalize(
    userRow as {
      id: string;
      name: string | null;
      plan: string | null;
      created_by: string | null;
    } | null
  );

  if (row && row.created_by.length > 0) {
    return row;
  }

  if (normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    try {
      const admin = createAdminClient();
      const { data: adminRow } = await admin
        .from("schools")
        .select("id, name, plan, created_by")
        .eq("id", schoolId)
        .maybeSingle();
      const fromAdmin = normalize(
        adminRow as {
          id: string;
          name: string | null;
          plan: string | null;
          created_by: string | null;
        } | null
      );
      if (fromAdmin) {
        return fromAdmin;
      }
    } catch {
      /* ignore */
    }
  }

  if (row) {
    return row;
  }

  const { data: rpcRaw, error: rpcErr } = await supabase.rpc(
    "get_my_school_for_dashboard",
    {} as never
  );
  if (!rpcErr) {
    const parsed = parseSchoolDashboardRpc(rpcRaw as unknown);
    if (parsed?.school_id === schoolId) {
      return {
        id: schoolId,
        name: parsed.name.trim() || "Your school",
        plan: "free",
        created_by: "",
      };
    }
  }

  return null;
}

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolved = await resolveSchoolDisplay(user.id, supabase);
  if (!resolved?.schoolId) redirect("/dashboard");

  const schoolId = resolved.schoolId;

  const { data: isAdmin } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );

  if (!isAdmin) redirect("/dashboard");

  let schoolRow = await fetchSchoolRowForTeam(supabase, schoolId);
  if (!schoolRow) {
    let fallbackPlan = "free";
    let fallbackCreatedBy = "";
    if (normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      try {
        const admin = createAdminClient();
        const { data: s } = await admin
          .from("schools")
          .select("plan, created_by")
          .eq("id", schoolId)
          .maybeSingle();
        if (s) {
          fallbackPlan = (s as { plan: string | null }).plan ?? "free";
          fallbackCreatedBy =
            (s as { created_by: string | null }).created_by ?? "";
        }
      } catch {
        /* ignore */
      }
    }
    schoolRow = {
      id: schoolId,
      name: resolved.name?.trim() || "Your school",
      plan: fallbackPlan,
      created_by: fallbackCreatedBy,
    };
  }

  const plan = normalizePlanId(schoolRow.plan);

  const { data: limitRow } = await supabase
    .from("schools")
    .select("student_limit, admin_limit")
    .eq("id", schoolId)
    .maybeSingle();

  const lr = limitRow as {
    student_limit: number | null;
    admin_limit: number | null;
  } | null;

  const maxAdmins = effectiveAdminLimit({
    plan: schoolRow.plan,
    student_limit: lr?.student_limit ?? null,
    admin_limit: lr?.admin_limit ?? null,
  });

  type MemberDbRow = {
    id: string;
    user_id: string;
    role: string;
    created_at: string;
  };

  let membersRaw: MemberDbRow[] = [];
  const userMemRes = await supabase
    .from("school_members")
    .select("id, user_id, role, created_at")
    .eq("school_id", schoolId)
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  membersRaw = (userMemRes.data ?? []) as MemberDbRow[];
  let membersLoadError = userMemRes.error;

  if (
    membersLoadError &&
    normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    try {
      const admin = createAdminClient();
      const adminMem = await admin
        .from("school_members")
        .select("id, user_id, role, created_at")
        .eq("school_id", schoolId)
        .eq("role", "admin")
        .order("created_at", { ascending: true });
      if (!adminMem.error && adminMem.data) {
        membersRaw = adminMem.data as MemberDbRow[];
        membersLoadError = null;
      }
    } catch {
      /* keep membersLoadError */
    }
  }

  if (membersLoadError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Could not load team members.
      </p>
    );
  }

  const userIds = membersRaw.map((m) => m.user_id);

  let profileRows: { id: string; full_name: string; email: string | null }[] =
    [];
  if (userIds.length > 0) {
    const pr = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    profileRows =
      (pr.data ?? []) as { id: string; full_name: string; email: string | null }[];

    const profilesIncomplete =
      !pr.error && profileRows.length < userIds.length;
    if (
      (pr.error || profilesIncomplete) &&
      normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
    ) {
      try {
        const admin = createAdminClient();
        const ar = await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        if (!ar.error && ar.data?.length) {
          profileRows = ar.data as {
            id: string;
            full_name: string;
            email: string | null;
          }[];
        }
      } catch {
        /* keep profileRows from user client */
      }
    }
  }

  const profilesById = new Map(profileRows.map((p) => [p.id, p]));

  const members: TeamMemberRow[] = membersRaw.map((m) => {
    const p = profilesById.get(m.user_id);
    return {
      membershipId: m.id,
      userId: m.user_id,
      fullName: p?.full_name ?? "Unknown",
      email: p?.email ?? null,
      joinedAt: m.created_at,
      joinedAtLabel: formatShortLocaleDate(m.created_at),
      isCreator: m.user_id === schoolRow.created_by,
    };
  });

  const adminCount = members.length;

  const invRes = await supabase
    .from("school_invitations")
    .select("id, invited_email, expires_at", { count: "exact" })
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  let pendingRows = invRes.data;
  let pendingCount = invRes.count;

  if (
    invRes.error &&
    normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    try {
      const admin = createAdminClient();
      const adminInv = await admin
        .from("school_invitations")
        .select("id, invited_email, expires_at", { count: "exact" })
        .eq("school_id", schoolId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (!adminInv.error) {
        pendingRows = adminInv.data;
        pendingCount = adminInv.count;
      }
    } catch {
      /* keep invRes */
    }
  }

  const pendingInvites =
    (pendingRows ?? []) as {
      id: string;
      invited_email: string;
      expires_at: string;
    }[];

  const pendingInviteCount = pendingCount ?? pendingInvites.length;
  const usedSlots = adminCount + pendingInviteCount;
  const canInvite =
    maxAdmins == null ? true : usedSlots < maxAdmins;

  const pendingInvitesForClient = pendingInvites.map((r) => ({
    id: r.id,
    invited_email: r.invited_email,
    expires_at: r.expires_at,
    expiresAtLabel: formatShortLocaleDate(r.expires_at),
  }));

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Team Members
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Manage administrators who can access this school
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 py-8">
        <TeamPageClient
          members={members}
          planLabel={planDisplayName(plan)}
          adminCount={adminCount}
          maxAdmins={maxAdmins}
          pendingInviteCount={pendingInviteCount}
          usedSlots={usedSlots}
          canInvite={canInvite}
          pendingInvites={pendingInvitesForClient}
          showUpgradeLink={!canInvite}
        />
      </main>
      <SmartFloatingScrollButton sectionIds={[]} />
    </>
  );
}

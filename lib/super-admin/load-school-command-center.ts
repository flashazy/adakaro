import type { createAdminClient } from "@/lib/supabase/admin";
import {
  enrichSchoolLifecycle,
  loadSchoolLifecycleMetrics,
  mergeLifecycleCountFallbacks,
  type SchoolLifecycleMetrics,
} from "@/lib/super-admin/load-school-lifecycle-metrics";
import {
  assembleCommandCenterPayload,
  type SchoolCommandCenterPayload,
  type SchoolCommunicationSummary,
  type SchoolStudentOverview,
} from "@/lib/super-admin/school-command-center";
import { normalizeSchoolLifecycleStatus } from "@/lib/super-admin/school-lifecycle";

type AdminClient = ReturnType<typeof createAdminClient>;

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

async function loadStudentOverview(
  admin: AdminClient,
  schoolId: string
): Promise<SchoolStudentOverview> {
  const monthStart = monthStartIso();

  const [totalRes, activeRes, newRes, lastRes] = await Promise.all([
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("created_at", monthStart),
    admin
      .from("students")
      .select("created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    newThisMonth: newRes.count ?? 0,
    lastAddedAt: (lastRes.data as { created_at: string } | null)?.created_at ?? null,
  };
}

async function loadRevenueTotal(
  admin: AdminClient,
  schoolId: string
): Promise<number> {
  const { data: students } = await admin
    .from("students")
    .select("id")
    .eq("school_id", schoolId);

  const studentIds = (students ?? []).map((s) => (s as { id: string }).id);
  if (studentIds.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < studentIds.length; i += 200) {
    const chunk = studentIds.slice(i, i + 200);
    const { data, error } = await admin
      .from("payments")
      .select("amount")
      .in("student_id", chunk);
    if (error) {
      console.warn("[school-command-center] payments:", error.message);
      continue;
    }
    for (const row of data ?? []) {
      total += Number((row as { amount: number }).amount ?? 0);
    }
  }
  return total;
}

async function loadCommunicationSummary(
  admin: AdminClient,
  schoolId: string,
  adminUserIds: string[],
  lastAdminLoginAt: string | null
): Promise<SchoolCommunicationSummary> {
  const { data: broadcasts } = await admin
    .from("broadcasts")
    .select("id, sent_at, title, source, target_school_id")
    .or(`target_school_id.eq.${schoolId},source.eq.intelligence`)
    .order("sent_at", { ascending: false })
    .limit(50);

  const schoolBroadcasts = (broadcasts ?? []).filter((row) => {
    const r = row as {
      target_school_id: string | null;
      source: string | null;
    };
    return r.target_school_id === schoolId || r.source === "intelligence";
  });

  const followUp = schoolBroadcasts.find((b) => {
    const title = (b as { title: string }).title?.toLowerCase() ?? "";
    return title.includes("follow");
  });

  const lastBroadcast = schoolBroadcasts[0] as { sent_at: string } | undefined;
  const broadcastIds = schoolBroadcasts.map((b) => (b as { id: string }).id);

  let responsesReceived = 0;
  if (broadcastIds.length > 0 && adminUserIds.length > 0) {
    const { count } = await admin
      .from("broadcast_reads")
      .select("id", { count: "exact", head: true })
      .in("broadcast_id", broadcastIds)
      .in("user_id", adminUserIds);
    responsesReceived = count ?? 0;
  }

  const unreadMessages = Math.max(
    0,
    schoolBroadcasts.length * Math.max(adminUserIds.length, 1) - responsesReceived
  );

  return {
    lastFollowUpAt: followUp
      ? (followUp as { sent_at: string }).sent_at
      : null,
    lastContactAttemptAt: lastBroadcast?.sent_at ?? null,
    lastAdminLoginAt,
    broadcastsSent: schoolBroadcasts.length,
    responsesReceived,
    unreadMessages,
  };
}

export async function loadSchoolCommandCenter(
  admin: AdminClient,
  school: {
    id: string;
    name: string;
    plan: string;
    currency: string;
    created_at: string;
    school_status?: string | null;
    last_activity_at?: string | null;
    updated_at?: string | null;
  },
  fallbacks: { adminCount: number; studentCount: number }
): Promise<SchoolCommandCenterPayload> {
  const schoolId = school.id;

  const metricsMap = await loadSchoolLifecycleMetrics(admin, [schoolId]);
  const rawMetrics = metricsMap.get(schoolId) ?? emptyMetricsFallback();
  const metrics = mergeLifecycleCountFallbacks(rawMetrics, {
    adminCount: fallbacks.adminCount,
    studentCount: fallbacks.studentCount,
  });

  const schoolStatus = normalizeSchoolLifecycleStatus(
    school.school_status ?? "setup"
  );

  const lifecycle = enrichSchoolLifecycle(
    schoolStatus,
    school.last_activity_at ?? null,
    metrics,
    {
      createdAt: school.created_at,
      updatedAt: school.updated_at ?? null,
    }
  );

  const [studentOverview, revenueTotal, parentCountRes, invitationRes] =
    await Promise.all([
      loadStudentOverview(admin, schoolId),
      loadRevenueTotal(admin, schoolId),
      admin
        .from("school_members")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("role", "parent"),
      admin
        .from("school_invitations")
        .select("created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const { data: adminMembers } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "admin");

  const adminUserIds = (adminMembers ?? []).map(
    (r) => (r as { user_id: string }).user_id
  );

  const communication = await loadCommunicationSummary(
    admin,
    schoolId,
    adminUserIds,
    metrics.lastLoginAt
  );

  return assembleCommandCenterPayload({
    schoolStatus: lifecycle.schoolStatus,
    health: lifecycle.health,
    metrics,
    parentCount: parentCountRes.count ?? 0,
    revenueTotal,
    currency: school.currency,
    createdAt: school.created_at,
    firstInvitationAt:
      (invitationRes.data as { created_at: string } | null)?.created_at ?? null,
    studentOverview,
    communication,
    hasProfile: Boolean(school.name?.trim() && school.currency?.trim()),
  });
}

function emptyMetricsFallback(): SchoolLifecycleMetrics {
  return {
    studentCount: 0,
    teacherCount: 0,
    adminCount: 0,
    paymentCount: 0,
    feeStructureCount: 0,
    reportCardCount: 0,
    syllabusActivityCount: 0,
    attendanceCount: 0,
    lastLoginAt: null,
    lastStudentAt: null,
    lastPaymentAt: null,
    lastSyllabusAt: null,
    lastReportAt: null,
    lastFeeAt: null,
    lastMemberAt: null,
    lastTeacherAt: null,
    lastAttendanceAt: null,
    lastActivityAt: null,
  };
}

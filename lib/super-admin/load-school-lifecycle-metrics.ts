import type { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import {
  computeSchoolHealthScore,
  daysSinceIso,
  type SchoolHealthResult,
} from "@/lib/super-admin/school-health";
import {
  deriveAutomaticSchoolStatus,
  evaluateSchoolDeleteEligibility,
  hasOperationalSchoolData,
  isRecentActivity,
  normalizeSchoolLifecycleStatus,
  type SchoolDeleteEligibility,
  type SchoolLifecycleStatus,
} from "@/lib/super-admin/school-lifecycle";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface SchoolLifecycleMetrics {
  studentCount: number;
  teacherCount: number;
  adminCount: number;
  paymentCount: number;
  feeStructureCount: number;
  reportCardCount: number;
  syllabusActivityCount: number;
  attendanceCount: number;
  lastLoginAt: string | null;
  lastStudentAt: string | null;
  lastPaymentAt: string | null;
  lastSyllabusAt: string | null;
  lastReportAt: string | null;
  lastFeeAt: string | null;
  lastMemberAt: string | null;
  lastTeacherAt: string | null;
  lastAttendanceAt: string | null;
  lastActivityAt: string | null;
}

export interface EnrichedSchoolLifecycle {
  schoolStatus: SchoolLifecycleStatus;
  lastActivityAt: string | null;
  health: SchoolHealthResult;
  deleteEligibility: SchoolDeleteEligibility;
  daysSinceLastActivity: number | null;
  daysSinceLastLogin: number | null;
}

function emptyMetrics(): SchoolLifecycleMetrics {
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

export function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/** Derive last activity from loaded metrics when DB column is missing or stale. */
export function computeDerivedLastActivity(
  metrics: SchoolLifecycleMetrics,
  extras?: { schoolUpdatedAt?: string | null; schoolCreatedAt?: string | null }
): string | null {
  return maxIso(
    metrics.lastStudentAt,
    maxIso(
      metrics.lastPaymentAt,
      maxIso(
        metrics.lastSyllabusAt,
        maxIso(
          metrics.lastReportAt,
          maxIso(
            metrics.lastFeeAt,
            maxIso(
              metrics.lastMemberAt,
              maxIso(
              metrics.lastTeacherAt,
              maxIso(
                metrics.lastAttendanceAt,
                maxIso(
                  metrics.lastLoginAt,
                  maxIso(
                    extras?.schoolUpdatedAt ?? null,
                    extras?.schoolCreatedAt ?? null
                  )
                )
              )
              )
            )
          )
        )
      )
    )
  );
}

function ensureMetrics(
  metrics: Map<string, SchoolLifecycleMetrics>,
  schoolId: string
): SchoolLifecycleMetrics {
  let m = metrics.get(schoolId);
  if (!m) {
    m = emptyMetrics();
    metrics.set(schoolId, m);
  }
  return m;
}

/**
 * Load per-school lifecycle metrics. Fetches full tables with pagination (no huge IN lists).
 */
export async function loadSchoolLifecycleMetrics(
  admin: AdminClient,
  schoolIds: string[]
): Promise<Map<string, SchoolLifecycleMetrics>> {
  const metrics = new Map<string, SchoolLifecycleMetrics>();
  if (schoolIds.length === 0) return metrics;

  const schoolIdSet = new Set(schoolIds);
  for (const id of schoolIds) {
    metrics.set(id, emptyMetrics());
  }

  const studentRows = await fetchAllRows<{
    id: string;
    school_id: string;
    created_at: string;
    updated_at: string;
  }>({
    label: "school-lifecycle/students",
    fetchPage: async (from, to) =>
      await admin
        .from("students")
        .select("id, school_id, created_at, updated_at")
        .range(from, to),
  });

  const studentSchoolById = new Map<string, string>();
  for (const row of studentRows) {
    if (!schoolIdSet.has(row.school_id)) continue;
    studentSchoolById.set(row.id, row.school_id);
    const m = ensureMetrics(metrics, row.school_id);
    m.studentCount += 1;
    m.lastStudentAt = maxIso(m.lastStudentAt, row.created_at);
    m.lastStudentAt = maxIso(m.lastStudentAt, row.updated_at);
  }

  const memberRows = await fetchAllRows<{
    school_id: string;
    role: string;
    user_id: string;
    created_at: string;
  }>({
    label: "school-lifecycle/school_members",
    fetchPage: async (from, to) =>
      await admin
        .from("school_members")
        .select("school_id, role, user_id, created_at")
        .range(from, to),
  });

  const userIdsBySchool = new Map<string, Set<string>>();
  for (const row of memberRows) {
    if (!schoolIdSet.has(row.school_id)) continue;
    const m = ensureMetrics(metrics, row.school_id);
    if (row.role === "admin") m.adminCount += 1;
    m.lastMemberAt = maxIso(m.lastMemberAt, row.created_at);
    const set = userIdsBySchool.get(row.school_id) ?? new Set();
    set.add(row.user_id);
    userIdsBySchool.set(row.school_id, set);
  }

  const teacherRows = await fetchAllRows<{
    school_id: string;
    teacher_id: string;
    created_at: string;
  }>({
    label: "school-lifecycle/teacher_assignments",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_assignments")
        .select("school_id, teacher_id, created_at")
        .range(from, to),
  });

  const teacherIdsBySchool = new Map<string, Set<string>>();
  for (const row of teacherRows) {
    if (!schoolIdSet.has(row.school_id)) continue;
    const m = ensureMetrics(metrics, row.school_id);
    const set = teacherIdsBySchool.get(row.school_id) ?? new Set();
    if (!set.has(row.teacher_id)) {
      set.add(row.teacher_id);
      m.teacherCount += 1;
    }
    teacherIdsBySchool.set(row.school_id, set);
    m.lastTeacherAt = maxIso(m.lastTeacherAt, row.created_at);
  }

  const paymentRows = await fetchAllRows<{
    student_id: string;
    created_at: string;
    updated_at: string;
  }>({
    label: "school-lifecycle/payments",
    fetchPage: async (from, to) =>
      await admin
        .from("payments")
        .select("student_id, created_at, updated_at")
        .range(from, to),
  });

  for (const row of paymentRows) {
    const schoolId = studentSchoolById.get(row.student_id);
    if (!schoolId) continue;
    const m = ensureMetrics(metrics, schoolId);
    m.paymentCount += 1;
    m.lastPaymentAt = maxIso(m.lastPaymentAt, row.created_at);
    m.lastPaymentAt = maxIso(m.lastPaymentAt, row.updated_at);
  }

  const feeRows = await fetchAllRows<{
    school_id: string;
    created_at: string;
    updated_at: string;
  }>({
    label: "school-lifecycle/fee_structures",
    fetchPage: async (from, to) =>
      await admin
        .from("fee_structures")
        .select("school_id, created_at, updated_at")
        .range(from, to),
  });

  for (const row of feeRows) {
    if (!schoolIdSet.has(row.school_id)) continue;
    const m = ensureMetrics(metrics, row.school_id);
    m.feeStructureCount += 1;
    m.lastFeeAt = maxIso(m.lastFeeAt, row.created_at);
    m.lastFeeAt = maxIso(m.lastFeeAt, row.updated_at);
  }

  const reportRows = await fetchAllRows<{
    school_id: string;
    created_at: string;
    updated_at: string;
  }>({
    label: "school-lifecycle/report_cards",
    fetchPage: async (from, to) =>
      await admin
        .from("report_cards")
        .select("school_id, created_at, updated_at")
        .range(from, to),
  });

  for (const row of reportRows) {
    if (!schoolIdSet.has(row.school_id)) continue;
    const m = ensureMetrics(metrics, row.school_id);
    m.reportCardCount += 1;
    m.lastReportAt = maxIso(m.lastReportAt, row.created_at);
    m.lastReportAt = maxIso(m.lastReportAt, row.updated_at);
  }

  const allUserIds = [
    ...new Set([...userIdsBySchool.values()].flatMap((s) => [...s])),
  ];
  const loginByUser = new Map<string, string>();
  if (allUserIds.length > 0) {
    for (let i = 0; i < allUserIds.length; i += 200) {
      const chunk = allUserIds.slice(i, i + 200);
      const { data: profiles, error } = await admin
        .from("profiles")
        .select("id, last_sign_in_at")
        .in("id", chunk);
      if (error) {
        console.error("[school-lifecycle] profiles login fetch:", error.message);
        continue;
      }
      for (const p of (profiles ?? []) as {
        id: string;
        last_sign_in_at: string | null;
      }[]) {
        if (p.last_sign_in_at) loginByUser.set(p.id, p.last_sign_in_at);
      }
    }
  }

  for (const [schoolId, userIds] of userIdsBySchool) {
    const m = metrics.get(schoolId);
    if (!m) continue;
    for (const uid of userIds) {
      const login = loginByUser.get(uid);
      if (login) m.lastLoginAt = maxIso(m.lastLoginAt, login);
    }
  }

  const syllabusRows = await fetchAllRows<{
    school_id: string;
    updated_at: string;
    created_at: string;
  }>({
    label: "school-lifecycle/syllabus_subtopic_progress",
    fetchPage: async (from, to) =>
      await admin
        .from("syllabus_subtopic_progress")
        .select("school_id, updated_at, created_at")
        .range(from, to),
  });

  for (const row of syllabusRows) {
    if (!schoolIdSet.has(row.school_id)) continue;
    const m = ensureMetrics(metrics, row.school_id);
    m.syllabusActivityCount += 1;
    m.lastSyllabusAt = maxIso(m.lastSyllabusAt, row.updated_at);
    m.lastSyllabusAt = maxIso(m.lastSyllabusAt, row.created_at);
  }

  const attendanceRows = await fetchAllRows<{
    school_id: string;
    created_at: string;
    updated_at: string;
  }>({
    label: "school-lifecycle/class_attendance",
    fetchPage: async (from, to) =>
      await admin
        .from("class_attendance")
        .select("school_id, created_at, updated_at")
        .range(from, to),
  });

  for (const row of attendanceRows) {
    if (!schoolIdSet.has(row.school_id)) continue;
    const m = ensureMetrics(metrics, row.school_id);
    m.attendanceCount += 1;
    m.lastAttendanceAt = maxIso(m.lastAttendanceAt, row.created_at);
    m.lastAttendanceAt = maxIso(m.lastAttendanceAt, row.updated_at);
  }

  for (const [schoolId, m] of metrics) {
    m.lastActivityAt = computeDerivedLastActivity(m);
    metrics.set(schoolId, m);
  }

  return metrics;
}

export function mergeLifecycleCountFallbacks(
  metrics: SchoolLifecycleMetrics,
  fallbacks: { studentCount?: number; adminCount?: number }
): SchoolLifecycleMetrics {
  return {
    ...metrics,
    studentCount: Math.max(metrics.studentCount, fallbacks.studentCount ?? 0),
    adminCount: Math.max(metrics.adminCount, fallbacks.adminCount ?? 0),
  };
}

export function enrichSchoolLifecycle(
  schoolStatus: SchoolLifecycleStatus,
  lastActivityAt: string | null,
  metrics: SchoolLifecycleMetrics,
  schoolTimestamps?: { updatedAt?: string | null; createdAt?: string | null }
): EnrichedSchoolLifecycle {
  const effectiveLastActivity = maxIso(
    lastActivityAt,
    computeDerivedLastActivity(metrics, {
      schoolUpdatedAt: schoolTimestamps?.updatedAt ?? null,
      schoolCreatedAt: schoolTimestamps?.createdAt ?? null,
    })
  );
  const daysSinceLastLogin = daysSinceIso(metrics.lastLoginAt);
  const daysSinceLastActivity = daysSinceIso(effectiveLastActivity);

  const hasOperationalData = hasOperationalSchoolData({
    studentCount: metrics.studentCount,
    teacherCount: metrics.teacherCount,
    paymentCount: metrics.paymentCount,
    feeStructureCount: metrics.feeStructureCount,
    reportCardCount: metrics.reportCardCount,
    syllabusActivityCount: metrics.syllabusActivityCount,
    attendanceCount: metrics.attendanceCount,
  });

  const health = computeSchoolHealthScore({
    studentCount: metrics.studentCount,
    teacherCount: metrics.teacherCount,
    adminCount: metrics.adminCount,
    hasOperationalData,
    recentStudentActivity: isRecentActivity(metrics.lastStudentAt),
    recentTeacherActivity:
      isRecentActivity(metrics.lastLoginAt) ||
      isRecentActivity(metrics.lastTeacherAt),
    daysSinceLastLogin,
    recentAcademicActivity:
      isRecentActivity(metrics.lastSyllabusAt) ||
      isRecentActivity(metrics.lastReportAt),
    recentFinanceActivity:
      isRecentActivity(metrics.lastPaymentAt) ||
      isRecentActivity(metrics.lastFeeAt),
    reportCardCount: metrics.reportCardCount,
    syllabusActivityCount: metrics.syllabusActivityCount,
    paymentCount: metrics.paymentCount,
    feeStructureCount: metrics.feeStructureCount,
    attendanceCount: metrics.attendanceCount,
  });

  const deleteEligibility = evaluateSchoolDeleteEligibility({
    studentCount: metrics.studentCount,
    teacherCount: metrics.teacherCount,
    paymentCount: metrics.paymentCount,
    feeStructureCount: metrics.feeStructureCount,
    reportCardCount: metrics.reportCardCount,
    syllabusActivityCount: metrics.syllabusActivityCount,
    attendanceCount: metrics.attendanceCount,
    daysSinceLastLogin,
    daysSinceLastActivity,
  });

  return {
    schoolStatus,
    lastActivityAt: effectiveLastActivity,
    health,
    deleteEligibility,
    daysSinceLastActivity,
    daysSinceLastLogin,
  };
}

export function computeAutomaticStatus(
  currentStatus: SchoolLifecycleStatus | string,
  lastActivityAt: string | null,
  metrics: SchoolLifecycleMetrics,
  schoolTimestamps?: { updatedAt?: string | null; createdAt?: string | null }
): SchoolLifecycleStatus {
  const effectiveLastActivity = maxIso(
    lastActivityAt,
    computeDerivedLastActivity(metrics, {
      schoolUpdatedAt: schoolTimestamps?.updatedAt ?? null,
      schoolCreatedAt: schoolTimestamps?.createdAt ?? null,
    })
  );
  const daysSinceLastLogin = daysSinceIso(metrics.lastLoginAt);
  const daysSinceLastActivity = daysSinceIso(effectiveLastActivity);

  return deriveAutomaticSchoolStatus(
    normalizeSchoolLifecycleStatus(currentStatus),
    {
      studentCount: metrics.studentCount,
      teacherCount: metrics.teacherCount,
      adminCount: metrics.adminCount,
      paymentCount: metrics.paymentCount,
      feeStructureCount: metrics.feeStructureCount,
      reportCardCount: metrics.reportCardCount,
      syllabusActivityCount: metrics.syllabusActivityCount,
      attendanceCount: metrics.attendanceCount,
      daysSinceLastLogin,
      daysSinceLastActivity,
    }
  );
}

export function schoolHasMeaningfulUsage(
  lastActivityAt: string | null,
  metrics: SchoolLifecycleMetrics,
  schoolTimestamps?: { updatedAt?: string | null; createdAt?: string | null }
): boolean {
  void lastActivityAt;
  void schoolTimestamps;
  return hasOperationalSchoolData({
    studentCount: metrics.studentCount,
    teacherCount: metrics.teacherCount,
    paymentCount: metrics.paymentCount,
    feeStructureCount: metrics.feeStructureCount,
    reportCardCount: metrics.reportCardCount,
    syllabusActivityCount: metrics.syllabusActivityCount,
    attendanceCount: metrics.attendanceCount,
  });
}

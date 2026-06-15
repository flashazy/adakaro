/**
 * Super Admin school lifecycle status rules.
 * Archived is manual-only; schools are never auto-deleted.
 *
 * Lifecycle status reflects business activity state (not health score).
 */

export type SchoolLifecycleStatus = "active" | "setup" | "inactive" | "archived";

/** @deprecated DB may still store legacy value until migration 00177 runs. */
export type LegacySchoolLifecycleStatus = SchoolLifecycleStatus | "trial";

export interface SchoolLifecycleSignals {
  schoolStatus: SchoolLifecycleStatus;
  studentCount: number;
  teacherCount: number;
  paymentCount: number;
  feeStructureCount: number;
  reportCardCount: number;
  syllabusActivityCount: number;
  attendanceCount: number;
  daysSinceLastLogin: number | null;
  daysSinceLastActivity: number | null;
  hasOperationalData: boolean;
}

export interface SchoolDeleteEligibility {
  allowed: boolean;
  reason: string;
  studentCount: number;
  paymentCount: number;
  reportCardCount: number;
  feeStructureCount: number;
  hasMeaningfulActivity: boolean;
}

export const INACTIVE_ACTIVITY_DAYS = 60;
export const SETUP_ATTENTION_DAYS = 14;
const RECENT_ACTIVITY_DAYS = 30;

export function normalizeSchoolLifecycleStatus(
  raw: string | null | undefined
): SchoolLifecycleStatus {
  if (
    raw === "active" ||
    raw === "setup" ||
    raw === "inactive" ||
    raw === "archived"
  ) {
    return raw;
  }
  if (raw === "trial") return "setup";
  return "setup";
}

export function schoolLifecycleStatusLabel(
  status: SchoolLifecycleStatus | LegacySchoolLifecycleStatus
): string {
  const normalized = normalizeSchoolLifecycleStatus(status);
  switch (normalized) {
    case "active":
      return "Active";
    case "setup":
      return "Setup";
    case "inactive":
      return "Inactive";
    case "archived":
      return "Archived";
  }
}

export function schoolLifecycleStatusBadgeClass(
  status: SchoolLifecycleStatus | LegacySchoolLifecycleStatus
): string {
  const normalized = normalizeSchoolLifecycleStatus(status);
  switch (normalized) {
    case "active":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50";
    case "setup":
      return "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-600/60";
    case "inactive":
      return "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-900/40";
    case "archived":
      return "bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700/80";
  }
}

/** Meaningful school operations — excludes admin login / account creation alone. */
export function hasOperationalSchoolData(signals: {
  studentCount: number;
  teacherCount: number;
  paymentCount: number;
  feeStructureCount: number;
  reportCardCount: number;
  syllabusActivityCount: number;
  attendanceCount?: number;
}): boolean {
  if (signals.studentCount > 0 || signals.teacherCount > 0) return true;
  if (signals.paymentCount > 0 || signals.feeStructureCount > 0) return true;
  if (signals.reportCardCount > 0 || signals.syllabusActivityCount > 0) return true;
  if ((signals.attendanceCount ?? 0) > 0) return true;
  return false;
}

/** @deprecated Use hasOperationalSchoolData — lifecycle no longer treats admin-only as active. */
export function hasMeaningfulSchoolUsage(signals: {
  studentCount: number;
  teacherCount: number;
  adminCount?: number;
  paymentCount: number;
  feeStructureCount?: number;
  syllabusActivityCount: number;
  reportCardCount: number;
  attendanceCount?: number;
  daysSinceLastLogin: number | null;
  daysSinceLastActivity: number | null;
}): boolean {
  return hasOperationalSchoolData({
    studentCount: signals.studentCount,
    teacherCount: signals.teacherCount,
    paymentCount: signals.paymentCount,
    feeStructureCount: signals.feeStructureCount ?? 0,
    reportCardCount: signals.reportCardCount,
    syllabusActivityCount: signals.syllabusActivityCount,
    attendanceCount: signals.attendanceCount,
  });
}

export function isSchoolOperationallyEmpty(signals: {
  studentCount: number;
  teacherCount: number;
  paymentCount: number;
  feeStructureCount: number;
  reportCardCount: number;
  syllabusActivityCount: number;
  attendanceCount?: number;
}): boolean {
  return !hasOperationalSchoolData(signals);
}

/**
 * Automatic lifecycle (never sets archived).
 * Setup = registered but no operational data. Active = operational data + recent activity.
 * Inactive = operational data but stale for 60+ days.
 */
export function deriveAutomaticSchoolStatus(
  currentStatus: SchoolLifecycleStatus | LegacySchoolLifecycleStatus,
  signals: Omit<SchoolLifecycleSignals, "schoolStatus" | "hasOperationalData"> & {
    adminCount?: number;
    feeStructureCount?: number;
    attendanceCount?: number;
  }
): SchoolLifecycleStatus {
  const normalizedCurrent = normalizeSchoolLifecycleStatus(currentStatus);
  if (normalizedCurrent === "archived") return "archived";

  const hasOps = hasOperationalSchoolData({
    studentCount: signals.studentCount,
    teacherCount: signals.teacherCount,
    paymentCount: signals.paymentCount,
    feeStructureCount: signals.feeStructureCount,
    reportCardCount: signals.reportCardCount,
    syllabusActivityCount: signals.syllabusActivityCount,
    attendanceCount: signals.attendanceCount,
  });

  if (hasOps) {
    if (
      signals.daysSinceLastActivity !== null &&
      signals.daysSinceLastActivity >= INACTIVE_ACTIVITY_DAYS
    ) {
      return "inactive";
    }
    return "active";
  }

  return "setup";
}

export function evaluateSchoolDeleteEligibility(
  signals: Omit<SchoolLifecycleSignals, "schoolStatus" | "hasOperationalData">
): SchoolDeleteEligibility {
  const hasActivity =
    signals.syllabusActivityCount > 0 ||
    signals.attendanceCount > 0 ||
    (signals.daysSinceLastActivity !== null &&
      signals.daysSinceLastActivity <= INACTIVE_ACTIVITY_DAYS);

  if (signals.studentCount > 0) {
    return {
      allowed: false,
      reason: "This school contains operational data and cannot be permanently deleted.",
      studentCount: signals.studentCount,
      paymentCount: signals.paymentCount,
      reportCardCount: signals.reportCardCount,
      feeStructureCount: signals.feeStructureCount,
      hasMeaningfulActivity: hasActivity,
    };
  }
  if (signals.paymentCount > 0) {
    return {
      allowed: false,
      reason: "This school contains operational data and cannot be permanently deleted.",
      studentCount: signals.studentCount,
      paymentCount: signals.paymentCount,
      reportCardCount: signals.reportCardCount,
      feeStructureCount: signals.feeStructureCount,
      hasMeaningfulActivity: hasActivity,
    };
  }
  if (signals.reportCardCount > 0) {
    return {
      allowed: false,
      reason: "This school contains operational data and cannot be permanently deleted.",
      studentCount: signals.studentCount,
      paymentCount: signals.paymentCount,
      reportCardCount: signals.reportCardCount,
      feeStructureCount: signals.feeStructureCount,
      hasMeaningfulActivity: hasActivity,
    };
  }
  if (signals.feeStructureCount > 0) {
    return {
      allowed: false,
      reason: "This school contains operational data and cannot be permanently deleted.",
      studentCount: signals.studentCount,
      paymentCount: signals.paymentCount,
      reportCardCount: signals.reportCardCount,
      feeStructureCount: signals.feeStructureCount,
      hasMeaningfulActivity: hasActivity,
    };
  }
  if (hasActivity) {
    return {
      allowed: false,
      reason: "This school contains operational data and cannot be permanently deleted.",
      studentCount: signals.studentCount,
      paymentCount: signals.paymentCount,
      reportCardCount: signals.reportCardCount,
      feeStructureCount: signals.feeStructureCount,
      hasMeaningfulActivity: hasActivity,
    };
  }

  return {
    allowed: true,
    reason: "Eligible for permanent deletion (test / empty school only).",
    studentCount: 0,
    paymentCount: 0,
    reportCardCount: 0,
    feeStructureCount: 0,
    hasMeaningfulActivity: false,
  };
}

export function isRecentActivity(
  iso: string | null | undefined,
  withinDays = RECENT_ACTIVITY_DAYS
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= withinDays;
}

export function daysSinceSchoolCreated(createdAt: string): number {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function isSetupSchoolNeedingAttention(
  status: SchoolLifecycleStatus | LegacySchoolLifecycleStatus,
  createdAt: string
): boolean {
  if (normalizeSchoolLifecycleStatus(status) !== "setup") return false;
  return daysSinceSchoolCreated(createdAt) > SETUP_ATTENTION_DAYS;
}

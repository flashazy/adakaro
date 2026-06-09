import "server-only";

import type {
  AuthCallbackReason,
  AuthPlatformReason,
  CaptureCardLoginReason,
  ParentDashboardReason,
  ParentLoginReason,
  PasswordRecoveryReason,
  ProfileAccessReason,
  TeacherDashboardReason,
  TeacherLoginReason,
} from "@/lib/watchdog/auth-reasons";

/** @deprecated Phase 2C — use scoped keys via auth-health-alerts */
export const LEGACY_AUTH_DEDUPE_KEYS = {
  parentLoginFailure: "parent_login_failure",
  teacherLoginFailure: "teacher_login_failure",
  parentDashboardInitFailure: "parent_dashboard_init_failure",
  teacherDashboardInitFailure: "teacher_dashboard_init_failure",
  parentDataLoadFailure: "parent_data_load_failure",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildAuthPlatformDedupeKey(
  reason: AuthPlatformReason
): string {
  return `platform:auth:${reason}`;
}

export function buildParentLoginDedupeKey(reason: ParentLoginReason): string {
  return `platform:parent_login:${reason}`;
}

export function buildTeacherLoginDedupeKey(reason: TeacherLoginReason): string {
  return `platform:teacher_login:${reason}`;
}

export function buildAuthCallbackDedupeKey(reason: AuthCallbackReason): string {
  return `platform:auth_callback:${reason}`;
}

export function buildPasswordRecoveryDedupeKey(
  reason: PasswordRecoveryReason
): string {
  return `platform:password_recovery:${reason}`;
}

export function buildCaptureCardLoginDedupeKey(
  reason: CaptureCardLoginReason
): string {
  return `platform:capture_card_login:${reason}`;
}

export function buildProfileAccessDedupeKey(
  reason: ProfileAccessReason
): string {
  return `platform:profile_access:${reason}`;
}

export function buildParentDashboardDedupeKey(
  reason: ParentDashboardReason
): string {
  return `platform:parent_dashboard:${reason}`;
}

export function buildTeacherDashboardDedupeKey(
  reason: TeacherDashboardReason
): string {
  return `platform:teacher_dashboard:${reason}`;
}

export function buildParentDataLoadDedupeKey(params: {
  schoolId?: string | null;
  phase: string;
  studentId?: string | null;
}): string | null {
  const phase = params.phase?.trim();
  if (!phase) return null;

  const schoolId = params.schoolId?.trim().toLowerCase();
  const studentId = params.studentId?.trim().toLowerCase();

  if (!schoolId || !UUID_RE.test(schoolId)) {
    if (studentId && UUID_RE.test(studentId)) {
      return `platform:parent_data_load:${phase}:${studentId}`;
    }
    return `platform:parent_data_load:${phase}`;
  }

  if (studentId && UUID_RE.test(studentId)) {
    return `${schoolId}:parent_data_load:${phase}:${studentId}`;
  }
  return `${schoolId}:parent_data_load:${phase}`;
}

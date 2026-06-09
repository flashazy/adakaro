import "server-only";

import {
  buildAuthCallbackDedupeKey,
  buildAuthPlatformDedupeKey,
  buildCaptureCardLoginDedupeKey,
  buildParentDashboardDedupeKey,
  buildParentDataLoadDedupeKey,
  buildParentLoginDedupeKey,
  buildPasswordRecoveryDedupeKey,
  buildProfileAccessDedupeKey,
  buildTeacherDashboardDedupeKey,
  buildTeacherLoginDedupeKey,
} from "@/lib/watchdog/auth-dedupe-keys";
import { buildAuthAlertMetadata } from "@/lib/watchdog/auth-metadata";
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
import { HEALTH_FEATURES } from "@/lib/watchdog/features";
import { reportHealthAlert } from "@/lib/watchdog/report-health-alert";
import { resolveHealthAlertByDedupeKey } from "@/lib/watchdog/resolve-health-alert";

function reportPlatformAuthAlert(params: {
  feature: string;
  dedupeKey: string;
  severity: "high" | "critical";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  void reportHealthAlert({
    feature: params.feature,
    severity: params.severity,
    title: params.title,
    message: params.message,
    schoolId: null,
    dedupeKey: params.dedupeKey,
    metadata: buildAuthAlertMetadata(params.metadata, params.error),
  });
}

export function reportAuthPlatformAlert(params: {
  reason: AuthPlatformReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildAuthPlatformDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.auth,
    dedupeKey,
    severity: "critical",
    title: "Authentication unavailable (platform)",
    message:
      "Sign-in and authentication flows cannot run due to a server configuration error.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportParentLoginAlert(params: {
  reason: ParentLoginReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildParentLoginDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.parentLogin,
    dedupeKey,
    severity: "high",
    title: "Parent sign-in failure",
    message: "A parent sign-in attempt failed unexpectedly.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportTeacherLoginAlert(params: {
  reason: TeacherLoginReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildTeacherLoginDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.teacherLogin,
    dedupeKey,
    severity: "high",
    title: "Teacher sign-in failure",
    message: "A teacher sign-in attempt failed unexpectedly.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportAuthCallbackAlert(params: {
  reason: AuthCallbackReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildAuthCallbackDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.authCallback,
    dedupeKey,
    severity: "high",
    title: "Auth callback failure",
    message: "An authentication callback could not be completed.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportPasswordRecoveryAlert(params: {
  reason: PasswordRecoveryReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildPasswordRecoveryDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.passwordRecovery,
    dedupeKey,
    severity: "high",
    title: "Password recovery failure",
    message: "A parent password recovery step failed unexpectedly.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportCaptureCardLoginAlert(params: {
  reason: CaptureCardLoginReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildCaptureCardLoginDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.captureCardLogin,
    dedupeKey,
    severity: "high",
    title: "Capture card sign-in failure",
    message: "Enrollment desk sign-in could not be verified.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportProfileAccessAlert(params: {
  reason: ProfileAccessReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildProfileAccessDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.profileAccess,
    dedupeKey,
    severity: "critical",
    title: "Profile access failure (platform)",
    message:
      "Profile data could not be read. This may affect sign-in routing and dashboard access.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportParentDashboardAlert(params: {
  reason: ParentDashboardReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildParentDashboardDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.parentDashboard,
    dedupeKey,
    severity: "high",
    title: "Parent dashboard initialization failure",
    message: "Parent dashboard could not load after successful sign-in.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportTeacherDashboardAlert(params: {
  reason: TeacherDashboardReason;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildTeacherDashboardDedupeKey(params.reason);
  reportPlatformAuthAlert({
    feature: HEALTH_FEATURES.teacherDashboard,
    dedupeKey,
    severity: "high",
    title: "Teacher dashboard initialization failure",
    message: "Teacher dashboard could not load after successful sign-in.",
    metadata: { ...params.metadata, reason: params.reason },
    error: params.error,
  });
}

export function reportParentDataLoadAlert(params: {
  phase: string;
  schoolId?: string | null;
  studentId?: string | null;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const dedupeKey = buildParentDataLoadDedupeKey({
    schoolId: params.schoolId,
    phase: params.phase,
    studentId: params.studentId,
  });
  if (!dedupeKey) return;

  const schoolId = dedupeKey.startsWith("platform:")
    ? null
    : dedupeKey.split(":")[0]?.toLowerCase();

  void reportHealthAlert({
    feature: HEALTH_FEATURES.parentDataLoad,
    severity: "high",
    title: "Parent dashboard data load failure",
    message: "Parent dashboard data could not be loaded correctly.",
    schoolId,
    dedupeKey,
    metadata: buildAuthAlertMetadata(
      { ...params.metadata, reason: params.phase, phase: params.phase },
      params.error
    ),
  });
}

export function resolveAuthPlatformAlert(reason: AuthPlatformReason): void {
  void resolveHealthAlertByDedupeKey(buildAuthPlatformDedupeKey(reason));
}

export function resolveParentLoginAlert(reason: ParentLoginReason): void {
  void resolveHealthAlertByDedupeKey(buildParentLoginDedupeKey(reason));
}

export function resolveTeacherLoginAlert(reason: TeacherLoginReason): void {
  void resolveHealthAlertByDedupeKey(buildTeacherLoginDedupeKey(reason));
}

export function resolveAuthCallbackAlert(reason: AuthCallbackReason): void {
  void resolveHealthAlertByDedupeKey(buildAuthCallbackDedupeKey(reason));
}

export function resolvePasswordRecoveryAlert(
  reason: PasswordRecoveryReason
): void {
  void resolveHealthAlertByDedupeKey(buildPasswordRecoveryDedupeKey(reason));
}

export function resolveProfileAccessAlert(reason: ProfileAccessReason): void {
  void resolveHealthAlertByDedupeKey(buildProfileAccessDedupeKey(reason));
}

export function resolveTeacherDashboardAlert(
  reason: TeacherDashboardReason
): void {
  void resolveHealthAlertByDedupeKey(buildTeacherDashboardDedupeKey(reason));
}

export function resolveParentDashboardAlert(
  reason: ParentDashboardReason
): void {
  void resolveHealthAlertByDedupeKey(buildParentDashboardDedupeKey(reason));
}

export function resolveParentDataLoadAlert(params: {
  phase: string;
  schoolId?: string | null;
  studentId?: string | null;
}): void {
  const dedupeKey = buildParentDataLoadDedupeKey(params);
  if (!dedupeKey) return;
  void resolveHealthAlertByDedupeKey(dedupeKey);
}

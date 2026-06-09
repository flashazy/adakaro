import "server-only";

import {
  reportAuthCallbackAlert,
  reportAuthPlatformAlert,
  reportCaptureCardLoginAlert,
  reportParentDashboardAlert,
  reportParentDataLoadAlert,
  reportParentLoginAlert,
  reportPasswordRecoveryAlert,
  reportProfileAccessAlert,
  reportTeacherDashboardAlert,
  reportTeacherLoginAlert,
} from "@/lib/watchdog/auth-health-alerts";
import {
  AUTH_CALLBACK_REASONS,
  AUTH_PLATFORM_REASONS,
  CAPTURE_CARD_LOGIN_REASONS,
  PARENT_DASHBOARD_REASONS,
  PARENT_LOGIN_REASONS,
  PASSWORD_RECOVERY_REASONS,
  PROFILE_ACCESS_REASONS,
  TEACHER_DASHBOARD_REASONS,
  TEACHER_LOGIN_REASONS,
} from "@/lib/watchdog/auth-reasons";
import { HEALTH_FEATURES } from "@/lib/watchdog/features";
import { legacyPhaseToSettlementReason } from "@/lib/watchdog/payment-dedupe-keys";
import {
  reportPaymentReceiptAlert,
  reportPaymentSettlementAlert,
  shouldSuppressPaymentSettlementAlert,
} from "@/lib/watchdog/payment-health-alerts";
import { reportHealthAlert } from "@/lib/watchdog/report-health-alert";

/** Stable dedupe keys — legacy globals deprecated in Phase 2B/2C; see auth-dedupe-keys / payment-dedupe-keys. */
export const HEALTH_DEDUPE_KEYS = {
  parentLoginFailure: "parent_login_failure",
  teacherLoginFailure: "teacher_login_failure",
  teacherPhoneFailure: "teacher_phone_failure",
  reportCardGenerationFailure: "report_card_generation_failure",
  marksSaveFailure: "marks_save_failure",
  parentDashboardInitFailure: "parent_dashboard_init_failure",
  teacherDashboardInitFailure: "teacher_dashboard_init_failure",
  paymentSettlementFailure: "payment_settlement_failure",
  paymentReceiptFailure: "payment_receipt_failure",
  subjectEnrollmentDrift: "subject_enrollment_drift",
  subjectClassSyncFailure: "subject_class_sync_failure",
  studentSubjectEnrollmentFailure: "student_subject_enrollment_failure",
  parentProvisioningFailure: "parent_provisioning_failure",
  schoolCreationFailure: "school_creation_failure",
  parentDataLoadFailure: "parent_data_load_failure",
  teacherNotificationFailure: "teacher_notification_failure",
  academicReportFailure: "academic_report_failure",
} as const;

/** Wrong password / unknown user — expected user errors, not Health Center events. */
export function isExpectedAuthError(message: string): boolean {
  const t = message.toLowerCase();
  if (t.includes("invalid") && (t.includes("credential") || t.includes("password"))) {
    return true;
  }
  if (t.includes("email not confirmed")) return true;
  if (t.includes("user not found")) return true;
  if (t.includes("invalid login credentials")) return true;
  return false;
}

function legacyReason(metadata?: Record<string, unknown>): string | undefined {
  const r = metadata?.reason ?? metadata?.phase;
  return typeof r === "string" ? r : undefined;
}

/** @deprecated Use reportAuthPlatformAlert — maps legacy admin_client_unavailable only. */
export function reportParentLoginFailure(
  metadata?: Record<string, unknown>
): void {
  const reason = legacyReason(metadata);
  if (reason === "admin_client_unavailable") {
    reportAuthPlatformAlert({
      reason: AUTH_PLATFORM_REASONS.adminClientUnavailable,
      metadata: { user_id: metadata?.user_id },
      error: metadata?.error,
    });
    return;
  }
  if (reason === "auth_error") {
    reportParentLoginAlert({
      reason: PARENT_LOGIN_REASONS.signInError,
      metadata: { path: metadata?.path, user_id: metadata?.user_id },
      error: metadata?.error,
    });
    return;
  }
  if (reason === "profile_load_failed") {
    return;
  }
  if (
    reason === "session_exchange_failed" ||
    reason === "session_missing_after_callback" ||
    reason === "profile_lookup_failed" ||
    reason === "profile_role_missing"
  ) {
    reportAuthCallbackAlert({
      reason:
        reason === "session_exchange_failed"
          ? AUTH_CALLBACK_REASONS.sessionExchangeFailed
          : reason === "session_missing_after_callback"
            ? AUTH_CALLBACK_REASONS.sessionMissingAfterCallback
            : reason === "profile_lookup_failed"
              ? AUTH_CALLBACK_REASONS.profileLookupFailed
              : AUTH_CALLBACK_REASONS.profileRoleMissing,
      metadata: { user_id: metadata?.user_id },
      error: metadata?.error,
    });
    return;
  }
  if (
    reason === "recovery_profile_load_failed" ||
    reason === "recovery_session_failed"
  ) {
    reportPasswordRecoveryAlert({
      reason:
        reason === "recovery_profile_load_failed"
          ? PASSWORD_RECOVERY_REASONS.recoveryProfileLoadFailed
          : PASSWORD_RECOVERY_REASONS.recoverySessionFailed,
      metadata: { user_id: metadata?.user_id },
      error: metadata?.error,
    });
  }
}

/** @deprecated Use reportAuthPlatformAlert / reportTeacherLoginAlert / reportCaptureCardLoginAlert */
export function reportTeacherLoginFailure(
  metadata?: Record<string, unknown>
): void {
  const reason = legacyReason(metadata);
  if (reason === "admin_client_unavailable") {
    return;
  }
  if (reason === "auth_error") {
    reportTeacherLoginAlert({
      reason: TEACHER_LOGIN_REASONS.signInError,
      metadata: { path: metadata?.path, user_id: metadata?.user_id },
      error: metadata?.error,
    });
    return;
  }
  if (reason === "email_resolution_failed") {
    reportTeacherLoginAlert({
      reason: TEACHER_LOGIN_REASONS.emailResolutionFailed,
      metadata: { user_id: metadata?.user_id },
      error: metadata?.error,
    });
    return;
  }
  if (reason === "profile_load_failed" || reason === "profile_lookup_failed") {
    return;
  }
  if (reason === "capture_card_lookup_failed") {
    reportCaptureCardLoginAlert({
      reason: CAPTURE_CARD_LOGIN_REASONS.captureCardLookupFailed,
      metadata: { user_id: metadata?.user_id },
      error: metadata?.error,
    });
  }
}

export function reportTeacherPhoneFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.teacherPhone,
    severity: "medium",
    title: "Class teacher phone number failure",
    message: "Phone number could not be saved or retrieved correctly.",
    dedupeKey: HEALTH_DEDUPE_KEYS.teacherPhoneFailure,
    schoolId,
    metadata,
  });
}

export function reportReportCardGenerationFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.reportCards,
    severity: "critical",
    title: "Report card generation failure",
    message: "One or more report cards failed to generate correctly.",
    dedupeKey: HEALTH_DEDUPE_KEYS.reportCardGenerationFailure,
    schoolId,
    metadata,
  });
}

export function reportMarksSaveFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.marks,
    severity: "critical",
    title: "Marks save failure",
    message: "Student marks could not be saved correctly.",
    dedupeKey: HEALTH_DEDUPE_KEYS.marksSaveFailure,
    schoolId,
    metadata,
  });
}

export function reportParentDashboardInitFailure(
  metadata?: Record<string, unknown>
): void {
  const reason = legacyReason(metadata);
  if (reason === "profile_query_failed") {
    reportProfileAccessAlert({
      reason: PROFILE_ACCESS_REASONS.profileQueryFailed,
      metadata: { user_id: metadata?.user_id },
      error: metadata?.error,
    });
    return;
  }
  if (reason === "parent_students_query_failed") {
    return;
  }
  reportParentDashboardAlert({
    reason: PARENT_DASHBOARD_REASONS.shellLoadFailed,
    metadata: { user_id: metadata?.user_id },
    error: metadata?.error,
  });
}

export function reportTeacherDashboardInitFailure(
  metadata?: Record<string, unknown>
): void {
  reportTeacherDashboardAlert({
    reason: TEACHER_DASHBOARD_REASONS.teacherAccessCheckFailed,
    metadata: { user_id: metadata?.user_id },
    error: metadata?.error,
  });
}

export function reportPaymentSettlementFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  const phase =
    typeof metadata?.phase === "string" ? metadata.phase : undefined;
  if (shouldSuppressPaymentSettlementAlert(phase)) return;
  const reason = legacyPhaseToSettlementReason(phase);
  if (!reason) return;
  const { phase: _p, error, ...rest } = metadata ?? {};
  reportPaymentSettlementAlert({
    reason,
    orderReference:
      typeof rest.order_reference === "string" ? rest.order_reference : null,
    schoolId: schoolId ?? (typeof rest.school_id === "string" ? rest.school_id : null),
    metadata: rest,
    error,
  });
}

export function reportPaymentReceiptFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  const resolvedSchoolId =
    schoolId ??
    (typeof metadata?.school_id === "string" ? metadata.school_id : null);
  const paymentId =
    typeof metadata?.payment_id === "string" ? metadata.payment_id : null;
  if (!resolvedSchoolId || !paymentId) return;
  const { phase: _p, error, ...rest } = metadata ?? {};
  reportPaymentReceiptAlert({
    schoolId: resolvedSchoolId,
    paymentId,
    metadata: rest,
    error,
  });
}

export function reportSubjectEnrollmentDrift(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.subjectEnrollmentDrift,
    severity: "critical",
    title: "Student subject enrollment mismatch",
    message:
      "A student's class changed but subject enrollment could not be reconciled.",
    dedupeKey: HEALTH_DEDUPE_KEYS.subjectEnrollmentDrift,
    schoolId,
    metadata,
  });
}

export function reportSubjectClassSyncFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.subjectClassSync,
    severity: "critical",
    title: "Subject-class synchronization failure",
    message: "Subject class mappings could not be saved correctly.",
    dedupeKey: HEALTH_DEDUPE_KEYS.subjectClassSyncFailure,
    schoolId,
    metadata,
  });
}

export function reportStudentSubjectEnrollmentFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.studentSubjectEnrollment,
    severity: "critical",
    title: "Student subject enrollment failure",
    message: "A student's subject enrollment could not be saved correctly.",
    dedupeKey: HEALTH_DEDUPE_KEYS.studentSubjectEnrollmentFailure,
    schoolId,
    metadata,
  });
}

export function reportParentProvisioningFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.parentProvisioning,
    severity: "high",
    title: "Parent account provisioning failure",
    message: "A parent portal account could not be created or linked.",
    dedupeKey: HEALTH_DEDUPE_KEYS.parentProvisioningFailure,
    schoolId,
    metadata,
  });
}

export function reportSchoolCreationFailure(
  metadata?: Record<string, unknown>
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.schoolCreation,
    severity: "critical",
    title: "School creation failure",
    message: "A new school could not be created during onboarding.",
    dedupeKey: HEALTH_DEDUPE_KEYS.schoolCreationFailure,
    metadata,
  });
}

export function reportParentDataLoadFailure(
  metadata?: Record<string, unknown>
): void {
  const phase = legacyReason(metadata) ?? "unknown_phase";
  reportParentDataLoadAlert({
    phase,
    schoolId:
      typeof metadata?.school_id === "string" ? metadata.school_id : null,
    studentId:
      typeof metadata?.student_id === "string" ? metadata.student_id : null,
    metadata: {
      user_id: metadata?.user_id,
      class_id: metadata?.class_id,
    },
    error: metadata?.error,
  });
}

export function reportTeacherNotificationFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.teacherNotifications,
    severity: "high",
    title: "Class movement notification failure",
    message: "Class teachers were not notified of student class movements.",
    dedupeKey: HEALTH_DEDUPE_KEYS.teacherNotificationFailure,
    schoolId,
    metadata,
  });
}

export function reportAcademicReportFailure(
  metadata?: Record<string, unknown>,
  schoolId?: string | null
): void {
  void reportHealthAlert({
    feature: HEALTH_FEATURES.academicReports,
    severity: "high",
    title: "Academic performance report failure",
    message: "An academic performance report snapshot could not be saved.",
    dedupeKey: HEALTH_DEDUPE_KEYS.academicReportFailure,
    schoolId,
    metadata,
  });
}

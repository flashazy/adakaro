import "server-only";

export const AUTH_PLATFORM_REASONS = {
  adminClientUnavailable: "admin_client_unavailable",
} as const;

export const PARENT_LOGIN_REASONS = {
  signInError: "sign_in_error",
} as const;

export const TEACHER_LOGIN_REASONS = {
  signInError: "sign_in_error",
  emailResolutionFailed: "email_resolution_failed",
} as const;

export const AUTH_CALLBACK_REASONS = {
  sessionExchangeFailed: "session_exchange_failed",
  sessionMissingAfterCallback: "session_missing_after_callback",
  profileLookupFailed: "profile_lookup_failed",
  profileRoleMissing: "profile_role_missing",
} as const;

export const PASSWORD_RECOVERY_REASONS = {
  recoveryProfileLoadFailed: "recovery_profile_load_failed",
  recoverySessionFailed: "recovery_session_failed",
} as const;

export const CAPTURE_CARD_LOGIN_REASONS = {
  captureCardLookupFailed: "capture_card_lookup_failed",
} as const;

export const PROFILE_ACCESS_REASONS = {
  profileQueryFailed: "profile_query_failed",
  profileLoadBlocked: "profile_load_blocked",
} as const;

export const PARENT_DASHBOARD_REASONS = {
  shellLoadFailed: "shell_load_failed",
} as const;

export const TEACHER_DASHBOARD_REASONS = {
  teacherAccessCheckFailed: "teacher_access_check_failed",
} as const;

export type AuthPlatformReason =
  (typeof AUTH_PLATFORM_REASONS)[keyof typeof AUTH_PLATFORM_REASONS];
export type ParentLoginReason =
  (typeof PARENT_LOGIN_REASONS)[keyof typeof PARENT_LOGIN_REASONS];
export type TeacherLoginReason =
  (typeof TEACHER_LOGIN_REASONS)[keyof typeof TEACHER_LOGIN_REASONS];
export type AuthCallbackReason =
  (typeof AUTH_CALLBACK_REASONS)[keyof typeof AUTH_CALLBACK_REASONS];
export type PasswordRecoveryReason =
  (typeof PASSWORD_RECOVERY_REASONS)[keyof typeof PASSWORD_RECOVERY_REASONS];
export type CaptureCardLoginReason =
  (typeof CAPTURE_CARD_LOGIN_REASONS)[keyof typeof CAPTURE_CARD_LOGIN_REASONS];
export type ProfileAccessReason =
  (typeof PROFILE_ACCESS_REASONS)[keyof typeof PROFILE_ACCESS_REASONS];
export type ParentDashboardReason =
  (typeof PARENT_DASHBOARD_REASONS)[keyof typeof PARENT_DASHBOARD_REASONS];
export type TeacherDashboardReason =
  (typeof TEACHER_DASHBOARD_REASONS)[keyof typeof TEACHER_DASHBOARD_REASONS];

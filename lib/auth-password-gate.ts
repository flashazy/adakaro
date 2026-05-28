/**
 * Shared rules for forced password change (teachers + parents).
 * Used by middleware, login, and /change-password.
 */

export interface ProfilePasswordGateRow {
  role?: string | null;
  password_changed?: boolean | null;
  password_forced_reset?: boolean | null;
  must_change_password?: boolean | null;
}

export function normalizeProfileRole(role: string | null | undefined): string {
  return (role ?? "").toLowerCase().trim();
}

export function isTeacherProfileRole(role: string | null | undefined): boolean {
  return normalizeProfileRole(role) === "teacher";
}

export function isParentProfileRole(role: string | null | undefined): boolean {
  return normalizeProfileRole(role) === "parent";
}

/** School admins must never be sent through teacher temp-password flows. */
export function isSchoolAdminProfileRole(
  role: string | null | undefined
): boolean {
  const r = normalizeProfileRole(role);
  return r === "admin" || r === "finance" || r === "accounts";
}

/**
 * Teacher must set a new password before using the app.
 * Uses `password_changed !== true` so null/undefined still require a change.
 */
export function teacherMustChangePassword(
  row: ProfilePasswordGateRow | null | undefined
): boolean {
  if (!row || !isTeacherProfileRole(row.role)) return false;
  if (isSchoolAdminProfileRole(row.role)) return false;
  if (row.must_change_password === true) return true;
  if (row.password_forced_reset === true) return true;
  return row.password_changed !== true;
}

/** Parents with enrollment temp passwords (`must_change_password` only). */
export function parentMustChangePassword(
  row: ProfilePasswordGateRow | null | undefined
): boolean {
  if (!row || !isParentProfileRole(row.role)) return false;
  return row.must_change_password === true;
}

export function accountMustChangePassword(
  row: ProfilePasswordGateRow | null | undefined
): boolean {
  return teacherMustChangePassword(row) || parentMustChangePassword(row);
}

/** Fallback when profiles row cannot be loaded (RLS / missing service role). */
export function profilePasswordGateFromUserMetadata(
  userMetadata: Record<string, unknown> | null | undefined
): ProfilePasswordGateRow | null {
  const meta = userMetadata ?? {};
  const role = normalizeProfileRole(String(meta.role ?? ""));
  if (!role) return null;

  const passwordChanged = meta.password_changed;
  const mustChange = meta.must_change_password;
  const forcedReset = meta.password_forced_reset;

  return {
    role,
    password_changed:
      passwordChanged === true
        ? true
        : passwordChanged === false
          ? false
          : null,
    must_change_password: mustChange === true,
    password_forced_reset: forcedReset === true,
  };
}

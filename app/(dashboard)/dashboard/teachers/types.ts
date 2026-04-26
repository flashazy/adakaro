/**
 * Shared types and constants for the Teachers dashboard feature.
 *
 * Kept in a plain module (not a `"use server"` file) so the Next.js server
 * actions runtime does not reject non-async exports.
 */

export type TeacherActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type ResetTeacherPasswordState =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string }
  | null;

export interface SchoolTeacherMemberRow {
  id: string;
  user_id: string;
  created_at: string;
  /** profiles.full_name */
  profileFullName: string | null;
  /** profiles.email */
  profileEmail: string | null;
  /** profiles.password_changed — false until first password change */
  profilePasswordChanged: boolean;
}

/** Departments admins can assign in Manage department roles (excludes legacy `accounts`). */
export type ManageableTeacherDepartment =
  | "academic"
  | "discipline"
  | "health"
  | "finance";

/** DB value may still include legacy `accounts` (same access as finance). */
export type TeacherDepartment = ManageableTeacherDepartment | "accounts";

export const MANAGEABLE_TEACHER_DEPARTMENTS: readonly ManageableTeacherDepartment[] =
  ["academic", "discipline", "health", "finance"] as const;

/**
 * Collapses legacy `accounts` into `finance` and de-duplicates for UI / modal state.
 */
export function normalizeTeacherDepartmentRoles(
  roles: readonly TeacherDepartment[]
): ManageableTeacherDepartment[] {
  const set = new Set<ManageableTeacherDepartment>();
  for (const r of roles) {
    if (r === "accounts" || r === "finance") set.add("finance");
    else set.add(r);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Class the admin can assign as a coordinator class to an Academic teacher. */
export interface CoordinatorClassOption {
  id: string;
  name: string;
  parent_class_id: string | null;
}

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

export type TeacherDepartment =
  | "academic"
  | "discipline"
  | "health"
  | "finance";

export const TEACHER_DEPARTMENTS: readonly TeacherDepartment[] = [
  "academic",
  "discipline",
  "health",
  "finance",
] as const;

/** Class the admin can assign as a coordinator class to an Academic teacher. */
export interface CoordinatorClassOption {
  id: string;
  name: string;
  parent_class_id: string | null;
}

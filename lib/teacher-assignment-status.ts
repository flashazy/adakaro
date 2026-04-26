import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchClassesWhereUserIsClassTeacher } from "@/lib/class-teacher";

/** Manual widen — admin select typing without full Relationships on joins. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Redirects to teacher dashboard (locked state) when the teacher has no assignments. */
export async function ensureTeacherHasAssignmentsOrRedirect(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  if (!(await hasTeacherAssignments(supabase, userId))) {
    redirect("/teacher-dashboard");
  }
}

export async function hasTeacherAssignments(
  _supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("teacher_assignments")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", userId);

  if (error) return false;
  return (count ?? 0) > 0;
}

/** True when this teacher is the designated class teacher for at least one class. */
export async function hasClassTeacherAssignment(
  _supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const rows = await fetchClassesWhereUserIsClassTeacher(userId);
  return rows.length > 0;
}

/** True when the teacher is a class coordinator (report cards workspace allows this path). */
export async function hasTeacherCoordinatorRole(
  _supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("teacher_coordinators")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", userId);

  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Some routes allow teachers with class assignments **or** class coordinators
 * when no leaf `teacher_assignments` row exists. The report-cards list page
 * now redirects; callers may still use this guard for other flows.
 */
export async function ensureReportCardsPageAccessOrRedirect(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const [hasTa, hasCoord] = await Promise.all([
    hasTeacherAssignments(supabase, userId),
    hasTeacherCoordinatorRole(supabase, userId),
  ]);
  if (!hasTa && !hasCoord) {
    redirect("/teacher-dashboard");
  }
}

export interface TeacherLockedContactInfo {
  schoolName: string;
  adminName: string;
  adminEmail: string | null;
  adminPhone: string | null;
}

/**
 * For teachers with no class assignments: school + first school admin contact.
 * School comes from school_members (teacher); admins from school_members (admin) + profiles.
 */
export async function getTeacherLockedContactInfo(
  _supabase: SupabaseClient<Database>,
  userId: string
): Promise<TeacherLockedContactInfo | null> {
  const admin = createAdminClient();
  const { data: mem } = await admin
    .from("school_members")
    .select("school_id")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .limit(1)
    .maybeSingle();

  const schoolId = (mem as { school_id: string } | null)?.school_id ?? null;
  if (!schoolId) return null;

  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  const schoolName =
    (school as { name: string } | null)?.name?.trim() ?? "Your school";

  const { data: adminMems } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  const adminIds = (adminMems ?? []).map(
    (m) => (m as { user_id: string }).user_id
  );
  if (adminIds.length === 0) {
    return {
      schoolName,
      adminName: "School administrator",
      adminEmail: null,
      adminPhone: null,
    };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", adminIds[0])
    .maybeSingle();

  const p = prof as {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  const phoneRaw = p?.phone?.trim() ?? "";
  return {
    schoolName,
    adminName: p?.full_name?.trim() || "School administrator",
    adminEmail: p?.email ?? null,
    adminPhone: phoneRaw.length > 0 ? phoneRaw : null,
  };
}

/** First assignment label for header, e.g. "Grade 1 – Mathematics". */
export async function getPrimaryTeacherAssignmentLabel(
  _supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: row } = await (admin as Db)
    .from("teacher_assignments")
    .select(
      `
      class_id,
      subject,
      subject_id,
      subjects ( name )
    `
    )
    .eq("teacher_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  const ta = row as {
    class_id: string;
    subject: string | null;
    subject_id: string | null;
    subjects: { name: string } | null;
  };
  const { data: cls } = await admin
    .from("classes")
    .select("name")
    .eq("id", ta.class_id)
    .maybeSingle();

  const className = (cls as { name: string } | null)?.name?.trim() ?? "Class";
  const subj =
    ta.subjects?.name?.trim() ||
    ta.subject?.trim() ||
    "General";
  return `${className} – ${subj}`;
}

"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeacherInvitationEmail } from "@/lib/teacher-invite-email";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/** Manual Database types omit `Relationships` required by Supabase v2 generics; use for typed payloads only. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow client insert/update resolves to `never` without generated Relationships
type Db = any;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Permission check using service role only — avoids RLS recursion on `profiles`
 * (e.g. is_super_admin() evaluated under profiles policies when using the user session).
 * Mirrors is_school_admin + super_admin + school creator.
 */
export async function assertSchoolAdminForUser(
  userId: string,
  schoolId: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if ((prof as { role: string } | null)?.role === "super_admin") {
      return true;
    }
    const { data: mem } = await admin
      .from("school_members")
      .select("role")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .maybeSingle();
    if ((mem as { role: string } | null)?.role === "admin") {
      return true;
    }
    const { data: school } = await admin
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .eq("created_by", userId)
      .maybeSingle();
    return Boolean(school);
  } catch {
    return false;
  }
}

/** Primary school for a user — same idea as get_my_school_id, service role only (no RLS). */
async function getSchoolIdForUserWithAdmin(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: mem } = await admin
      .from("school_members")
      .select("school_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (mem) return (mem as { school_id: string }).school_id;
    const { data: s } = await admin
      .from("schools")
      .select("id")
      .eq("created_by", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (s as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

async function findProfileIdByEmail(
  emailNorm: string,
  admin: SupabaseClient<Database>
): Promise<string | null> {
  try {
    const { data: exact } = await admin
      .from("profiles")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();
    if (exact) return (exact as { id: string }).id;

    const { data: ci } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", emailNorm)
      .limit(1)
      .maybeSingle();
    if (ci) return (ci as { id: string }).id;
  } catch {
    /* */
  }
  return null;
}

function getPublicAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export type TeacherActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export interface SchoolTeacherMemberRow {
  id: string;
  user_id: string;
  created_at: string;
  /** profiles.full_name */
  profileFullName: string | null;
  /** profiles.email */
  profileEmail: string | null;
}

async function fetchSchoolTeacherMembersFallback(
  schoolId: string
): Promise<SchoolTeacherMemberRow[]> {
  try {
    const admin = createAdminClient();
    const { data: members } = await (admin as Db)
      .from("school_members")
      .select("id, user_id, created_at, role")
      .eq("school_id", schoolId)
      .in("role", ["admin", "teacher"])
      .order("created_at", { ascending: true });

    const rows = (members ?? []) as {
      id: string;
      user_id: string;
      created_at: string;
      role: string;
    }[];

    const teacherRows = rows.filter((r) => r.role === "teacher");
    const ids = teacherRows.map((r) => r.user_id);
    if (ids.length === 0) return [];

    const { data: profs } = await (admin as Db)
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);

    const profList = (profs ?? []) as {
      id: string;
      full_name: string;
      email: string | null;
    }[];

    const byId = new Map(profList.map((p) => [p.id, p]));

    return teacherRows.map((m) => {
      const p = byId.get(m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        created_at: m.created_at,
        profileFullName: p?.full_name ?? null,
        profileEmail: p?.email ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Teacher rows for /dashboard/teachers. Uses service role so RLS cannot hide
 * teacher memberships or profiles. Joins profiles for name and email.
 */
export async function fetchSchoolTeacherMembersForTeachersPage(
  schoolId: string
): Promise<SchoolTeacherMemberRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin as Db)
      .from("school_members")
      .select(
        `
        id,
        user_id,
        created_at,
        role,
        profiles!inner (
          full_name,
          email
        )
      `
      )
      .eq("school_id", schoolId)
      .in("role", ["admin", "teacher"])
      .order("created_at", { ascending: true });

    if (error) {
      return await fetchSchoolTeacherMembersFallback(schoolId);
    }

    const rows = (data ?? []) as {
      id: string;
      user_id: string;
      created_at: string;
      role: string;
      profiles:
        | { full_name: string | null; email: string | null }
        | { full_name: string | null; email: string | null }[]
        | null;
    }[];

    return rows
      .filter((r) => r.role === "teacher")
      .map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return {
          id: r.id,
          user_id: r.user_id,
          created_at: r.created_at,
          profileFullName: p?.full_name ?? null,
          profileEmail: p?.email ?? null,
        };
      });
  } catch {
    return await fetchSchoolTeacherMembersFallback(schoolId);
  }
}

export async function addTeacherAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const rawEmail = String(formData.get("email") ?? "").trim();
  const email = normalizeEmail(rawEmail);

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const schoolId = await getSchoolIdForUserWithAdmin(user.id);
  if (!schoolId) {
    return { ok: false, error: "No school found for your account." };
  }

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can manage teachers." };
  }

  const callerEmail = normalizeEmail(user.email ?? "");
  if (callerEmail && email === callerEmail) {
    return { ok: false, error: "You cannot add yourself as a teacher here." };
  }

  const profileId = await findProfileIdByEmail(email, admin);

  if (profileId) {
    const { data: existing } = await admin
      .from("school_members")
      .select("id, role")
      .eq("school_id", schoolId)
      .eq("user_id", profileId)
      .maybeSingle();

    if (existing) {
      const role = (existing as { role: string }).role;
      if (role === "admin") {
        return {
          ok: false,
          error:
            "This user is already a school administrator for your school.",
        };
      }
      if (role === "teacher") {
        return { ok: false, error: "This user is already a teacher at your school." };
      }
      if (role === "parent") {
        const { error: upErr } = await (admin as Db)
          .from("school_members")
          .update({ role: "teacher" })
          .eq("id", (existing as { id: string }).id);
        if (upErr) {
          return { ok: false, error: upErr.message || "Could not update membership." };
        }
        const { error: pErr } = await (admin as Db)
          .from("profiles")
          .update({ role: "teacher" } satisfies ProfileUpdate)
          .eq("id", profileId);
        if (pErr) {
          return {
            ok: false,
            error:
              pErr.message ||
              "Membership updated but profile role could not be set. Check SUPABASE_SERVICE_ROLE_KEY.",
          };
        }
        revalidatePath("/dashboard/teachers");
        return { ok: true, message: "Teacher role applied to existing member." };
      }
    }

    const { error: insErr } = await (admin as Db)
      .from("school_members")
      .insert({
        school_id: schoolId,
        user_id: profileId,
        role: "teacher",
      });

    if (insErr) {
      if (insErr.code === "23505") {
        return {
          ok: false,
          error: "This user is already linked to your school.",
        };
      }
      return { ok: false, error: insErr.message || "Could not add teacher." };
    }

    const { error: pErr } = await (admin as Db)
      .from("profiles")
      .update({ role: "teacher" } satisfies ProfileUpdate)
      .eq("id", profileId);
    if (pErr) {
      return {
        ok: false,
        error:
          pErr.message ||
          "Teacher was added but profile role could not be updated.",
      };
    }

    revalidatePath("/dashboard/teachers");
    return { ok: true, message: "Teacher added. They can sign in and open the teacher dashboard." };
  }

  try {
    const base = getPublicAppBaseUrl();
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: insErr } = await (admin as Db)
      .from("teacher_invitations")
      .insert({
        email,
        school_id: schoolId,
        class_id: null,
        subject: "",
        academic_year: "",
        token,
        expires_at: expiresAt,
      });

    if (insErr) {
      return {
        ok: false,
        error: insErr.message || "Could not create invitation.",
      };
    }

    const { data: school } = await admin
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle();
    const schoolName =
      (school as { name: string } | null)?.name?.trim() || "Your school";

    const inviteUrl = `${base}/accept-invite?token=${encodeURIComponent(token)}`;
    const emailResult = await sendTeacherInvitationEmail({
      to: email,
      inviteUrl,
      schoolName,
    });

    if (!emailResult.ok) {
      await (admin as Db).from("teacher_invitations").delete().eq("token", token);
      return { ok: false, error: emailResult.error };
    }

    revalidatePath("/dashboard/teachers");
    return {
      ok: true,
      message:
        "Invitation sent. They can open the link in their email to create a password and sign in as a teacher.",
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Invitation failed. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
    };
  }
}

export async function assignTeacherToClassAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const teacherId = String(formData.get("teacher_id") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const academicYear = String(formData.get("academic_year") ?? "").trim();

  if (!teacherId || !classId) {
    return { ok: false, error: "Teacher and class are required." };
  }
  if (!subjectId) {
    return { ok: false, error: "Subject is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can assign classes." };
  }

  const admin = createAdminClient();
  const { data: subjRow } = await admin
    .from("subjects")
    .select("name")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!subjRow) {
    return { ok: false, error: "Invalid subject for your school." };
  }

  const subjectName =
    (subjRow as { name: string }).name?.trim() || "General";

  const { data: cls } = await admin
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || (cls as { school_id: string }).school_id !== schoolId) {
    return { ok: false, error: "Invalid class for your school." };
  }

  const { data: subjectClassLink } = await admin
    .from("subject_classes")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("class_id", classId)
    .maybeSingle();
  if (!subjectClassLink) {
    return {
      ok: false,
      error:
        "This subject is not assigned to the selected class. Update subject–class mapping in Manage Subjects.",
    };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("email")
    .eq("id", teacherId)
    .maybeSingle();

  const teacherEmailRaw = (prof as { email: string | null } | null)?.email?.trim();
  if (!teacherEmailRaw) {
    return { ok: false, error: "Teacher not found." };
  }

  const emailNorm = normalizeEmail(teacherEmailRaw);

  const { data: mem } = await admin
    .from("school_members")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", teacherId)
    .eq("role", "teacher")
    .maybeSingle();

  const { data: invitation } = await admin
    .from("teacher_invitations")
    .select("id")
    .eq("school_id", schoolId)
    .eq("email", emailNorm)
    .not("used_at", "is", null)
    .maybeSingle();

  if (!mem && !invitation) {
    return { ok: false, error: "That user is not a teacher at your school." };
  }

  const { error } = await (admin as Db).from("teacher_assignments").insert({
    teacher_id: teacherId,
    school_id: schoolId,
    class_id: classId,
    subject_id: subjectId,
    subject: subjectName,
    academic_year: academicYear || "",
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "This teacher already has that class, subject, and year combination.",
      };
    }
    return { ok: false, error: error.message || "Could not save assignment." };
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/dashboard/subjects");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/attendance");
  revalidatePath("/teacher-dashboard/grades");
  revalidatePath("/teacher-dashboard/lessons");
  revalidatePath("/teacher-dashboard/report-cards");
  return { ok: true, message: "Assignment saved." };
}

export async function updateTeacherAssignmentAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const academicYear = String(formData.get("academic_year") ?? "").trim();

  if (!assignmentId || !classId) {
    return { ok: false, error: "Assignment and class are required." };
  }
  if (!subjectId) {
    return { ok: false, error: "Subject is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return {
      ok: false,
      error: "Only school administrators can update assignments.",
    };
  }

  const admin = createAdminClient();
  const { data: subjRow } = await admin
    .from("subjects")
    .select("name")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!subjRow) {
    return { ok: false, error: "Invalid subject for your school." };
  }

  const subjectName =
    (subjRow as { name: string }).name?.trim() || "General";

  const { data: existing } = await admin
    .from("teacher_assignments")
    .select("id, school_id, teacher_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Assignment not found." };
  }
  if ((existing as { school_id: string }).school_id !== schoolId) {
    return { ok: false, error: "Invalid assignment." };
  }

  const { data: cls } = await admin
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || (cls as { school_id: string }).school_id !== schoolId) {
    return { ok: false, error: "Invalid class for your school." };
  }

  const { data: subjectClassLink } = await admin
    .from("subject_classes")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("class_id", classId)
    .maybeSingle();
  if (!subjectClassLink) {
    return {
      ok: false,
      error:
        "This subject is not assigned to the selected class. Update subject–class mapping in Manage Subjects.",
    };
  }

  const { error } = await (admin as Db)
    .from("teacher_assignments")
    .update({
      class_id: classId,
      subject_id: subjectId,
      subject: subjectName,
      academic_year: academicYear || "",
    })
    .eq("id", assignmentId)
    .eq("school_id", schoolId);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "This teacher already has that class, subject, and year combination.",
      };
    }
    return { ok: false, error: error.message || "Could not update assignment." };
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/dashboard/subjects");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/attendance");
  revalidatePath("/teacher-dashboard/grades");
  revalidatePath("/teacher-dashboard/lessons");
  revalidatePath("/teacher-dashboard/report-cards");
  return { ok: true, message: "Assignment updated." };
}

export async function removeTeacherAssignmentAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  if (!assignmentId) {
    return { ok: false, error: "Missing assignment." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can remove assignments." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("school_id", schoolId);

  if (error) {
    return { ok: false, error: error.message || "Could not remove assignment." };
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/dashboard/subjects");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/attendance");
  revalidatePath("/teacher-dashboard/grades");
  revalidatePath("/teacher-dashboard/lessons");
  revalidatePath("/teacher-dashboard/report-cards");
  return { ok: true, message: "Assignment removed." };
}

export async function removeTeacherFromSchoolAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const membershipId = String(formData.get("membership_id") ?? "").trim();
  const teacherUserId = String(formData.get("teacher_user_id") ?? "").trim();

  if (!membershipId || !teacherUserId) {
    return { ok: false, error: "Missing teacher reference." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return { ok: false, error: "Only school administrators can remove teachers." };
  }

  const admin = createAdminClient();
  const { data: mem } = await admin
    .from("school_members")
    .select("id, user_id, role")
    .eq("id", membershipId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!mem || (mem as { role: string }).role !== "teacher") {
    return { ok: false, error: "Teacher membership not found." };
  }

  if ((mem as { user_id: string }).user_id !== teacherUserId) {
    return { ok: false, error: "Teacher mismatch." };
  }

  const { data: classRows } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId);
  const classIds = (classRows ?? []).map((r) => (r as { id: string }).id);

  if (classIds.length > 0) {
    await admin
      .from("teacher_gradebook_assignments")
      .delete()
      .eq("teacher_id", teacherUserId)
      .in("class_id", classIds);
    await admin
      .from("teacher_lessons")
      .delete()
      .eq("teacher_id", teacherUserId)
      .in("class_id", classIds);
  }

  await admin
    .from("teacher_attendance")
    .delete()
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherUserId);

  await admin
    .from("teacher_report_card_comments")
    .delete()
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherUserId);

  await admin
    .from("teacher_assignments")
    .delete()
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherUserId);

  const { error: delMemErr } = await admin
    .from("school_members")
    .delete()
    .eq("id", membershipId);

  if (delMemErr) {
    return { ok: false, error: delMemErr.message || "Could not remove teacher." };
  }

  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("role")
      .eq("id", teacherUserId)
      .maybeSingle();
    if ((prof as { role: string } | null)?.role === "teacher") {
      await (admin as Db)
        .from("profiles")
        .update({ role: "parent" } satisfies ProfileUpdate)
        .eq("id", teacherUserId);
    }
  } catch {
    /* profile update optional if key missing */
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/dashboard/subjects");
  return { ok: true, message: "Teacher removed from your school." };
}

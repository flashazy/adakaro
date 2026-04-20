"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTeacherDisplayName } from "@/lib/teacher-display-name";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import type { Database } from "@/types/supabase";
import {
  TEACHER_DEPARTMENTS,
  type SchoolTeacherMemberRow,
  type TeacherActionState,
  type TeacherDepartment,
} from "./types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/** Manual Database types omit `Relationships` required by Supabase v2 generics; use for typed payloads only. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow client insert/update resolves to `never` without generated Relationships
type Db = any;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Single year string like "2025" — not a range. */
function parseRequiredSingleCalendarYear(raw: string):
  | { ok: true; year: string }
  | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) {
    return { ok: false, error: "Academic year is required." };
  }
  if (!/^\d{4}$/.test(t)) {
    return {
      ok: false,
      error: "Academic year must be a four-digit year (e.g. 2025).",
    };
  }
  return { ok: true, year: t };
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
      .select("id, full_name, email, password_changed")
      .in("id", ids);

    const profList = (profs ?? []) as {
      id: string;
      full_name: string;
      email: string | null;
      password_changed: boolean | null;
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
        profilePasswordChanged: p?.password_changed !== false,
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
          email,
          password_changed
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
        | {
            full_name: string | null;
            email: string | null;
            password_changed: boolean | null;
          }
        | {
            full_name: string | null;
            email: string | null;
            password_changed: boolean | null;
          }[]
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
          profilePasswordChanged: p?.password_changed !== false,
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
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || fullName.length < 2) {
    return {
      ok: false,
      error: "Please enter the teacher's full name (at least 2 characters).",
    };
  }
  if (password.length < 8) {
    return {
      ok: false,
      error: "Password must be at least 8 characters.",
    };
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

  const normalized = normalizeTeacherDisplayName(fullName);
  if (!normalized) {
    return { ok: false, error: "Please enter a valid full name." };
  }

  const existingMembers =
    await fetchSchoolTeacherMembersForTeachersPage(schoolId);
  const nameDup = existingMembers.some(
    (m) => normalizeTeacherDisplayName(m.profileFullName ?? "") === normalized
  );
  if (nameDup) {
    return {
      ok: false,
      error: "A teacher with this name already exists in your school.",
    };
  }

  const userId = randomUUID();
  const syntheticEmail = `t.${userId.replace(/-/g, "")}@teachers.adakaro.app`;

  let createdUserId: string | null = null;
  try {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        id: userId,
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "teacher",
          password_changed: false,
        },
      });

    if (createErr || !created.user) {
      return {
        ok: false,
        error: createErr?.message || "Could not create the teacher account.",
      };
    }
    createdUserId = created.user.id;

    const { error: profErr } = await (admin as Db)
      .from("profiles")
      .update({
        full_name: fullName,
        role: "teacher",
        password_changed: false,
      } satisfies ProfileUpdate)
      .eq("id", createdUserId);

    if (profErr) {
      throw new Error(profErr.message || "Could not finalize profile.");
    }

    const { error: mErr } = await (admin as Db).from("school_members").insert({
      school_id: schoolId,
      user_id: createdUserId,
      role: "teacher",
    });

    if (mErr) {
      throw new Error(mErr.message || "Could not add teacher to your school.");
    }

    revalidatePath("/dashboard/teachers");
    return {
      ok: true,
      message:
        "Teacher account created. They should sign in using their full name (exactly as you entered) and this password, then choose a new password when prompted.",
    };
  } catch (e) {
    if (createdUserId) {
      try {
        await admin.auth.admin.deleteUser(createdUserId);
      } catch {
        /* */
      }
    }
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not create teacher. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
    };
  }
}

export interface BulkAddTeachersResult {
  ok: boolean;
  /** Total non-empty unique names parsed from the input (after normalisation). */
  attempted: number;
  /** Display names actually created in this batch. */
  created: string[];
  /** Display names skipped because a teacher with that name already exists. */
  skippedExisting: string[];
  /** Per-name errors from the auth/profile/membership layer. */
  failed: { name: string; error: string }[];
  /** Top-level error (auth, school, permissions, etc.). */
  error?: string;
}

/**
 * Bulk-create teacher accounts from a list of full names. All teachers in the
 * batch share the same temporary password and are created with
 * `password_changed = false`, so each must set a new password on first login —
 * exactly like the single-add flow.
 *
 * Names are deduped within the submission and any name that already matches an
 * existing teacher at the school is reported back as `skippedExisting`
 * instead of failing the whole batch.
 */
export async function bulkAddTeachersAction(input: {
  names: string[];
  password: string;
}): Promise<BulkAddTeachersResult> {
  const password = String(input?.password ?? "");
  if (password.length < 8) {
    return {
      ok: false,
      attempted: 0,
      created: [],
      skippedExisting: [],
      failed: [],
      error: "Password must be at least 8 characters.",
    };
  }

  // Trim, collapse whitespace via the shared display-name normaliser, drop
  // empties, and dedupe within the submission. We keep two parallel views:
  // the original (display) string and the normalised key used for matching.
  const seenKeys = new Set<string>();
  const cleaned: { display: string; key: string }[] = [];
  for (const raw of input?.names ?? []) {
    const display = String(raw ?? "").trim().replace(/\s+/g, " ");
    if (!display || display.length < 2) continue;
    const key = normalizeTeacherDisplayName(display);
    if (!key) continue;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    cleaned.push({ display, key });
  }

  if (cleaned.length === 0) {
    return {
      ok: false,
      attempted: 0,
      created: [],
      skippedExisting: [],
      failed: [],
      error: "Add at least one teacher name (one per line).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      attempted: cleaned.length,
      created: [],
      skippedExisting: [],
      failed: [],
      error: "Unauthorized.",
    };
  }

  const schoolId = await getSchoolIdForUserWithAdmin(user.id);
  if (!schoolId) {
    return {
      ok: false,
      attempted: cleaned.length,
      created: [],
      skippedExisting: [],
      failed: [],
      error: "No school found for your account.",
    };
  }

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return {
      ok: false,
      attempted: cleaned.length,
      created: [],
      skippedExisting: [],
      failed: [],
      error: "Only school administrators can manage teachers.",
    };
  }

  const admin = createAdminClient();

  // Pre-flight: load existing teacher names once so we can mark duplicates
  // before we create any auth users (which would otherwise be hard to roll
  // back if a duplicate is detected mid-batch).
  const existingMembers =
    await fetchSchoolTeacherMembersForTeachersPage(schoolId);
  const existingKeys = new Set(
    existingMembers
      .map((m) => normalizeTeacherDisplayName(m.profileFullName ?? ""))
      .filter(Boolean)
  );

  const skippedExisting: string[] = [];
  const created: string[] = [];
  const failed: { name: string; error: string }[] = [];

  // Sequential creation: each call hits Auth admin + profiles + school_members
  // and we want the per-row failure reporting to stay simple. Volume here is
  // expected to be small (a handful of teachers per batch), so the latency
  // hit is acceptable.
  for (const entry of cleaned) {
    if (existingKeys.has(entry.key)) {
      skippedExisting.push(entry.display);
      continue;
    }

    const userId = randomUUID();
    const syntheticEmail = `t.${userId.replace(/-/g, "")}@teachers.adakaro.app`;

    let createdUserId: string | null = null;
    try {
      const { data: createdAuth, error: createErr } =
        await admin.auth.admin.createUser({
          id: userId,
          email: syntheticEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: entry.display,
            role: "teacher",
            password_changed: false,
          },
        });

      if (createErr || !createdAuth.user) {
        failed.push({
          name: entry.display,
          error: createErr?.message || "Could not create teacher account.",
        });
        continue;
      }
      createdUserId = createdAuth.user.id;

      const { error: profErr } = await (admin as Db)
        .from("profiles")
        .update({
          full_name: entry.display,
          role: "teacher",
          password_changed: false,
        } satisfies ProfileUpdate)
        .eq("id", createdUserId);

      if (profErr) {
        throw new Error(profErr.message || "Could not finalize profile.");
      }

      const { error: mErr } = await (admin as Db)
        .from("school_members")
        .insert({
          school_id: schoolId,
          user_id: createdUserId,
          role: "teacher",
        });

      if (mErr) {
        throw new Error(
          mErr.message || "Could not add teacher to your school."
        );
      }

      created.push(entry.display);
      // Track the new key so a duplicate later in the same batch (defensive)
      // is also caught.
      existingKeys.add(entry.key);
    } catch (e) {
      if (createdUserId) {
        try {
          await admin.auth.admin.deleteUser(createdUserId);
        } catch {
          /* */
        }
      }
      failed.push({
        name: entry.display,
        error:
          e instanceof Error
            ? e.message
            : "Could not create teacher. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
      });
    }
  }

  if (created.length > 0) {
    revalidatePath("/dashboard/teachers");
  }

  return {
    ok: true,
    attempted: cleaned.length,
    created,
    skippedExisting,
    failed,
  };
}

export async function assignTeacherToClassAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const teacherId = String(formData.get("teacher_id") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const academicYearRaw = String(formData.get("academic_year") ?? "");
  const yearParsed = parseRequiredSingleCalendarYear(academicYearRaw);
  if (!yearParsed.ok) {
    return { ok: false, error: yearParsed.error };
  }
  const academicYear = yearParsed.year;

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
    .select("email, password_changed")
    .eq("id", teacherId)
    .maybeSingle();

  const profRow = prof as {
    email: string | null;
    password_changed?: boolean;
  } | null;
  const teacherEmailRaw = profRow?.email?.trim();
  if (!teacherEmailRaw) {
    return { ok: false, error: "Teacher not found." };
  }
  if (profRow?.password_changed === false) {
    return {
      ok: false,
      error:
        "That teacher has not activated their account yet. They must sign in and change their password before you can assign classes.",
    };
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
    academic_year: academicYear,
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

  revalidateAfterTeacherAssignmentMutations();
  return { ok: true, message: "Assignment saved." };
}

function revalidateAfterTeacherAssignmentMutations() {
  revalidatePath("/dashboard/teachers");
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard/subjects");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/attendance");
  revalidatePath("/teacher-dashboard/grades");
  revalidatePath("/teacher-dashboard/lessons");
  revalidatePath("/teacher-dashboard/report-cards");
}

/**
 * Create many class+subject assignments for one teacher (cartesian product of
 * selected classes × subjects). Skips pairs without a subject_classes link,
 * existing rows (same teacher, class, subject label, year), and unique violations.
 */
export async function bulkAssignTeacherClassesAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const teacherId = String(formData.get("teacher_id") ?? "").trim();
  const academicYearRaw = String(formData.get("academic_year") ?? "");
  const yearParsed = parseRequiredSingleCalendarYear(academicYearRaw);
  if (!yearParsed.ok) {
    return { ok: false, error: yearParsed.error };
  }
  const academicYear = yearParsed.year;

  const classIds = [
    ...new Set(
      formData
        .getAll("bulk_class_ids")
        .map((v) => String(v).trim())
        .filter(Boolean)
    ),
  ];
  const subjectIds = [
    ...new Set(
      formData
        .getAll("bulk_subject_ids")
        .map((v) => String(v).trim())
        .filter(Boolean)
    ),
  ];

  if (!teacherId) {
    return { ok: false, error: "Teacher is required." };
  }
  if (classIds.length === 0) {
    return { ok: false, error: "Select at least one class." };
  }
  if (subjectIds.length === 0) {
    return { ok: false, error: "Select at least one subject." };
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
      error: "Only school administrators can assign classes.",
    };
  }

  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profiles")
    .select("email, password_changed")
    .eq("id", teacherId)
    .maybeSingle();

  const profRow = prof as {
    email: string | null;
    password_changed?: boolean;
  } | null;
  const teacherEmailRaw = profRow?.email?.trim();
  if (!teacherEmailRaw) {
    return { ok: false, error: "Teacher not found." };
  }
  if (profRow?.password_changed === false) {
    return {
      ok: false,
      error:
        "That teacher has not activated their account yet. They must sign in and change their password before you can assign classes.",
    };
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

  const { data: classRows } = await admin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", classIds);

  const validClassIds = new Set(
    ((classRows ?? []) as { id: string }[]).map((r) => r.id)
  );
  const filteredClassIds = classIds.filter((id) => validClassIds.has(id));
  if (filteredClassIds.length === 0) {
    return { ok: false, error: "No valid classes for your school were selected." };
  }

  const { data: subjectRows } = await admin
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("id", subjectIds);

  const subjectNameById = new Map(
    ((subjectRows ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name?.trim() || "General",
    ])
  );
  const filteredSubjectIds = subjectIds.filter((id) => subjectNameById.has(id));
  if (filteredSubjectIds.length === 0) {
    return { ok: false, error: "No valid subjects for your school were selected." };
  }

  const { data: linkRows } = await admin
    .from("subject_classes")
    .select("class_id, subject_id")
    .in("class_id", filteredClassIds);

  const linkSet = new Set<string>();
  for (const r of (linkRows ?? []) as { class_id: string; subject_id: string }[]) {
    linkSet.add(`${r.class_id}|${r.subject_id}`);
  }

  const { data: existingRows } = await admin
    .from("teacher_assignments")
    .select("class_id, subject")
    .eq("teacher_id", teacherId)
    .eq("academic_year", academicYear);

  const existingKey = new Set(
    ((existingRows ?? []) as { class_id: string; subject: string | null }[]).map(
      (r) => `${r.class_id}|${(r.subject ?? "").trim().toLowerCase()}`
    )
  );

  let created = 0;
  let skippedDuplicates = 0;
  let skippedNoLink = 0;

  for (const classId of filteredClassIds) {
    for (const subjectId of filteredSubjectIds) {
      if (!linkSet.has(`${classId}|${subjectId}`)) {
        skippedNoLink++;
        continue;
      }
      const subjectName = subjectNameById.get(subjectId)!;
      const dedupeKey = `${classId}|${subjectName.toLowerCase()}`;
      if (existingKey.has(dedupeKey)) {
        skippedDuplicates++;
        continue;
      }

      const { error } = await (admin as Db).from("teacher_assignments").insert({
        teacher_id: teacherId,
        school_id: schoolId,
        class_id: classId,
        subject_id: subjectId,
        subject: subjectName,
        academic_year: academicYear,
      });

      if (error) {
        if (error.code === "23505") {
          skippedDuplicates++;
          existingKey.add(dedupeKey);
        } else {
          return {
            ok: false,
            error: error.message || "Could not save one or more assignments.",
          };
        }
      } else {
        created++;
        existingKey.add(dedupeKey);
      }
    }
  }

  if (created > 0) {
    revalidateAfterTeacherAssignmentMutations();
  }

  const skippedTotal = skippedDuplicates + skippedNoLink;
  let message: string;
  if (created === 0 && skippedTotal === 0) {
    message = "No assignments were created.";
  } else {
    message = `Created ${created} assignment${created === 1 ? "" : "s"}`;
    if (skippedDuplicates > 0) {
      message += `, skipped ${skippedDuplicates} duplicate${
        skippedDuplicates === 1 ? "" : "s"
      }`;
    }
    if (skippedNoLink > 0) {
      message += skippedDuplicates > 0 ? " and" : ",";
      message += ` skipped ${skippedNoLink} without a class–subject link`;
    }
    message += ".";
  }

  return { ok: true, message };
}

export async function updateTeacherAssignmentAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  const academicYearRaw = String(formData.get("academic_year") ?? "");
  const yearParsed = parseRequiredSingleCalendarYear(academicYearRaw);
  if (!yearParsed.ok) {
    return { ok: false, error: yearParsed.error };
  }
  const academicYear = yearParsed.year;

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
      academic_year: academicYear,
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

/**
 * Fetch department role assignments for all teachers in a school.
 * Uses the service role so admin UIs always see every row.
 */
export async function fetchTeacherDepartmentRolesForSchool(
  schoolId: string
): Promise<Record<string, TeacherDepartment[]>> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("teacher_department_roles")
      .select("user_id, department")
      .eq("school_id", schoolId);

    const rows = (data ?? []) as {
      user_id: string;
      department: TeacherDepartment;
    }[];

    const byUser: Record<string, TeacherDepartment[]> = {};
    for (const r of rows) {
      const list = byUser[r.user_id] ?? [];
      if (!list.includes(r.department)) list.push(r.department);
      byUser[r.user_id] = list;
    }
    for (const k of Object.keys(byUser)) {
      byUser[k].sort((a, b) => a.localeCompare(b));
    }
    return byUser;
  } catch {
    return {};
  }
}

function parseDepartmentList(formData: FormData): TeacherDepartment[] {
  const raw = formData.getAll("departments").map((v) => String(v).trim());
  const unique = Array.from(new Set(raw)).filter((v): v is TeacherDepartment =>
    (TEACHER_DEPARTMENTS as readonly string[]).includes(v)
  );
  return unique;
}

/**
 * Replace a teacher's department roles with the posted set. Only school
 * admins (or super admins) may call this.
 */
export async function setTeacherDepartmentRolesAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const teacherUserId = String(formData.get("teacher_user_id") ?? "").trim();
  if (!teacherUserId) {
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
    return {
      ok: false,
      error: "Only school administrators can manage department roles.",
    };
  }

  const admin = createAdminClient();
  const { data: mem } = await admin
    .from("school_members")
    .select("id, role")
    .eq("school_id", schoolId)
    .eq("user_id", teacherUserId)
    .maybeSingle();

  if (!mem || (mem as { role: string }).role !== "teacher") {
    return { ok: false, error: "That user is not a teacher at your school." };
  }

  const desired = parseDepartmentList(formData);

  const { data: existingRows } = await admin
    .from("teacher_department_roles")
    .select("id, department")
    .eq("school_id", schoolId)
    .eq("user_id", teacherUserId);

  const existing = (existingRows ?? []) as {
    id: string;
    department: TeacherDepartment;
  }[];
  const existingSet = new Set(existing.map((r) => r.department));
  const desiredSet = new Set(desired);

  const toInsert: TeacherDepartment[] = desired.filter(
    (d) => !existingSet.has(d)
  );
  const toDelete: string[] = existing
    .filter((r) => !desiredSet.has(r.department))
    .map((r) => r.id);

  if (toDelete.length > 0) {
    const { error: delErr } = await admin
      .from("teacher_department_roles")
      .delete()
      .in("id", toDelete);
    if (delErr) {
      return {
        ok: false,
        error: delErr.message || "Could not update department roles.",
      };
    }
  }

  if (toInsert.length > 0) {
    const rows = toInsert.map((department) => ({
      school_id: schoolId,
      user_id: teacherUserId,
      department,
    }));
    const { error: insErr } = await (admin as Db)
      .from("teacher_department_roles")
      .insert(rows);
    if (insErr) {
      return {
        ok: false,
        error: insErr.message || "Could not save department roles.",
      };
    }
  }

  // Coordinator is a promotion of Academic. If Academic is being removed,
  // clear any lingering coordinator assignments so the role layers stay
  // consistent.
  if (!desiredSet.has("academic") && existingSet.has("academic")) {
    await admin
      .from("teacher_coordinators")
      .delete()
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherUserId);
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/teacher-dashboard/coordinator");
  return { ok: true, message: "Department roles updated." };
}

/**
 * Fetch all coordinator class assignments for all teachers in a school.
 * Returns a map of teacher user_id -> array of class ids the teacher coordinates.
 */
export async function fetchTeacherCoordinatorClassesForSchool(
  schoolId: string
): Promise<Record<string, string[]>> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("teacher_coordinators")
      .select("teacher_id, class_id")
      .eq("school_id", schoolId);

    const rows = (data ?? []) as {
      teacher_id: string;
      class_id: string;
    }[];

    const byTeacher: Record<string, string[]> = {};
    for (const r of rows) {
      const list = byTeacher[r.teacher_id] ?? [];
      if (!list.includes(r.class_id)) list.push(r.class_id);
      byTeacher[r.teacher_id] = list;
    }
    return byTeacher;
  } catch {
    return {};
  }
}

/**
 * Replace a teacher's coordinator class assignments with the posted set.
 *
 * Only allowed when the teacher holds the `academic` department role.
 * Does NOT modify `teacher_department_roles` — Academic behaviour is untouched.
 */
export async function setTeacherCoordinatorClassesAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const teacherUserId = String(formData.get("teacher_user_id") ?? "").trim();
  if (!teacherUserId) {
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
    return {
      ok: false,
      error:
        "Only school administrators can assign coordinator classes.",
    };
  }

  const admin = createAdminClient();

  const { data: mem } = await admin
    .from("school_members")
    .select("id, role")
    .eq("school_id", schoolId)
    .eq("user_id", teacherUserId)
    .maybeSingle();

  if (!mem || (mem as { role: string }).role !== "teacher") {
    return { ok: false, error: "That user is not a teacher at your school." };
  }

  const { data: academicRow } = await admin
    .from("teacher_department_roles")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", teacherUserId)
    .eq("department", "academic")
    .maybeSingle();

  if (!academicRow) {
    return {
      ok: false,
      error:
        "Only teachers with the Academic role can be promoted to Coordinator. Give this teacher the Academic role first.",
    };
  }

  const rawClassIds = formData.getAll("class_ids").map((v) => String(v).trim());
  const desired = Array.from(new Set(rawClassIds)).filter(Boolean);

  if (desired.length > 0) {
    const { data: validClasses } = await admin
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .in("id", desired);
    const validIds = new Set(
      ((validClasses ?? []) as { id: string }[]).map((c) => c.id)
    );
    for (const cid of desired) {
      if (!validIds.has(cid)) {
        return {
          ok: false,
          error: "One or more selected classes do not belong to your school.",
        };
      }
    }
  }

  const { data: existingRows } = await admin
    .from("teacher_coordinators")
    .select("id, class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherUserId);

  const existing = (existingRows ?? []) as {
    id: string;
    class_id: string;
  }[];
  const existingSet = new Set(existing.map((r) => r.class_id));
  const desiredSet = new Set(desired);

  const toInsert: string[] = desired.filter((c) => !existingSet.has(c));
  const toDelete: string[] = existing
    .filter((r) => !desiredSet.has(r.class_id))
    .map((r) => r.id);

  if (toDelete.length > 0) {
    const { error: delErr } = await admin
      .from("teacher_coordinators")
      .delete()
      .in("id", toDelete);
    if (delErr) {
      return {
        ok: false,
        error:
          delErr.message || "Could not update coordinator assignments.",
      };
    }
  }

  if (toInsert.length > 0) {
    const rows = toInsert.map((classId) => ({
      school_id: schoolId,
      teacher_id: teacherUserId,
      class_id: classId,
      assigned_by: user.id,
    }));
    const { error: insErr } = await (admin as Db)
      .from("teacher_coordinators")
      .insert(rows);
    if (insErr) {
      return {
        ok: false,
        error: insErr.message || "Could not save coordinator assignments.",
      };
    }
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/coordinator");
  return { ok: true, message: "Coordinator classes updated." };
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

  await admin
    .from("teacher_department_roles")
    .delete()
    .eq("school_id", schoolId)
    .eq("user_id", teacherUserId);

  await admin
    .from("teacher_coordinators")
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

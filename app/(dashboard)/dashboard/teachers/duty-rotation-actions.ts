"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  computeDutyEndDate,
  listTeacherDutyAssignmentsForSchool,
} from "@/lib/teacher-on-duty/teacher-duty";
import type { TeacherDutyAssignment } from "@/lib/teacher-on-duty/types";
import type { TeacherActionState } from "./types";
import { assertSchoolAdminForUser } from "./actions";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DURATION_DAYS = 30;
const MAX_NOTES = 2000;

function parseDate(raw: string): string | null {
  const d = raw.trim();
  return DATE_RE.test(d) ? d : null;
}

export async function fetchTeacherDutyAssignmentsAction(): Promise<
  TeacherDutyAssignment[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return [];

  const allowed = await assertSchoolAdminForUser(user.id, schoolId);
  if (!allowed) return [];

  return listTeacherDutyAssignmentsForSchool(schoolId);
}

export async function assignTeacherDutyRotationAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  const allowed = await assertSchoolAdminForUser(user.id, schoolId);
  if (!allowed) {
    return { ok: false, error: "Only school admins can assign duty rotations." };
  }

  const startDate = parseDate(String(formData.get("start_date") ?? ""));
  if (!startDate) {
    return { ok: false, error: "Valid start date is required." };
  }

  const durationRaw = Number(formData.get("duration_days"));
  if (!Number.isFinite(durationRaw) || durationRaw < 1 || durationRaw > MAX_DURATION_DAYS) {
    return {
      ok: false,
      error: `Duration must be between 1 and ${MAX_DURATION_DAYS} days.`,
    };
  }

  const durationDays = Math.floor(durationRaw);
  const endDate = computeDutyEndDate(startDate, durationDays);

  const teacherIds = formData
    .getAll("teacher_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (teacherIds.length === 0) {
    return { ok: false, error: "Select at least one teacher." };
  }

  const notesRaw = String(formData.get("notes") ?? "").trim();
  if (notesRaw.length > MAX_NOTES) {
    return { ok: false, error: "Notes must be 2,000 characters or fewer." };
  }
  const notes = notesRaw || null;

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "teacher")
    .in("user_id", teacherIds);

  const memberIds = new Set(
    ((members ?? []) as { user_id: string }[]).map((m) => m.user_id)
  );

  const { data: joinedProfiles } = await admin
    .from("profiles")
    .select("id")
    .in("id", teacherIds)
    .not("last_sign_in_at", "is", null);

  const joinedIds = new Set(
    ((joinedProfiles ?? []) as { id: string }[]).map((p) => p.id)
  );

  const toInsert = teacherIds.filter(
    (id) => memberIds.has(id) && joinedIds.has(id)
  );
  if (toInsert.length === 0) {
    return {
      ok: false,
      error:
        "Only teachers who have logged in at least once can be assigned to duty. Pending accounts are not eligible.",
    };
  }
  if (toInsert.length < teacherIds.length) {
    return {
      ok: false,
      error:
        "One or more selected teachers have not logged in yet. Remove pending accounts and try again.",
    };
  }

  const rows = toInsert.map((teacherId) => ({
    school_id: schoolId,
    teacher_id: teacherId,
    start_date: startDate,
    end_date: endDate,
    is_active: true,
    created_by: user.id,
    notes,
  }));

  const { error } = await admin.from("teacher_duty_assignments").insert(rows as never);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/dashboard/duty-book");
  revalidatePath("/teacher-dashboard");

  const count = toInsert.length;
  return {
    ok: true,
    message: `${count} teacher${count === 1 ? "" : "s"} assigned on duty until ${endDate}.`,
  };
}

export async function revokeTeacherDutyAssignmentAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) return { ok: false, error: "No school found." };

  const allowed = await assertSchoolAdminForUser(user.id, schoolId);
  if (!allowed) {
    return { ok: false, error: "Only school admins can revoke duty assignments." };
  }

  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  if (!assignmentId) {
    return { ok: false, error: "Assignment not found." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_duty_assignments")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    } as never)
    .eq("id", assignmentId)
    .eq("school_id", schoolId)
    .is("revoked_at", null);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/teachers");
  revalidatePath("/dashboard/duty-book");
  revalidatePath("/teacher-dashboard");

  return { ok: true, message: "Duty assignment revoked." };
}

export async function revokeTeacherDutyAssignmentsBulkAction(
  _prev: TeacherActionState | null,
  formData: FormData
): Promise<TeacherActionState> {
  const ids = formData
    .getAll("assignment_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return { ok: false, error: "No assignments selected." };
  }

  let lastError: string | null = null;
  let revoked = 0;
  for (const id of ids) {
    const fd = new FormData();
    fd.set("assignment_id", id);
    const res = await revokeTeacherDutyAssignmentAction(null, fd);
    if (res.ok) revoked += 1;
    else lastError = res.error ?? "Could not revoke.";
  }

  if (revoked === 0) {
    return { ok: false, error: lastError ?? "Could not revoke assignments." };
  }

  return {
    ok: true,
    message: `Revoked ${revoked} assignment${revoked === 1 ? "" : "s"}.`,
  };
}

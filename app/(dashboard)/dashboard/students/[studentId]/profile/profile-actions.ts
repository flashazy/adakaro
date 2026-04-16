"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { STUDENT_AVATAR_MAX_BYTES } from "@/lib/student-avatar-canvas";
import type { Database } from "@/types/supabase";

type Term = "Term 1" | "Term 2";

async function requireSchoolAdminForStudent(studentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const { data: studentRow, error: stErr } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .maybeSingle();

  const student = studentRow as { id: string; school_id: string } | null;

  if (stErr || !student) {
    return { ok: false as const, error: "Student not found." };
  }

  const { data: isAdmin, error: rpcErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: student.school_id } as never
  );

  if (rpcErr || !isAdmin) {
    return { ok: false as const, error: "Only school admins can manage student profiles." };
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
  };
}

function revalidateStudentProfile(studentId: string) {
  revalidatePath(`/dashboard/students/${studentId}/profile`);
  revalidatePath("/dashboard/students");
}

export async function upsertStudentAcademicRecord(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const academicYear = Number(formData.get("academic_year"));
  const term = String(formData.get("term") ?? "").trim() as Term;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const specialNeeds =
    String(formData.get("special_needs") ?? "").trim() || null;

  if (!studentId) return { error: "Missing student." };
  if (term !== "Term 1" && term !== "Term 2") {
    return { error: "Term must be Term 1 or Term 2." };
  }
  if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) {
    return { error: "Enter a valid academic year." };
  }

  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  const row: Database["public"]["Tables"]["student_academic_records"]["Insert"] =
    {
      student_id: studentId,
      academic_year: academicYear,
      term,
      notes,
      special_needs: specialNeeds,
      created_by: gate.userId,
    };

  if (id) {
    const { error } = await gate.supabase
      .from("student_academic_records")
      .update({
        academic_year: academicYear,
        term,
        notes,
        special_needs: specialNeeds,
      } as never)
      .eq("id", id)
      .eq("student_id", studentId);
    if (error) return { error: error.message };
  } else {
    const { error } = await gate.supabase
      .from("student_academic_records")
      .insert(row as never);
    if (error) {
      if (error.code === "23505") {
        return {
          error:
            "A record already exists for this year and term. Edit that record instead.",
        };
      }
      return { error: error.message };
    }
  }

  revalidateStudentProfile(studentId);
  return { success: true as const };
}

export async function upsertStudentDisciplineRecord(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const incidentDate = String(formData.get("incident_date") ?? "").trim();
  const incidentType = String(formData.get("incident_type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const actionTaken =
    String(formData.get("action_taken") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "pending").trim();
  const resolvedDateRaw = String(formData.get("resolved_date") ?? "").trim();

  const allowedTypes = [
    "warning",
    "detention",
    "suspension",
    "expulsion",
    "other",
  ] as const;
  const allowedStatus = ["pending", "resolved", "appealed"] as const;

  if (!studentId) return { error: "Missing student." };
  if (!incidentDate) return { error: "Incident date is required." };
  if (!allowedTypes.includes(incidentType as (typeof allowedTypes)[number])) {
    return { error: "Invalid incident type." };
  }
  if (!description) return { error: "Description is required." };
  if (!allowedStatus.includes(status as (typeof allowedStatus)[number])) {
    return { error: "Invalid status." };
  }

  const resolvedDate =
    status === "resolved" && resolvedDateRaw
      ? resolvedDateRaw
      : status === "resolved"
        ? incidentDate
        : null;

  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  if (id) {
    const { error } = await gate.supabase
      .from("student_discipline_records")
      .update({
        incident_date: incidentDate,
        incident_type: incidentType,
        description,
        action_taken: actionTaken,
        status,
        resolved_date: resolvedDate,
      } as never)
      .eq("id", id)
      .eq("student_id", studentId);
    if (error) return { error: error.message };
  } else {
    const { error } = await gate.supabase
      .from("student_discipline_records")
      .insert({
        student_id: studentId,
        incident_date: incidentDate,
        incident_type: incidentType,
        description,
        action_taken: actionTaken,
        status,
        resolved_date: resolvedDate,
        recorded_by: gate.userId,
      } as never);
    if (error) return { error: error.message };
  }

  revalidateStudentProfile(studentId);
  return { success: true as const };
}

export async function upsertStudentHealthRecord(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const condition = String(formData.get("condition") ?? "").trim();
  const severityRaw = String(formData.get("severity") ?? "").trim();
  const medication = String(formData.get("medication") ?? "").trim() || null;
  const specialCareNotes =
    String(formData.get("special_care_notes") ?? "").trim() || null;
  const emergencyPhone =
    String(formData.get("emergency_contact_phone") ?? "").trim() || null;

  const allowedSev = ["", "mild", "moderate", "severe"] as const;
  if (!studentId) return { error: "Missing student." };
  if (!condition) return { error: "Condition is required." };
  if (!allowedSev.includes(severityRaw as (typeof allowedSev)[number])) {
    return { error: "Invalid severity." };
  }
  const severity =
    severityRaw === "" ? null : (severityRaw as "mild" | "moderate" | "severe");

  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  if (id) {
    const { error } = await gate.supabase
      .from("student_health_records")
      .update({
        condition,
        severity,
        medication,
        special_care_notes: specialCareNotes,
        emergency_contact_phone: emergencyPhone,
      } as never)
      .eq("id", id)
      .eq("student_id", studentId);
    if (error) return { error: error.message };
  } else {
    const { error } = await gate.supabase.from("student_health_records").insert({
      student_id: studentId,
      condition,
      severity,
      medication,
      special_care_notes: specialCareNotes,
      emergency_contact_phone: emergencyPhone,
      recorded_by: gate.userId,
    } as never);
    if (error) return { error: error.message };
  }

  revalidateStudentProfile(studentId);
  return { success: true as const };
}

export async function upsertStudentFinanceRecord(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const academicYear = Number(formData.get("academic_year"));
  const term = String(formData.get("term") ?? "").trim() as Term;
  const feeBalance = Number(formData.get("fee_balance"));
  const scholarshipAmount = Number(formData.get("scholarship_amount"));
  const scholarshipType =
    String(formData.get("scholarship_type") ?? "").trim() || null;
  const paymentNotes =
    String(formData.get("payment_notes") ?? "").trim() || null;

  if (!studentId) return { error: "Missing student." };
  if (term !== "Term 1" && term !== "Term 2") {
    return { error: "Term must be Term 1 or Term 2." };
  }
  if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) {
    return { error: "Enter a valid academic year." };
  }
  if (!Number.isFinite(feeBalance) || feeBalance < 0) {
    return { error: "Fee balance must be a valid non‑negative number." };
  }
  if (!Number.isFinite(scholarshipAmount) || scholarshipAmount < 0) {
    return { error: "Scholarship amount must be a valid non‑negative number." };
  }

  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  const base = {
    student_id: studentId,
    academic_year: academicYear,
    term,
    fee_balance: feeBalance,
    scholarship_amount: scholarshipAmount,
    scholarship_type: scholarshipType,
    payment_notes: paymentNotes,
    updated_by: gate.userId,
  };

  if (id) {
    const { error } = await gate.supabase
      .from("student_finance_records")
      .update(base as never)
      .eq("id", id)
      .eq("student_id", studentId);
    if (error) return { error: error.message };
  } else {
    const { error } = await gate.supabase
      .from("student_finance_records")
      .insert(base as never);
    if (error) {
      if (error.code === "23505") {
        return {
          error:
            "A finance row already exists for this year and term. Edit that row instead.",
        };
      }
      return { error: error.message };
    }
  }

  revalidateStudentProfile(studentId);
  return { success: true as const };
}

const STUDENT_AVATAR_OBJECT_NAMES = [
  "avatar.webp",
  "avatar.jpg",
  "avatar.png",
] as const;

export type StudentAvatarObjectName = (typeof STUDENT_AVATAR_OBJECT_NAMES)[number];

function publicStudentAvatarUrl(
  studentId: string,
  objectName: StudentAvatarObjectName
): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const rev = Date.now();
  return `${base}/storage/v1/object/public/student-avatars/${studentId}/${objectName}?rev=${rev}`;
}

/** Call after a successful storage upload so `avatar_url` matches the object on disk. */
export async function commitStudentAvatar(
  studentId: string,
  objectName: StudentAvatarObjectName
): Promise<{ error?: string; ok?: true }> {
  if (!STUDENT_AVATAR_OBJECT_NAMES.includes(objectName)) {
    return { error: "Invalid photo file name." };
  }
  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  const url = publicStudentAvatarUrl(studentId, objectName);
  const { error } = await gate.supabase
    .from("students")
    .update({ avatar_url: url } as never)
    .eq("id", studentId);

  if (error) return { error: error.message };

  revalidateStudentProfile(studentId);
  return { ok: true as const };
}

/**
 * Uploads the cropped avatar using the service role so storage RLS cannot block
 * school admins (client-side storage uploads still evaluate storage policies).
 */
export async function uploadStudentAvatar(
  studentId: string,
  formData: FormData
): Promise<{ error?: string; ok?: true }> {
  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  const raw = formData.get("avatar");
  if (!(raw instanceof Blob) || raw.size === 0) {
    return { error: "No photo file was uploaded." };
  }
  if (raw.size > STUDENT_AVATAR_MAX_BYTES) {
    return { error: "Image must be 2MB or smaller." };
  }

  const mime = raw.type;
  const objectName: StudentAvatarObjectName | null =
    mime === "image/webp"
      ? "avatar.webp"
      : mime === "image/jpeg"
        ? "avatar.jpg"
        : mime === "image/png"
          ? "avatar.png"
          : null;

  if (!objectName) {
    return { error: "Invalid image type (use WebP, JPEG, or PNG)." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Server storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the app environment.",
    };
  }

  const storagePath = `${studentId}/${objectName}`;
  const paths = STUDENT_AVATAR_OBJECT_NAMES.map((n) => `${studentId}/${n}`);
  await admin.storage.from("student-avatars").remove(paths);

  const buf = await raw.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from("student-avatars")
    .upload(storagePath, buf, {
      upsert: true,
      contentType: mime,
      cacheControl: "3600",
    });

  if (upErr) {
    return {
      error:
        upErr.message.includes("Bucket not found") || upErr.message.includes("not found")
          ? `${upErr.message} Create the student-avatars bucket (migration 00079) in Supabase.`
          : upErr.message,
    };
  }

  const url = publicStudentAvatarUrl(studentId, objectName);
  const { error: dbErr } = await gate.supabase
    .from("students")
    .update({ avatar_url: url } as never)
    .eq("id", studentId);

  if (dbErr) return { error: dbErr.message };

  revalidateStudentProfile(studentId);
  return { ok: true as const };
}

export async function clearStudentAvatar(
  studentId: string
): Promise<{ error?: string; ok?: true }> {
  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  const paths = STUDENT_AVATAR_OBJECT_NAMES.map((n) => `${studentId}/${n}`);
  try {
    const admin = createAdminClient();
    await admin.storage.from("student-avatars").remove(paths);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Server storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the app environment.",
    };
  }

  const { error } = await gate.supabase
    .from("students")
    .update({ avatar_url: null } as never)
    .eq("id", studentId);

  if (error) return { error: error.message };

  revalidateStudentProfile(studentId);
  return { ok: true as const };
}

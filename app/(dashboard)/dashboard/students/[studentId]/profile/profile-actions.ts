"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUserRecordStudentPayment } from "@/lib/payments/record-permission.server";
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

/** School admins, or finance/accounts staff (same policy as recording fee payments). */
async function requireStudentFinanceRecordEditor(studentId: string) {
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
  if (!rpcErr && isAdmin === true) {
    return {
      ok: true as const,
      supabase,
      userId: user.id,
    };
  }

  if (await canUserRecordStudentPayment(supabase, user.id, student.school_id)) {
    return {
      ok: true as const,
      supabase,
      userId: user.id,
    };
  }

  return {
    ok: false as const,
    error: "You do not have permission to manage term finance snapshots.",
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

const MAX_FINANCE_NOTE_CHARS = 20_000;

export async function upsertStudentFinanceNote(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!studentId) return { error: "Missing student." };
  if (!body) return { error: "Note cannot be empty." };
  if (body.length > MAX_FINANCE_NOTE_CHARS) {
    return { error: "Note is too long." };
  }

  const gate = await requireStudentFinanceRecordEditor(studentId);
  if (!gate.ok) return { error: gate.error };

  if (id) {
    const { error } = await gate.supabase
      .from("student_finance_notes")
      .update({ body } as never)
      .eq("id", id)
      .eq("student_id", studentId);
    if (error) return { error: error.message };
  } else {
    const { error } = await gate.supabase.from("student_finance_notes").insert({
      student_id: studentId,
      body,
      created_by: gate.userId,
    } as never);
    if (error) return { error: error.message };
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

const STUDENT_RECORD_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

const STUDENT_RECORD_ATTACHMENT_MIMES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function resolveAttachmentMime(file: Blob, fileName: string): string | null {
  if (file.type && STUDENT_RECORD_ATTACHMENT_MIMES[file.type]) {
    return file.type;
  }
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

async function requireStudentAttachmentUploader(studentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const { data: studentRow, error: stErr } = await supabase
    .from("students")
    .select("id, school_id, class_id")
    .eq("id", studentId)
    .maybeSingle();

  const student = studentRow as
    | { id: string; school_id: string; class_id: string }
    | null;

  if (stErr || !student) {
    return { ok: false as const, error: "Student not found." };
  }

  const { data: isAdmin, error: adminErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: student.school_id } as never
  );
  if (!adminErr && isAdmin) {
    return {
      ok: true as const,
      supabase,
      userId: user.id,
      schoolId: student.school_id,
      classId: student.class_id,
    };
  }

  const { data: isSuper, error: superErr } = await supabase.rpc(
    "is_super_admin"
  );
  if (!superErr && isSuper) {
    return {
      ok: true as const,
      supabase,
      userId: user.id,
      schoolId: student.school_id,
      classId: student.class_id,
    };
  }

  const { data: forClass, error: classErr } = await supabase.rpc(
    "is_teacher_for_class",
    { p_class_id: student.class_id } as never
  );
  if (classErr || !forClass) {
    return {
      ok: false as const,
      error: "Only school admins or assigned teachers can upload attachments.",
    };
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    schoolId: student.school_id,
    classId: student.class_id,
  };
}

function sanitizeAttachmentFileStem(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\-]+/g, "_");
  return base.slice(0, 120) || "file";
}

function attachmentStoragePath(
  schoolId: string,
  studentId: string,
  recordType: "discipline" | "health",
  originalName: string
): string {
  const stem = sanitizeAttachmentFileStem(originalName);
  const unique = crypto.randomUUID();
  return `${schoolId}/${studentId}/${recordType}/${unique}_${stem}`;
}

async function assertAttachmentBelongsToStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  attachmentId: string,
  studentId: string
): Promise<
  | { ok: true; file_url: string; file_name: string }
  | { ok: false; error: string }
> {
  const { data: row, error } = await supabase
    .from("student_record_attachments")
    .select("id, record_id, record_type, file_url, file_name")
    .eq("id", attachmentId)
    .maybeSingle();

  const att = row as
    | {
        id: string;
        record_id: string;
        record_type: string;
        file_url: string;
        file_name: string;
      }
    | null;

  if (error || !att) {
    return { ok: false, error: "Attachment not found." };
  }

  if (att.record_type === "discipline") {
    const { data: dr } = await supabase
      .from("student_discipline_records")
      .select("student_id")
      .eq("id", att.record_id)
      .maybeSingle();
    const sid = (dr as { student_id: string } | null)?.student_id;
    if (sid !== studentId) {
      return { ok: false, error: "Attachment not found." };
    }
  } else if (att.record_type === "health") {
    const { data: hr } = await supabase
      .from("student_health_records")
      .select("student_id")
      .eq("id", att.record_id)
      .maybeSingle();
    const sid = (hr as { student_id: string } | null)?.student_id;
    if (sid !== studentId) {
      return { ok: false, error: "Attachment not found." };
    }
  } else {
    return { ok: false, error: "Invalid attachment." };
  }

  return { ok: true, file_url: att.file_url, file_name: att.file_name };
}

export async function uploadStudentRecordAttachment(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const recordId = String(formData.get("record_id") ?? "").trim();
  const recordType = String(formData.get("record_type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!studentId) return { error: "Missing student." };
  if (!recordId) return { error: "Missing record." };
  if (recordType !== "discipline" && recordType !== "health") {
    return { error: "Invalid record type." };
  }

  const gate = await requireStudentAttachmentUploader(studentId);
  if (!gate.ok) return { error: gate.error };

  if (recordType === "discipline") {
    const { data: dr } = await gate.supabase
      .from("student_discipline_records")
      .select("student_id")
      .eq("id", recordId)
      .maybeSingle();
    if ((dr as { student_id: string } | null)?.student_id !== studentId) {
      return { error: "Record not found for this student." };
    }
  } else {
    const { data: hr } = await gate.supabase
      .from("student_health_records")
      .select("student_id")
      .eq("id", recordId)
      .maybeSingle();
    if ((hr as { student_id: string } | null)?.student_id !== studentId) {
      return { error: "Record not found for this student." };
    }
  }

  const raw = formData.get("file");
  if (!(raw instanceof Blob) || raw.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (raw.size > STUDENT_RECORD_ATTACHMENT_MAX_BYTES) {
    return { error: "File must be 5MB or smaller." };
  }

  const origName =
    raw instanceof File && raw.name.trim()
      ? raw.name.trim()
      : "upload.bin";

  const mime = resolveAttachmentMime(raw, origName);
  if (!mime || !STUDENT_RECORD_ATTACHMENT_MIMES[mime]) {
    return {
      error: "Unsupported file type (use PDF, JPG, PNG, DOC, or DOCX).",
    };
  }

  const displayName =
    origName === "upload.bin"
      ? `upload${STUDENT_RECORD_ATTACHMENT_MIMES[mime]}`
      : origName;

  const storagePath = attachmentStoragePath(
    gate.schoolId,
    studentId,
    recordType,
    displayName
  );

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

  const buf = await raw.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from("student-record-attachments")
    .upload(storagePath, buf, {
      upsert: false,
      contentType: mime,
      cacheControl: "3600",
    });

  if (upErr) {
    return {
      error:
        upErr.message.includes("Bucket not found") || upErr.message.includes("not found")
          ? `${upErr.message} Apply migration 00081_student_record_attachments in Supabase.`
          : upErr.message,
    };
  }

  const { error: insErr } = await gate.supabase
    .from("student_record_attachments")
    .insert({
      record_id: recordId,
      record_type: recordType,
      file_name: displayName,
      file_url: storagePath,
      file_size: raw.size,
      mime_type: mime,
      description,
      uploaded_by: gate.userId,
    } as never);

  if (insErr) {
    await admin.storage.from("student-record-attachments").remove([storagePath]);
    return { error: insErr.message };
  }

  revalidateStudentProfile(studentId);
  return { success: true as const };
}

export async function deleteStudentRecordAttachment(
  formData: FormData
): Promise<{ error?: string; success?: true }> {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const attachmentId = String(formData.get("attachment_id") ?? "").trim();

  if (!studentId || !attachmentId) {
    return { error: "Missing fields." };
  }

  const gate = await requireSchoolAdminForStudent(studentId);
  if (!gate.ok) return { error: gate.error };

  const check = await assertAttachmentBelongsToStudent(
    gate.supabase,
    attachmentId,
    studentId
  );
  if (!check.ok) return { error: check.error };

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

  await admin.storage
    .from("student-record-attachments")
    .remove([check.file_url]);

  const { error: delErr } = await gate.supabase
    .from("student_record_attachments")
    .delete()
    .eq("id", attachmentId);

  if (delErr) return { error: delErr.message };

  revalidateStudentProfile(studentId);
  return { success: true as const };
}

export async function signStudentRecordAttachmentUrl(
  attachmentId: string,
  studentId: string
): Promise<{ error?: string; url?: string }> {
  if (!attachmentId || !studentId) {
    return { error: "Missing fields." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const check = await assertAttachmentBelongsToStudent(
    supabase,
    attachmentId,
    studentId
  );
  if (!check.ok) return { error: check.error };

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

  const { data: signed, error: signErr } = await admin.storage
    .from("student-record-attachments")
    .createSignedUrl(check.file_url, 120);

  if (signErr || !signed?.signedUrl) {
    return { error: signErr?.message ?? "Could not create link." };
  }

  return { url: signed.signedUrl };
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

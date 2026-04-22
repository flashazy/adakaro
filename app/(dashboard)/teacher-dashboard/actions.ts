"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import {
  orderStudentsByGenderThenName,
  sortStudentsByGenderThenName,
} from "@/lib/student-list-order";
import {
  duplicateMajorExamMessage,
  inferMajorExamTypeFromTitle,
  parseGradebookExamType,
} from "@/lib/gradebook-major-exams";
import type { SubjectEnrollmentTerm } from "@/lib/student-subject-enrollment";
import { parseSubjectEnrollmentTerm } from "@/lib/student-subject-enrollment";
import {
  getCurrentAcademicYearAndTerm,
  getStudentsForSubject,
} from "@/lib/student-subject-enrollment-queries";
import { resolveClassCluster } from "@/lib/class-cluster";

type AttendanceStatus = "present" | "absent" | "late";

/** Manual widen — admin insert/upsert typing without full Relationships. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Postgres numeric / JSON may arrive as string; normalize for UI. */
function normalizeScoreValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/**
 * Which `class_id` values to load gradebook assignments for in the Marks UI.
 * Parent / standalone: only that class (parent holds cross-stream exams).
 * Child stream: that stream plus its parent so exams created on the parent
 * still appear when the teacher switches to their own class.
 */
async function gradebookAssignmentClassIdsForSelection(
  admin: Db,
  classId: string
): Promise<string[]> {
  const { data: row } = await admin
    .from("classes")
    .select("id, parent_class_id")
    .eq("id", classId)
    .maybeSingle();

  const self = row as { id: string; parent_class_id: string | null } | null;
  if (!self) return [classId];
  if (self.parent_class_id) {
    return [classId, self.parent_class_id];
  }
  return [classId];
}

async function assertTeacherForClass(
  userId: string,
  classId: string
): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  // Multi-stream: a teacher assigned to FORM 1A should be able to act on the
  // parent FORM ONE class (cross-stream exams) and vice versa. We resolve
  // the cluster and treat any assignment inside the cluster as qualifying.
  const cluster = await resolveClassCluster(admin, classId);
  const { data: row } = await admin
    .from("teacher_assignments")
    .select("school_id")
    .eq("teacher_id", userId)
    .in("class_id", cluster.classIds)
    .limit(1)
    .maybeSingle();

  const schoolId = (row as { school_id: string } | null)?.school_id;
  if (!schoolId) {
    return { ok: false, error: "You are not assigned to this class." };
  }
  return { ok: true, schoolId };
}

/**
 * Matches how {@link getTeacherMarkingClasses} builds each option’s `subject`
 * (subjects.name → subject column → "General") — not raw `subject` text alone.
 */
async function assertTeacherTeachesSubjectInClass(
  userId: string,
  classId: string,
  subjectLabel: string
): Promise<boolean> {
  const trimmed = subjectLabel.trim();
  if (!trimmed) return false;
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, classId);
  const { data: rows } = await admin
    .from("teacher_assignments")
    .select(
      `
      subject,
      subjects ( name )
    `
    )
    .eq("teacher_id", userId)
    .in("class_id", cluster.classIds);

  const list = (rows ?? []) as {
    subject: string | null;
    subjects: { name: string } | null;
  }[];

  for (const r of list) {
    const display =
      r.subjects?.name?.trim() ||
      (r.subject ?? "").trim() ||
      "General";
    if (display === trimmed) {
      return true;
    }
  }
  return false;
}

async function assertTeacherTeachesSubjectIdInClass(
  userId: string,
  classId: string,
  subjectId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, classId);
  const { data } = await admin
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", userId)
    .in("class_id", cluster.classIds)
    .eq("subject_id", subjectId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function resolveGradebookAcademicYearForInsert(
  admin: Db,
  teacherId: string,
  classId: string,
  subjectDisplay: string
): Promise<string> {
  const subLower = subjectDisplay.trim().toLowerCase();
  const cluster = await resolveClassCluster(admin, classId);
  const { data: rows } = await admin
    .from("teacher_assignments")
    .select(
      `
      academic_year,
      subject,
      subjects ( name )
    `
    )
    .eq("teacher_id", teacherId)
    .in("class_id", cluster.classIds);

  const candidates = (rows ?? []) as {
    academic_year: string;
    subject: string;
    subjects: { name: string } | null;
  }[];

  const match = candidates.find((r) => {
    const display = (
      r.subjects?.name?.trim() ||
      r.subject?.trim() ||
      "General"
    ).toLowerCase();
    return display === subLower;
  });

  const y =
    (match?.academic_year ?? "").trim() ||
    (candidates[0]?.academic_year ?? "").trim();
  if (y) return y;

  return new Date().getUTCFullYear().toString();
}

function normalizeAttendanceDateOnly(iso: string): string | null {
  const d = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

export async function loadAttendanceData(
  classId: string,
  date: string,
  filters?: {
    subjectId: string | null;
    /** From `TeacherClassOption.academic_year` — aligns enrolment rows with this assignment. */
    assignmentAcademicYear?: string | null;
    academicYear?: number;
    term?: SubjectEnrollmentTerm;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const gate = await assertTeacherForClass(user.id, classId);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const dateOnly = normalizeAttendanceDateOnly(date);
  if (!dateOnly) {
    return { ok: false as const, error: "Invalid date. Use YYYY-MM-DD." };
  }

  const period = getCurrentAcademicYearAndTerm();
  const assignmentYearStr = filters?.assignmentAcademicYear?.trim() ?? "";
  const academicYear =
    filters?.academicYear ??
    (assignmentYearStr
      ? enrollmentYearFromString(assignmentYearStr)
      : period.academicYear);
  const term = filters?.term ?? period.term;
  const subjectId = filters?.subjectId ?? null;

  if (subjectId) {
    const allowed = await assertTeacherTeachesSubjectIdInClass(
      user.id,
      classId,
      subjectId
    );
    if (!allowed) {
      return {
        ok: false as const,
        error: "You are not assigned to teach this subject for this class.",
      };
    }
  }

  const roster = await getStudentsForSubject(admin, {
    classId,
    subjectId,
    academicYear,
    term,
    enrollmentDateOnOrBefore: dateOnly,
  });

  type StudentRow = { id: string; full_name: string; gender: string | null };
  let mergedRows = roster as StudentRow[];
  const baseIds = new Set(mergedRows.map((s) => s.id));

  let attQuery = admin
    .from("teacher_attendance")
    .select("student_id, status")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .eq("attendance_date", dateOnly);
  if (subjectId) {
    attQuery = attQuery.eq("subject_id", subjectId);
  } else {
    attQuery = attQuery.is("subject_id", null);
  }
  const { data: rows } = await attQuery;

  const byStudent: Record<string, AttendanceStatus> = {};
  const idsWithAttendanceOnDate = new Set<string>();
  for (const r of rows ?? []) {
    const row = r as { student_id: string; status: AttendanceStatus };
    byStudent[row.student_id] = row.status;
    idsWithAttendanceOnDate.add(row.student_id);
  }

  const missingIds = [...idsWithAttendanceOnDate].filter((id) => !baseIds.has(id));
  if (subjectId) {
    if (missingIds.length > 0) {
      console.log(
        "[loadAttendanceData] ignoring attendance rows for students not enrolled in subject",
        JSON.stringify({
          classId,
          subjectId,
          academicYear,
          term,
          date: dateOnly,
          rosterCount: mergedRows.length,
          attendanceStudentIdsOnDate: idsWithAttendanceOnDate.size,
          skippedNotOnSubjectRoster: missingIds.length,
        })
      );
    }
  } else if (missingIds.length > 0) {
    const { data: extraRows } = await orderStudentsByGenderThenName(
      admin
        .from("students")
        .select("id, full_name, gender")
        .eq("class_id", classId)
        .eq("status", "active")
        .in("id", missingIds)
    );
    mergedRows = [...mergedRows, ...((extraRows ?? []) as StudentRow[])];
  }

  console.log(
    "[loadAttendanceData] final student list",
    JSON.stringify({
      classId,
      subjectId,
      academicYear,
      term,
      date: dateOnly,
      studentsShown: mergedRows.length,
      attendanceRowsOnDate: idsWithAttendanceOnDate.size,
    })
  );

  const students = sortStudentsByGenderThenName(mergedRows).map(
    ({ id, full_name }) => ({ id, full_name })
  );

  return {
    ok: true as const,
    students,
    attendance: byStudent,
  };
}

export async function saveAttendanceAction(input: {
  classId: string;
  date: string;
  subjectId?: string | null;
  assignmentAcademicYear?: string | null;
  academicYear?: number;
  term?: SubjectEnrollmentTerm;
  records: { studentId: string; status: AttendanceStatus }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    console.error("[saveAttendanceAction] unauthorized");
    return { ok: false, error: "Unauthorized." };
  }

  const gate = await assertTeacherForClass(user.id, input.classId);
  if (!gate.ok) {
    console.error("[saveAttendanceAction] class gate failed", gate.error);
    return { ok: false, error: gate.error };
  }

  const dateOnly = normalizeAttendanceDateOnly(input.date);
  if (!dateOnly) {
    console.error("[saveAttendanceAction] invalid date", input.date);
    return { ok: false, error: "Invalid date. Use YYYY-MM-DD." };
  }

  const schoolId = gate.schoolId;
  const admin = createAdminClient();
  const period = getCurrentAcademicYearAndTerm();
  const assignmentYearStr = input.assignmentAcademicYear?.trim() ?? "";
  const academicYear =
    input.academicYear ??
    (assignmentYearStr
      ? enrollmentYearFromString(assignmentYearStr)
      : period.academicYear);
  const term = input.term ?? period.term;
  const subjectId = input.subjectId ?? null;

  const mergedByStudent = new Map<string, AttendanceStatus>();
  for (const r of input.records) {
    mergedByStudent.set(r.studentId, r.status);
  }
  const uniqueRecords = [...mergedByStudent.entries()].map(
    ([studentId, status]) => ({ studentId, status })
  );

  if (subjectId) {
    const allowed = await assertTeacherTeachesSubjectIdInClass(
      user.id,
      input.classId,
      subjectId
    );
    if (!allowed) {
      console.error("[saveAttendanceAction] teacher does not teach subject in class", {
        classId: input.classId,
        subjectId,
      });
      return {
        ok: false,
        error: "You are not assigned to teach this subject for this class.",
      };
    }
    const roster = await getStudentsForSubject(admin, {
      classId: input.classId,
      subjectId,
      academicYear,
      term,
      enrollmentDateOnOrBefore: dateOnly,
    });
    const allowedIds = new Set(roster.map((s) => s.id));
    const invalid = uniqueRecords.filter((r) => !allowedIds.has(r.studentId));
    if (invalid.length > 0) {
      console.error("[saveAttendanceAction] student ids not on subject roster", {
        classId: input.classId,
        subjectId,
        academicYear,
        term,
        invalidStudentIds: invalid.map((r) => r.studentId),
        rosterSize: roster.length,
        recordCount: uniqueRecords.length,
      });
      return {
        ok: false,
        error:
          "One or more students are not enrolled in this subject for the current term.",
      };
    }
  }

  const scopeKey = subjectId ? subjectId : "";

  const studentIds = uniqueRecords.map((r) => r.studentId);
  const { data: existingRows, error: existingErr } = await admin
    .from("teacher_attendance")
    .select("student_id, status")
    .eq("teacher_id", user.id)
    .eq("class_id", input.classId)
    .eq("attendance_date", dateOnly)
    .eq("attendance_scope_key", scopeKey)
    .in("student_id", studentIds);

  if (existingErr) {
    console.error("[saveAttendanceAction] failed to load existing rows", {
      message: existingErr.message,
      code: existingErr.code,
    });
    return {
      ok: false,
      error:
        "Could not verify existing attendance. Check your connection and try again.",
    };
  }

  const statusByStudent = new Map(
    ((existingRows ?? []) as { student_id: string; status: string }[]).map(
      (row) => [row.student_id, String(row.status).trim().toLowerCase()] as const
    )
  );

  const normStatus = (s: string) => s.trim().toLowerCase();
  const changedRecords = uniqueRecords.filter((r) => {
    const prev = statusByStudent.get(r.studentId);
    if (prev === undefined) return true;
    return normStatus(prev) !== normStatus(r.status);
  });

  if (changedRecords.length === 0) {
    console.log("[saveAttendanceAction] no status changes, skipping write", {
      classId: input.classId,
      date: dateOnly,
      subjectId,
      recordCount: uniqueRecords.length,
    });
    revalidatePath("/teacher-dashboard");
    revalidatePath("/teacher-dashboard/attendance");
    return { ok: true as const };
  }

  const attendanceRecords = changedRecords.map((r) => ({
    teacher_id: user.id,
    school_id: schoolId,
    class_id: input.classId,
    student_id: r.studentId,
    attendance_date: dateOnly,
    status: r.status,
    subject_id: subjectId,
    attendance_scope_key: scopeKey,
  }));

  console.log("[saveAttendanceAction] batch upsert", {
    classId: input.classId,
    date: dateOnly,
    subjectId,
    scopeKey,
    recordCount: uniqueRecords.length,
    upsertCount: attendanceRecords.length,
  });

  const { error } = await (admin as Db).from("teacher_attendance").upsert(
    attendanceRecords,
    {
      onConflict:
        "teacher_id,class_id,student_id,attendance_date,attendance_scope_key",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.error("[saveAttendanceAction] batch upsert failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    const code = error.code ?? "";
    const raw = `${error.message} ${(error as { details?: string }).details ?? ""}`;
    let userMessage = error.message;
    if (
      code === "23505" &&
      raw.includes("teacher_attendance_unique_record")
    ) {
      userMessage =
        "This student already has attendance saved today under another subject. Your school database needs a one-time update so each subject can keep its own attendance. Please ask your administrator to apply the latest Supabase migrations, then try again.";
    } else if (code === "23505") {
      userMessage =
        "Could not save this attendance because it conflicts with existing data. Refresh the page and try again. If it keeps happening, contact your administrator.";
    } else if (code === "42501" || /permission denied/i.test(error.message)) {
      userMessage =
        "You do not have permission to save attendance for this class. Contact your school administrator if this persists.";
    } else if (/violates foreign key/i.test(error.message)) {
      userMessage =
        "A student or class reference is no longer valid. Refresh the page and try again.";
    }
    return { ok: false, error: userMessage };
  }

  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/attendance");
  console.log("[saveAttendanceAction] success", {
    classId: input.classId,
    date: dateOnly,
    subjectId,
    savedCount: attendanceRecords.length,
  });
  return { ok: true as const };
}

export async function loadAttendanceHistory(
  classId: string,
  opts?: { limit?: number; subjectId?: string | null }
) {
  const limit = opts?.limit ?? 14;
  const subjectId = opts?.subjectId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const gate = await assertTeacherForClass(user.id, classId);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  let histQuery = admin
    .from("teacher_attendance")
    .select("attendance_date, status, student_id")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .order("attendance_date", { ascending: false })
    .limit(800);

  if (subjectId) {
    histQuery = histQuery.eq("subject_id", subjectId);
  } else if (subjectId === null) {
    histQuery = histQuery.is("subject_id", null);
  }

  const { data: rows, error: histError } = await histQuery;
  if (histError) {
    console.error("[loadAttendanceHistory] query failed", histError.message);
    return { ok: false as const, error: histError.message };
  }

  type Row = {
    attendance_date: string;
    status: string;
    student_id: string;
  };

  const list = (rows ?? []) as Row[];
  const ids = [...new Set(list.map((r) => r.student_id))];
  const nameById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: studs } = await orderStudentsByGenderThenName(
      admin.from("students").select("id, full_name").in("id", ids)
    );
    for (const s of studs ?? []) {
      const row = s as { id: string; full_name: string };
      nameById.set(row.id, row.full_name);
    }
  }

  const enriched = list.map((r) => ({
    ...r,
    student_name: nameById.get(r.student_id) ?? "Student",
  }));

  const byDate = new Map<string, typeof enriched>();
  for (const r of enriched) {
    const d = r.attendance_date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }

  const dates = [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  console.log("[loadAttendanceHistory]", {
    classId,
    limit,
    subjectFilter:
      subjectId === undefined
        ? "unfiltered"
        : subjectId === null
          ? "class_wide_only"
          : subjectId,
    datesReturned: dates.length,
    rowCount: list.length,
  });

  return {
    ok: true as const,
    dates,
    byDate: Object.fromEntries(dates.map((d) => [d, byDate.get(d) ?? []])) as Record<
      string,
      { attendance_date: string; status: string; student_id: string; student_name: string }[]
    >,
  };
}

export async function createGradebookAssignmentAction(input: {
  classId: string;
  subject: string;
  title: string;
  maxScore: number;
  weight: number;
  dueDate: string | null;
  academicYear?: string | null;
  examType?: string | null;
  /** When set, stored on the assignment for matrix filtering. */
  term?: SubjectEnrollmentTerm | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Unauthorized." };
  }

  const admin = createAdminClient();

  const gate = await assertTeacherForClass(user.id, input.classId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const teaches = await assertTeacherTeachesSubjectInClass(
    user.id,
    input.classId,
    input.subject
  );
  if (!teaches) {
    return {
      ok: false,
      error: "You are not assigned to teach this subject for this class.",
    };
  }

  const subjectTrim = input.subject.trim();
  const academicYearRaw = (input.academicYear ?? "").trim();
  const academicYear = academicYearRaw
    ? academicYearRaw
    : await resolveGradebookAcademicYearForInsert(
        admin,
        user.id,
        input.classId,
        subjectTrim
      );

  const titleTrim = input.title.trim();
  const examType =
    parseGradebookExamType(input.examType) ??
    inferMajorExamTypeFromTitle(titleTrim);

  const termVal =
    input.term === "Term 1" || input.term === "Term 2" ? input.term : null;

  const { data: created, error } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .insert({
      teacher_id: user.id,
      class_id: input.classId,
      subject: subjectTrim,
      title: titleTrim,
      max_score: input.maxScore,
      weight: input.weight,
      due_date: input.dueDate || null,
      academic_year: academicYear,
      exam_type: examType,
      term: termVal,
    })
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505" && examType) {
      return {
        ok: false,
        error: duplicateMajorExamMessage(examType),
      };
    }
    return { ok: false, error: error?.message ?? "Could not create assignment." };
  }

  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/grades");
  return { ok: true as const, assignmentId: (created as { id: string }).id };
}

export async function deleteGradebookAssignmentAction(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { data: g, error: fetchErr } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select("id, teacher_id, class_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  const row = g as { id: string; teacher_id: string; class_id: string } | null;
  if (!row || row.teacher_id !== user.id) {
    return { ok: false, error: "Assignment not found." };
  }

  const gate = await assertTeacherForClass(user.id, row.class_id);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { error: scoresDelErr } = await (admin as Db)
    .from("teacher_scores")
    .delete()
    .eq("assignment_id", assignmentId);

  if (scoresDelErr) {
    return { ok: false, error: scoresDelErr.message };
  }

  const { error: assignDelErr } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("teacher_id", user.id);

  if (assignDelErr) {
    return { ok: false, error: assignDelErr.message };
  }

  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/grades");
  return { ok: true as const };
}

export async function loadGradebookAssignmentsForClass(
  classId: string,
  subject: string,
  gradebookTerm?: SubjectEnrollmentTerm
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();

  const gate = await assertTeacherForClass(user.id, classId);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const classIdsForAssignments =
    await gradebookAssignmentClassIdsForSelection(admin, classId);

  const { data: rawData, error } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select(
      "id, title, max_score, weight, due_date, subject, exam_type, academic_year, term, created_at"
    )
    .eq("teacher_id", user.id)
    .in("class_id", classIdsForAssignments)
    .eq("subject", subject);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  const deduped = new Map<
    string,
    {
      id: string;
      title: string;
      max_score: number;
      weight: number;
      due_date: string | null;
      subject: string;
      exam_type: string | null;
      academic_year: string;
      term: string | null;
      created_at: string;
    }
  >();
  for (const row of rawData ?? []) {
    const r = row as {
      id: string;
      title: string;
      max_score: number;
      weight: number;
      due_date: string | null;
      subject: string;
      exam_type: string | null;
      academic_year: string;
      term: string | null;
      created_at: string;
    };
    if (!deduped.has(r.id)) deduped.set(r.id, r);
  }
  const merged = [...deduped.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  const data = merged.filter((row: { term: string | null }) => {
    if (!gradebookTerm) return true;
    const t = row.term;
    if (t == null || String(t).trim() === "") return true;
    return t === gradebookTerm;
  });

  return {
    ok: true as const,
    assignments: data as {
      id: string;
      title: string;
      max_score: number;
      weight: number;
      due_date: string | null;
      subject: string;
      exam_type: string | null;
      academic_year: string;
      term: string | null;
    }[],
  };
}

function enrollmentYearFromString(y: string | undefined | null): number {
  const t = (y ?? "").trim();
  const m = t.match(/\d{4}/);
  if (m) return parseInt(m[0], 10);
  return getCurrentAcademicYearAndTerm().academicYear;
}

/**
 * All assignments for a class/subject with every student's scores — for the overview matrix.
 */
export async function loadGradebookClassMatrix(
  classId: string,
  subject: string,
  gradebookTerm: SubjectEnrollmentTerm,
  subjectId: string | null,
  enrollmentYear?: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const gate = await assertTeacherForClass(user.id, classId);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const classIdsForMatrix =
    await gradebookAssignmentClassIdsForSelection(admin, classId);

  const { data: assignmentRowsRaw, error: aErr } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select(
      "id, title, max_score, weight, due_date, subject, created_at, exam_type, academic_year, term"
    )
    .eq("teacher_id", user.id)
    .in("class_id", classIdsForMatrix)
    .eq("subject", subject);

  if (aErr) {
    return { ok: false as const, error: aErr.message };
  }

  const dedupAssignments = new Map<string, (typeof assignmentRowsRaw)[number]>();
  for (const row of assignmentRowsRaw ?? []) {
    const r = row as { id: string };
    if (!dedupAssignments.has(r.id)) dedupAssignments.set(r.id, row);
  }
  const mergedRows = [...dedupAssignments.values()].sort((a, b) => {
    const ca = String((a as { created_at?: string }).created_at ?? "");
    const cb = String((b as { created_at?: string }).created_at ?? "");
    return ca.localeCompare(cb);
  });

  const assignmentRows = mergedRows.filter((row: { term: string | null }) => {
    const t = row.term;
    if (t == null || String(t).trim() === "") return true;
    return t === gradebookTerm;
  });

  const assignments = assignmentRows as {
    id: string;
    title: string;
    max_score: number;
    weight: number;
    due_date: string | null;
    subject: string;
    created_at?: string;
    exam_type: string | null;
    academic_year: string;
    term: string | null;
  }[];

  const yearForEnrollment =
    enrollmentYear ??
    enrollmentYearFromString(assignments[0]?.academic_year);

  const roster = await getStudentsForSubject(admin, {
    classId,
    subjectId,
    academicYear: yearForEnrollment,
    term: gradebookTerm,
    enrollmentDateOnOrBefore: null,
  });

  const rawStudents = roster as {
    id: string;
    full_name: string;
    gender: string | null;
  }[];
  const seenIds = new Set<string>();
  const studentList = rawStudents.filter((row) => {
    const id = String(row?.id ?? "").trim();
    const name = String(row?.full_name ?? "").trim();
    if (!id || !name) return false;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  const assignmentIds = assignments.map((a) => a.id);
  const scoreMatrix: Record<
    string,
    Record<
      string,
      {
        score: number | null;
        comments: string | null;
        remarks: string | null;
      }
    >
  > = {};

  if (assignmentIds.length > 0) {
    const { data: scoreRows, error: scoresError } = await (admin as Db)
      .from("teacher_scores")
      .select("assignment_id, student_id, score, comments, remarks")
      .in("assignment_id", assignmentIds);

    if (scoresError) {
      return { ok: false as const, error: scoresError.message };
    }

    for (const row of scoreRows ?? []) {
      const r = row as {
        assignment_id: string;
        student_id: string;
        score: unknown;
        comments: string | null;
        remarks: string | null;
      };
      if (!scoreMatrix[r.assignment_id]) {
        scoreMatrix[r.assignment_id] = {};
      }
      scoreMatrix[r.assignment_id][r.student_id] = {
        score: normalizeScoreValue(r.score),
        comments: r.comments,
        remarks: normalizeText(r.remarks),
      };
    }
  }

  return {
    ok: true as const,
    assignments,
    students: studentList as {
      id: string;
      full_name: string;
      gender: string | null;
    }[],
    scoreMatrix,
  };
}

/** School / class / teacher / term for full gradebook report (class + subject). */
export async function loadFullGradeReportMeta(
  classId: string,
  subject: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const gate = await assertTeacherForClass(user.id, classId);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const subj = subject.trim();
  const { data: cls } = await admin
    .from("classes")
    .select("name, school_id")
    .eq("id", classId)
    .maybeSingle();

  const classRow = cls as { name: string; school_id: string } | null;
  const className = classRow?.name?.trim() ?? "Class";

  let schoolName = "School";
  if (classRow?.school_id) {
    const { data: sch } = await admin
      .from("schools")
      .select("name")
      .eq("id", classRow.school_id)
      .maybeSingle();
    schoolName =
      ((sch as { name: string } | null)?.name ?? "").trim() || schoolName;
  }

  const clusterForReport = await resolveClassCluster(admin, classId);
  const { data: ta } = await admin
    .from("teacher_assignments")
    .select("academic_year")
    .eq("teacher_id", user.id)
    .in("class_id", clusterForReport.classIds)
    .eq("subject", subj)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const termLabel =
    ((ta as { academic_year: string } | null)?.academic_year ?? "").trim() ||
    "—";

  const { data: prof } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const teacherName =
    ((prof as { full_name: string } | null)?.full_name ?? "").trim() ||
    "Teacher";

  return {
    ok: true as const,
    schoolName,
    className,
    subject: subj,
    teacherName,
    termLabel,
  };
}

export async function saveScoresAction(input: {
  assignmentId: string;
  scores: {
    studentId: string;
    score: number | null;
    comments?: string | null;
    remarks?: string | null;
  }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { data: g } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select("id, teacher_id")
    .eq("id", input.assignmentId)
    .single();

  const gr = g as { id: string; teacher_id: string } | null;
  if (!gr || gr.teacher_id !== user.id) {
    return { ok: false, error: "Assignment not found." };
  }

  for (const s of input.scores) {
    const { error } = await (admin as Db).from("teacher_scores").upsert(
      {
        assignment_id: input.assignmentId,
        student_id: s.studentId,
        score: s.score,
        comments: s.comments ?? null,
        remarks: s.remarks ?? null,
      },
      { onConflict: "assignment_id,student_id" }
    );
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/grades");
  return { ok: true as const };
}

export async function upsertLessonAction(input: {
  id?: string;
  classId: string;
  subject: string;
  lessonDate: string;
  topic: string;
  objectives: string;
  materials: string;
  procedure: string;
  assessment: string;
  homework: string;
  notes: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Unauthorized." };
  }

  const gate = await assertTeacherForClass(user.id, input.classId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();
  const payload = {
    teacher_id: user.id,
    class_id: input.classId,
    subject: input.subject.trim(),
    lesson_date: input.lessonDate,
    topic: input.topic.trim() || "Lesson",
    objectives: input.objectives.trim() || null,
    materials: input.materials.trim() || null,
    procedure: input.procedure.trim() || null,
    assessment: input.assessment.trim() || null,
    homework: input.homework.trim() || null,
    notes: input.notes.trim() || null,
  };

  if (input.id) {
    const { error } = await (admin as Db)
      .from("teacher_lessons")
      .update(payload)
      .eq("id", input.id)
      .eq("teacher_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await (admin as Db).from("teacher_lessons").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/lessons");
  return { ok: true as const };
}

/**
 * @param rosterClassId Marks page class filter — roster is scoped to this class
 *   (stream shows that stream only; parent shows full cohort). Must sit in the
 *   same cluster as the assignment’s `class_id`.
 */
export async function loadGradebookMatrix(
  assignmentId: string,
  rosterClassId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const rosterTrim = rosterClassId.trim();
  if (!rosterTrim) {
    return { ok: false as const, error: "Class is required." };
  }

  const { data: g } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select(
      "id, class_id, subject, title, max_score, weight, due_date, teacher_id, academic_year, term"
    )
    .eq("id", assignmentId)
    .single();

  const ga = g as {
    id: string;
    class_id: string;
    subject: string;
    title: string;
    max_score: number;
    weight: number;
    due_date: string | null;
    teacher_id: string;
    academic_year: string | null;
    term: string | null;
  } | null;

  if (!ga || ga.teacher_id !== user.id) {
    return { ok: false as const, error: "Assignment not found." };
  }

  const clusterRoster = await resolveClassCluster(admin, rosterTrim);
  const clusterAssign = await resolveClassCluster(admin, ga.class_id);
  const rosterSet = new Set(clusterRoster.classIds);
  const inSameCluster = clusterAssign.classIds.some((id) => rosterSet.has(id));
  if (!inSameCluster) {
    return {
      ok: false as const,
      error: "This assignment does not belong to the selected class.",
    };
  }

  const gate = await assertTeacherForClass(user.id, rosterTrim);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const subLower = ga.subject.trim().toLowerCase();
  const clusterForTa = await resolveClassCluster(admin, rosterTrim);
  const { data: taRows } = await (admin as Db)
    .from("teacher_assignments")
    .select("subject_id, subject, subjects(name)")
    .eq("teacher_id", user.id)
    .in("class_id", clusterForTa.classIds);

  let subjectIdForEnrollment: string | null = null;
  for (const r of taRows ?? []) {
    const row = r as {
      subject_id: string | null;
      subject: string;
      subjects: { name: string } | null;
    };
    const disp = (
      row.subjects?.name?.trim() ||
      row.subject?.trim() ||
      ""
    ).toLowerCase();
    if (disp === subLower) {
      subjectIdForEnrollment = row.subject_id;
      break;
    }
  }

  const termParsed =
    parseSubjectEnrollmentTerm(ga.term) ??
    getCurrentAcademicYearAndTerm().term;

  const enrollYear = enrollmentYearFromString(ga.academic_year ?? undefined);

  const studentsList = await getStudentsForSubject(admin, {
    classId: rosterTrim,
    subjectId: subjectIdForEnrollment,
    academicYear: enrollYear,
    term: termParsed,
    enrollmentDateOnOrBefore: null,
  });

  const { data: scoreRows, error: scoresError } = await (admin as Db)
    .from("teacher_scores")
    .select("student_id, score, comments, remarks")
    .eq("assignment_id", assignmentId);

  if (scoresError) {
    return { ok: false as const, error: scoresError.message };
  }

  const scoreByStudent: Record<
    string,
    {
      score: number | null;
      comments: string | null;
      remarks: string | null;
    }
  > = {};
  for (const s of scoreRows ?? []) {
    const row = s as {
      student_id: string;
      score: unknown;
      comments: string | null;
      remarks: string | null;
    };
    scoreByStudent[row.student_id] = {
      score: normalizeScoreValue(row.score),
      comments: row.comments,
      remarks: normalizeText(row.remarks),
    };
  }

  return {
    ok: true as const,
    assignment: ga,
    students: studentsList as {
      id: string;
      full_name: string;
      gender: string | null;
    }[],
    scoreByStudent,
  };
}

/** Loads persisted scores for one assignment (for refresh / focused score sync). */
export async function loadScoresForAssignment(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { data: g } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select("id, teacher_id")
    .eq("id", assignmentId)
    .single();

  const ga = g as { id: string; teacher_id: string } | null;
  if (!ga || ga.teacher_id !== user.id) {
    return { ok: false as const, error: "Assignment not found." };
  }

  const { data: scoreRows, error: scoresError } = await (admin as Db)
    .from("teacher_scores")
    .select("student_id, score, comments, remarks")
    .eq("assignment_id", assignmentId);

  if (scoresError) {
    return { ok: false as const, error: scoresError.message };
  }

  const scoreByStudent: Record<
    string,
    {
      score: number | null;
      comments: string | null;
      remarks: string | null;
    }
  > = {};
  for (const s of scoreRows ?? []) {
    const row = s as {
      student_id: string;
      score: unknown;
      comments: string | null;
      remarks: string | null;
    };
    scoreByStudent[row.student_id] = {
      score: normalizeScoreValue(row.score),
      comments: row.comments,
      remarks: normalizeText(row.remarks),
    };
  }

  return { ok: true as const, scoreByStudent };
}

/** School, class, and teacher display names for PDF export. */
export async function loadGradeReportContext(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { data: g } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select("id, title, subject, class_id, teacher_id")
    .eq("id", assignmentId)
    .single();

  const ga = g as {
    id: string;
    title: string;
    subject: string;
    class_id: string;
    teacher_id: string;
  } | null;

  if (!ga || ga.teacher_id !== user.id) {
    return { ok: false as const, error: "Assignment not found." };
  }

  const { data: cls } = await admin
    .from("classes")
    .select("name, school_id")
    .eq("id", ga.class_id)
    .maybeSingle();

  const classRow = cls as { name: string; school_id: string } | null;
  const className = classRow?.name?.trim() ?? "Class";

  let schoolName = "School";
  if (classRow?.school_id) {
    const { data: sch } = await admin
      .from("schools")
      .select("name")
      .eq("id", classRow.school_id)
      .maybeSingle();
    schoolName =
      ((sch as { name: string } | null)?.name ?? "").trim() || schoolName;
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const teacherName =
    ((prof as { full_name: string } | null)?.full_name ?? "").trim() ||
    "Teacher";

  return {
    ok: true as const,
    schoolName,
    className,
    assignmentTitle: ga.title,
    subject: ga.subject,
    teacherName,
  };
}

export async function loadLessonsInRange(start: string, end: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false as const, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("teacher_lessons")
    .select(
      "id, class_id, subject, lesson_date, topic, objectives, materials, procedure, assessment, homework, notes"
    )
    .eq("teacher_id", user.id)
    .gte("lesson_date", start)
    .lte("lesson_date", end)
    .order("lesson_date", { ascending: true });

  return {
    ok: true as const,
    lessons: (rows ?? []) as {
      id: string;
      class_id: string;
      subject: string;
      lesson_date: string;
      topic: string;
      objectives: string | null;
      materials: string | null;
      procedure: string | null;
      assessment: string | null;
      homework: string | null;
      notes: string | null;
    }[],
  };
}

export async function deleteLessonAction(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_lessons")
    .delete()
    .eq("id", lessonId)
    .eq("teacher_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher-dashboard/lessons");
  return { ok: true as const };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import {
  orderStudentsByGenderThenName,
  sortStudentsByGenderThenName,
} from "@/lib/student-list-order";

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

async function assertTeacherForClass(
  userId: string,
  classId: string
): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("teacher_assignments")
    .select("school_id")
    .eq("teacher_id", userId)
    .eq("class_id", classId)
    .limit(1)
    .maybeSingle();

  const schoolId = (row as { school_id: string } | null)?.school_id;
  if (!schoolId) {
    return { ok: false, error: "You are not assigned to this class." };
  }
  return { ok: true, schoolId };
}

async function assertTeacherTeachesSubjectInClass(
  userId: string,
  classId: string,
  subjectLabel: string
): Promise<boolean> {
  const trimmed = subjectLabel.trim();
  if (!trimmed) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", userId)
    .eq("class_id", classId)
    .eq("subject", trimmed)
    .limit(1)
    .maybeSingle();
  return !!data;
}

function normalizeAttendanceDateOnly(iso: string): string | null {
  const d = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

export async function loadAttendanceData(classId: string, date: string) {
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

  const { data: studentRows } = await orderStudentsByGenderThenName(
    admin
      .from("students")
      .select("id, full_name, gender")
      .eq("class_id", classId)
      .eq("status", "active")
      .lte("enrollment_date", dateOnly)
  );

  type StudentRow = { id: string; full_name: string; gender: string | null };
  let mergedRows = (studentRows ?? []) as StudentRow[];
  const baseIds = new Set(mergedRows.map((s) => s.id));

  const { data: rows } = await admin
    .from("teacher_attendance")
    .select("student_id, status")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .eq("attendance_date", dateOnly);

  const byStudent: Record<string, AttendanceStatus> = {};
  const idsWithAttendanceOnDate = new Set<string>();
  for (const r of rows ?? []) {
    const row = r as { student_id: string; status: AttendanceStatus };
    byStudent[row.student_id] = row.status;
    idsWithAttendanceOnDate.add(row.student_id);
  }

  const missingIds = [...idsWithAttendanceOnDate].filter((id) => !baseIds.has(id));
  if (missingIds.length > 0) {
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
  records: { studentId: string; status: AttendanceStatus }[];
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

  const schoolId = gate.schoolId;
  const admin = createAdminClient();

  for (const r of input.records) {
    // Must match unique index column order: teacher_attendance_class_student_attendance_date_key
    // is (class_id, student_id, attendance_date). Use attendance_date in the row, never "date".
    const { error } = await (admin as Db).from("teacher_attendance").upsert(
      {
        teacher_id: user.id,
        school_id: schoolId,
        class_id: input.classId,
        student_id: r.studentId,
        attendance_date: input.date,
        status: r.status,
      },
      { onConflict: "class_id,student_id,attendance_date" }
    );
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/attendance");
  return { ok: true as const };
}

export async function loadAttendanceHistory(classId: string, limit = 14) {
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

  const { data: rows } = await admin
    .from("teacher_attendance")
    .select("attendance_date, status, student_id")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .order("attendance_date", { ascending: false })
    .limit(800);

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

  const { data: created, error } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .insert({
      teacher_id: user.id,
      class_id: input.classId,
      subject: input.subject.trim(),
      title: input.title.trim(),
      max_score: input.maxScore,
      weight: input.weight,
      due_date: input.dueDate || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Could not create assignment." };
  }

  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/grades");
  return { ok: true as const, assignmentId: (created as { id: string }).id };
}

export async function loadGradebookAssignmentsForClass(
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

  const { data, error } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select("id, title, max_score, weight, due_date, subject")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .eq("subject", subject);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return {
    ok: true as const,
    assignments: (data ?? []) as {
      id: string;
      title: string;
      max_score: number;
      weight: number;
      due_date: string | null;
      subject: string;
    }[],
  };
}

/**
 * All assignments for a class/subject with every student's scores — for the overview matrix.
 */
export async function loadGradebookClassMatrix(classId: string, subject: string) {
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

  const { data: assignmentRows, error: aErr } = await (admin as Db)
    .from("teacher_gradebook_assignments")
    .select("id, title, max_score, weight, due_date, subject, created_at")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .eq("subject", subject)
    .order("created_at", { ascending: true });

  if (aErr) {
    return { ok: false as const, error: aErr.message };
  }

  const assignments = (assignmentRows ?? []) as {
    id: string;
    title: string;
    max_score: number;
    weight: number;
    due_date: string | null;
    subject: string;
    created_at?: string;
  }[];

  const { data: students } = await orderStudentsByGenderThenName(
    admin
      .from("students")
      .select("id, full_name, gender")
      .eq("class_id", classId)
      .eq("status", "active")
  );

  const rawStudents = (students ?? []) as {
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

  const { data: ta } = await admin
    .from("teacher_assignments")
    .select("academic_year")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
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

export async function loadGradebookMatrix(assignmentId: string) {
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
    .select(
      "id, class_id, subject, title, max_score, weight, due_date, teacher_id"
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
  } | null;

  if (!ga || ga.teacher_id !== user.id) {
    return { ok: false as const, error: "Assignment not found." };
  }

  const { data: students } = await orderStudentsByGenderThenName(
    admin
      .from("students")
      .select("id, full_name, gender")
      .eq("class_id", ga.class_id)
      .eq("status", "active")
  );

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
    students: (students ?? []) as {
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

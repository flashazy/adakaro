"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";

type AttendanceStatus = "present" | "absent" | "late";

/** Manual widen — admin insert/upsert typing without full Relationships. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

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

  const { data: students } = await admin
    .from("students")
    .select("id, full_name")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");

  const { data: rows } = await admin
    .from("teacher_attendance")
    .select("student_id, status")
    .eq("teacher_id", user.id)
    .eq("class_id", classId)
    .eq("attendance_date", date);

  const byStudent: Record<string, AttendanceStatus> = {};
  for (const r of rows ?? []) {
    const row = r as { student_id: string; status: AttendanceStatus };
    byStudent[row.student_id] = row.status;
  }

  return {
    ok: true as const,
    students: (students ?? []) as { id: string; full_name: string }[],
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
    const { error } = await (admin as Db).from("teacher_attendance").upsert(
      {
        teacher_id: user.id,
        school_id: schoolId,
        class_id: input.classId,
        student_id: r.studentId,
        attendance_date: input.date,
        status: r.status,
      },
      { onConflict: "student_id,attendance_date,class_id" }
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
    const { data: studs } = await admin
      .from("students")
      .select("id, full_name")
      .in("id", ids);
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

  const gate = await assertTeacherForClass(user.id, input.classId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();
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

  const gate = await assertTeacherForClass(user.id, classId);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminClient();
  const { data, error } = await admin
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

export async function saveScoresAction(input: {
  assignmentId: string;
  scores: { studentId: string; score: number | null; comments?: string | null }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Unauthorized." };
  }

  const admin = createAdminClient();
  const { data: g } = await admin
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
  const { data: g } = await admin
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

  const { data: students } = await admin
    .from("students")
    .select("id, full_name")
    .eq("class_id", ga.class_id)
    .eq("status", "active")
    .order("full_name");

  const { data: scoreRows } = await admin
    .from("teacher_scores")
    .select("student_id, score, comments")
    .eq("assignment_id", assignmentId);

  const scoreByStudent: Record<
    string,
    { score: number | null; comments: string | null }
  > = {};
  for (const s of scoreRows ?? []) {
    const row = s as {
      student_id: string;
      score: number | null;
      comments: string | null;
    };
    scoreByStudent[row.student_id] = {
      score: row.score,
      comments: row.comments,
    };
  }

  return {
    ok: true as const,
    assignment: ga,
    students: (students ?? []) as { id: string; full_name: string }[],
    scoreByStudent,
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

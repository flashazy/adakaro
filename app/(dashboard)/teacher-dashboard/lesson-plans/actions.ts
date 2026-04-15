"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseTeachingLearningProcess } from "@/lib/teaching-learning-process";
import type { SubjectEnrollmentTerm } from "@/lib/student-subject-enrollment";
import { getCurrentAcademicYearAndTerm } from "@/lib/student-subject-enrollment";
import type { Json } from "@/types/supabase";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin client typing
type Db = any;

async function assertTeacherTeachesSubjectForClass(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string,
  classId: string,
  subjectId: string
): Promise<boolean> {
  const { data: rows } = await admin
    .from("teacher_assignments")
    .select("subject_id, subject")
    .eq("teacher_id", teacherId)
    .eq("class_id", classId);

  if (!rows?.length) return false;

  const { data: subjRow } = await admin
    .from("subjects")
    .select("name")
    .eq("id", subjectId)
    .maybeSingle();
  const catalogName =
    (subjRow as { name: string } | null)?.name?.trim() ?? "";

  for (const raw of rows) {
    const r = raw as { subject_id: string | null; subject: string };
    if (r.subject_id === subjectId) return true;
    if (
      !r.subject_id &&
      catalogName &&
      r.subject?.trim() === catalogName
    ) {
      return true;
    }
  }
  return false;
}

function teachingLearningProcessFromForm(formData: FormData): Json {
  const raw = formData.get("teaching_learning_process");
  if (typeof raw !== "string" || !raw.trim()) {
    return {} as Json;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseTeachingLearningProcess(
      parsed
    ) as unknown as Json;
  } catch {
    return {} as Json;
  }
}

export async function getLessonPlans() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_plans")
    .select(
      `
      *,
      classes:class_id (name),
      subjects:subject_id (name)
    `
    )
    .eq("teacher_id", user.user.id)
    .order("lesson_date", { ascending: false });

  if (error) return [];
  return data || [];
}

export async function getLessonPlanById(id: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_plans")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", user.user.id)
    .single();

  if (error) return null;
  return data;
}

export async function createLessonPlan(formData: FormData) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) {
    throw new Error("Not authenticated");
  }

  const admin = createAdminClient();

  const periodRaw = formData.get("period");
  const period =
    typeof periodRaw === "string" ? periodRaw.trim() : String(periodRaw ?? "").trim();

  const durationRaw = formData.get("duration_minutes");
  const duration_minutes = parseInt(String(durationRaw), 10);

  if (!period) throw new Error("Period is required");
  if (!Number.isFinite(duration_minutes) || duration_minutes < 1) {
    throw new Error("Duration must be at least 1 minute");
  }

  const classId = String(formData.get("class_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  if (!classId || !subjectId) {
    throw new Error("Class and subject are required.");
  }

  const allowed = await assertTeacherTeachesSubjectForClass(
    admin,
    user.user.id,
    classId,
    subjectId
  );
  if (!allowed) {
    throw new Error(
      "You are not assigned to teach this subject for this class."
    );
  }

  const data = {
    teacher_id: user.user.id,
    class_id: classId,
    subject_id: subjectId,
    lesson_date: formData.get("lesson_date"),
    period,
    duration_minutes,
    total_boys: parseInt(formData.get("total_boys") as string) || 0,
    total_girls: parseInt(formData.get("total_girls") as string) || 0,
    total_pupils: parseInt(formData.get("total_pupils") as string) || 0,
    present_count: parseInt(formData.get("present_count") as string) || 0,
    main_competence: formData.get("main_competence") || "",
    specific_competence: formData.get("specific_competence") || "",
    main_activities: formData.get("main_activities") || "",
    specific_activities: formData.get("specific_activities") || "",
    teaching_resources: formData.get("teaching_resources") || "",
    "references": formData.get("references") || "",
    remarks: formData.get("remarks") || "",
    teaching_learning_process: teachingLearningProcessFromForm(formData),
  };

  const { error } = await admin.from("lesson_plans").insert(data as never);

  if (error) throw new Error(error.message);

  revalidatePath("/teacher-dashboard/lesson-plans");
  revalidatePath("/teacher-dashboard");
  redirect("/teacher-dashboard/lesson-plans");
}

export async function updateLessonPlan(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  const periodRaw = formData.get("period");
  const period =
    typeof periodRaw === "string" ? periodRaw.trim() : String(periodRaw ?? "").trim();

  const durationRaw = formData.get("duration_minutes");
  const duration_minutes = parseInt(String(durationRaw), 10);

  if (!period) throw new Error("Period is required");
  if (!Number.isFinite(duration_minutes) || duration_minutes < 1) {
    throw new Error("Duration must be at least 1 minute");
  }

  const classId = String(formData.get("class_id") ?? "").trim();
  const subjectId = String(formData.get("subject_id") ?? "").trim();
  if (!classId || !subjectId) {
    throw new Error("Class and subject are required.");
  }

  const allowed = await assertTeacherTeachesSubjectForClass(
    admin,
    user.user.id,
    classId,
    subjectId
  );
  if (!allowed) {
    throw new Error(
      "You are not assigned to teach this subject for this class."
    );
  }

  const data = {
    class_id: classId,
    subject_id: subjectId,
    lesson_date: formData.get("lesson_date"),
    period,
    duration_minutes,
    total_boys: parseInt(formData.get("total_boys") as string) || 0,
    total_girls: parseInt(formData.get("total_girls") as string) || 0,
    total_pupils: parseInt(formData.get("total_pupils") as string) || 0,
    present_count: parseInt(formData.get("present_count") as string) || 0,
    main_competence: formData.get("main_competence") || "",
    specific_competence: formData.get("specific_competence") || "",
    main_activities: formData.get("main_activities") || "",
    specific_activities: formData.get("specific_activities") || "",
    teaching_resources: formData.get("teaching_resources") || "",
    "references": formData.get("references") || "",
    remarks: formData.get("remarks") || "",
    teaching_learning_process: teachingLearningProcessFromForm(formData),
  };

  const { error } = await admin
    .from("lesson_plans")
    .update(data as never)
    .eq("id", id)
    .eq("teacher_id", user.user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/teacher-dashboard/lesson-plans");
  revalidatePath("/teacher-dashboard");
  redirect("/teacher-dashboard/lesson-plans");
}

export async function deleteLessonPlan(id: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  const { error } = await admin
    .from("lesson_plans")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/teacher-dashboard/lesson-plans");
  revalidatePath("/teacher-dashboard");
}

export async function getTeacherClasses() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return [];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teacher_assignments")
    .select(
      `
      class:classes (
        id,
        name
      )
    `
    )
    .eq("teacher_id", user.user.id);

  if (error) return [];
  type Row = { class: { id: string; name: string } | null };
  return (data as Row[] | null)?.map((item) => item.class).filter(Boolean) || [];
}

/** Subjects the teacher teaches per class (from `teacher_assignments`). */
export async function getTeacherSubjectsByClass(): Promise<
  Record<string, { id: string; name: string }[]>
> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return {};

  const admin = createAdminClient();
  const { data: rows } = await (admin as Db)
    .from("teacher_assignments")
    .select("class_id, subject_id, subjects ( id, name ), subject")
    .eq("teacher_id", user.user.id);

  const map: Record<string, { id: string; name: string }[]> = {};

  for (const raw of rows ?? []) {
    const r = raw as {
      class_id: string;
      subject_id: string | null;
      subjects: { id: string; name: string } | null;
      subject: string;
    };
    if (!r.subject_id || !r.subjects?.id) continue;
    const list = map[r.class_id] ?? [];
    if (!list.some((x) => x.id === r.subject_id)) {
      list.push({
        id: r.subject_id,
        name: r.subjects.name?.trim() || "General",
      });
      map[r.class_id] = list;
    }
  }

  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => a.name.localeCompare(b.name));
  }
  return map;
}

async function enrolledStudentIdsForSubjectScope(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    classId: string;
    subjectId: string;
    academicYear: number;
    term: SubjectEnrollmentTerm;
  }
): Promise<string[]> {
  const { data } = await admin
    .from("student_subject_enrollment")
    .select("student_id")
    .eq("class_id", params.classId)
    .eq("subject_id", params.subjectId)
    .eq("academic_year", params.academicYear)
    .eq("term", params.term);
  return [
    ...new Set(
      ((data ?? []) as { student_id: string }[]).map((r) => r.student_id)
    ),
  ];
}

/** Counts only (boys / girls / total). With `subjectId`, only students enrolled in that subject for the term. */
export async function getClassDemographics(
  classId: string,
  filters?: {
    subjectId?: string | null;
    academicYear?: number;
    term?: SubjectEnrollmentTerm;
  }
) {
  const admin = createAdminClient();
  const subjectId = filters?.subjectId?.trim() || null;

  if (!subjectId) {
    const { count: boys } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("gender", "male");

    const { count: girls } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("gender", "female");

    const { count: total } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId);

    return {
      boys: boys || 0,
      girls: girls || 0,
      total: total || 0,
    };
  }

  const period = getCurrentAcademicYearAndTerm();
  const academicYear = filters?.academicYear ?? period.academicYear;
  const term = filters?.term ?? period.term;

  const ids = await enrolledStudentIdsForSubjectScope(admin, {
    classId,
    subjectId,
    academicYear,
    term,
  });

  if (ids.length === 0) {
    return { boys: 0, girls: 0, total: 0 };
  }

  const { data: studs } = await admin
    .from("students")
    .select("gender")
    .eq("class_id", classId)
    .eq("status", "active")
    .in("id", ids);

  let boys = 0;
  let girls = 0;
  for (const s of studs ?? []) {
    const g = (s as { gender: string | null }).gender;
    if (g === "male") boys++;
    else if (g === "female") girls++;
  }

  return {
    boys,
    girls,
    total: ids.length,
  };
}

export async function getAttendanceCount(classId: string, date: string) {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("teacher_attendance")
    .select("student_id")
    .eq("class_id", classId)
    .eq("attendance_date", date)
    .in("status", ["present", "late"]);

  const distinct = new Set(
    (rows ?? []).map((r) => (r as { student_id: string }).student_id)
  );
  return distinct.size;
}

/** Present + late on the date, split by student gender (for lesson plan PDF / preview). */
export async function getAttendancePresentByGender(
  classId: string,
  date: string,
  filters?: {
    subjectId?: string | null;
    academicYear?: number;
    term?: SubjectEnrollmentTerm;
  }
): Promise<{ boys: number; girls: number; total: number }> {
  const admin = createAdminClient();
  const subjectId = filters?.subjectId?.trim() || null;

  let attendanceQuery = admin
    .from("teacher_attendance")
    .select("student_id")
    .eq("class_id", classId)
    .eq("attendance_date", date)
    .in("status", ["present", "late"]);

  if (subjectId) {
    const period = getCurrentAcademicYearAndTerm();
    const academicYear = filters?.academicYear ?? period.academicYear;
    const term = filters?.term ?? period.term;

    const enrolledIds = await enrolledStudentIdsForSubjectScope(admin, {
      classId,
      subjectId,
      academicYear,
      term,
    });

    if (enrolledIds.length === 0) {
      return { boys: 0, girls: 0, total: 0 };
    }

    attendanceQuery = attendanceQuery
      .eq("subject_id", subjectId)
      .in("student_id", enrolledIds);
  }

  const { data: rows, error } = await attendanceQuery;

  if (error || !rows?.length) {
    return { boys: 0, girls: 0, total: 0 };
  }

  const attendanceRows = rows as { student_id: string }[];
  const studentIds = [...new Set(attendanceRows.map((r) => r.student_id))];

  const { data: studs } = await admin
    .from("students")
    .select("id, gender")
    .in("id", studentIds);

  const studRows = (studs ?? []) as {
    id: string;
    gender: "male" | "female" | null;
  }[];

  const genderById = new Map(
    studRows.map((s) => [s.id, s.gender])
  );

  let boys = 0;
  let girls = 0;
  for (const sid of studentIds) {
    const g = genderById.get(sid);
    if (g === "male") boys++;
    else if (g === "female") girls++;
  }

  return {
    boys,
    girls,
    total: studentIds.length,
  };
}

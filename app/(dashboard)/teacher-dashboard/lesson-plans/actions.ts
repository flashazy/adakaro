"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseTeachingLearningProcess } from "@/lib/teaching-learning-process";
import type { Json } from "@/types/supabase";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  const data = {
    teacher_id: user.user.id,
    class_id: formData.get("class_id"),
    subject_id: formData.get("subject_id"),
    lesson_date: formData.get("lesson_date"),
    period: parseInt(formData.get("period") as string),
    duration_minutes: parseInt(formData.get("duration_minutes") as string),
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
  redirect("/teacher-dashboard/lesson-plans");
}

export async function updateLessonPlan(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  const data = {
    class_id: formData.get("class_id"),
    subject_id: formData.get("subject_id"),
    lesson_date: formData.get("lesson_date"),
    period: parseInt(formData.get("period") as string),
    duration_minutes: parseInt(formData.get("duration_minutes") as string),
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

export async function getTeacherSubjects() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  if (!user.user) return [];

  const admin = createAdminClient();
  const teacherId = user.user.id;

  const { data: tsRows } = await admin
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_id", teacherId);

  let subjectIds = [
    ...new Set(
      (tsRows ?? []).map((r) => (r as { subject_id: string }).subject_id)
    ),
  ];

  if (subjectIds.length === 0) {
    const { data: taRows } = await admin
      .from("teacher_assignments")
      .select("subject_id")
      .eq("teacher_id", teacherId)
      .not("subject_id", "is", null);

    subjectIds = [
      ...new Set(
        (taRows ?? [])
          .map((r) => (r as { subject_id: string | null }).subject_id)
          .filter((id): id is string => id != null)
      ),
    ];
  }

  if (subjectIds.length === 0) return [];

  const { data: subjects, error } = await admin
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds)
    .order("name");

  if (error) return [];
  return (subjects ?? []) as { id: string; name: string }[];
}

/** Counts only (boys / girls / total). No student rows — ordering does not apply. */
export async function getClassDemographics(classId: string) {
  const admin = createAdminClient();

  const { count: boys, error: boysError } = await admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("gender", "male");

  const { count: girls, error: girlsError } = await admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("gender", "female");

  const { count: total, error: totalError } = await admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);

  return {
    boys: boys || 0,
    girls: girls || 0,
    total: total || 0,
  };
}

export async function getAttendanceCount(classId: string, date: string) {
  const admin = createAdminClient();

  const { count } = await admin
    .from("teacher_attendance")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("attendance_date", date)
    .in("status", ["present", "late"]);

  return count ?? 0;
}

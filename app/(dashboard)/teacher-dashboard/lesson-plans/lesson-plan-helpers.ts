import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { LessonPlanPdfInput } from "@/lib/lesson-plan-pdf";
import { parseTeachingLearningProcess } from "@/lib/teaching-learning-process";
import {
  getAttendancePresentByGender,
  getClassDemographics,
} from "./actions";

/** Ordinal labels for periods 1–12 (Tanzania-style). */
export function periodLabel(period: number): string {
  const ordinals = [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th",
  ];
  return ordinals[period - 1] ?? `${period}th`;
}

function formatDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/**
 * Loads names and builds the PDF payload for a lesson plan row.
 * Used by server actions and the export API route.
 */
export async function loadLessonPlanPdfInput(
  lessonPlanId: string,
  teacherUserId: string
): Promise<
  { ok: true; input: LessonPlanPdfInput } | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("lesson_plans")
    .select("*")
    .eq("id", lessonPlanId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Lesson plan not found." };
  }

  const plan = row as {
    teacher_id: string;
    class_id: string;
    subject_id: string;
    lesson_date: string;
    period: number;
    duration_minutes: number;
    total_boys: number;
    total_girls: number;
    total_pupils: number;
    present_count: number;
    main_competence: string;
    specific_competence: string;
    main_activities: string;
    specific_activities: string;
    teaching_resources: string;
    references: string;
    teaching_learning_process: unknown;
    remarks: string;
  };

  if (plan.teacher_id !== teacherUserId) {
    return { ok: false, error: "Forbidden." };
  }

  const [{ data: classRow }, { data: subjectRow }, { data: profileRow }] =
    await Promise.all([
      admin.from("classes").select("name").eq("id", plan.class_id).maybeSingle(),
      admin
        .from("subjects")
        .select("name")
        .eq("id", plan.subject_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("full_name")
        .eq("id", teacherUserId)
        .maybeSingle(),
    ]);

  const { data: ta } = await admin
    .from("teacher_assignments")
    .select("school_id")
    .eq("teacher_id", teacherUserId)
    .limit(1)
    .maybeSingle();

  const schoolId = (ta as { school_id: string } | null)?.school_id;
  let schoolName: string | null = null;
  if (schoolId) {
    const { data: school } = await admin
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle();
    schoolName = (school as { name: string } | null)?.name ?? null;
  }

  const [roster, presentByGender] = await Promise.all([
    getClassDemographics(plan.class_id),
    getAttendancePresentByGender(plan.class_id, plan.lesson_date),
  ]);

  const input: LessonPlanPdfInput = {
    schoolName,
    teacherName:
      (profileRow as { full_name: string } | null)?.full_name?.trim() ||
      "Teacher",
    subjectName:
      (subjectRow as { name: string } | null)?.name?.trim() || "—",
    className: (classRow as { name: string } | null)?.name?.trim() || "—",
    lessonDateDisplay: formatDateDisplay(plan.lesson_date),
    periodLabel: periodLabel(plan.period),
    durationMinutes: plan.duration_minutes,
    registeredGirls: roster.girls,
    registeredBoys: roster.boys,
    registeredTotal: roster.total,
    presentGirls: presentByGender.girls,
    presentBoys: presentByGender.boys,
    presentTotal: presentByGender.total,
    mainCompetence: plan.main_competence,
    specificCompetence: plan.specific_competence,
    mainActivities: plan.main_activities,
    specificActivities: plan.specific_activities,
    teachingResources: plan.teaching_resources,
    referencesContent: plan.references,
    teachingLearningProcess: parseTeachingLearningProcess(
      plan.teaching_learning_process
    ),
    remarks: plan.remarks,
  };

  return { ok: true, input };
}

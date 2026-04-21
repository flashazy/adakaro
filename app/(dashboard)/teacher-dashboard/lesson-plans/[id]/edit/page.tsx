import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import {
  getLessonPlanById,
  getTeacherClasses,
  getTeacherSubjectsByClass,
} from "../../actions";
import {
  LessonPlanForm,
  type LessonPlanFormInitialData,
} from "../../components/LessonPlanForm";
import type { Database } from "@/types/supabase";

type LessonPlanRow = Database["public"]["Tables"]["lesson_plans"]["Row"];

export const metadata = {
  title: "Edit lesson plan — Teacher",
};

function normalizeClassSubjectOptions(
  raw: unknown[]
): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const item of raw) {
    const o = item as { id?: string; name?: string } | null;
    if (o?.id && o?.name) out.push({ id: o.id, name: o.name });
  }
  return out;
}

export default async function EditLessonPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");
  await ensureTeacherHasAssignmentsOrRedirect(supabase, user.id);

  const planRaw = await getLessonPlanById(id);
  if (!planRaw) notFound();
  const plan = planRaw as LessonPlanRow;

  const [classesRaw, subjectsByClassId] = await Promise.all([
    getTeacherClasses(),
    getTeacherSubjectsByClass(),
  ]);

  const classes = normalizeClassSubjectOptions(
    (classesRaw ?? []) as unknown[]
  );

  const admin = createAdminClient();
  const planClassId = plan.class_id;
  const subList = subjectsByClassId[planClassId] ?? [];
  if (!subList.some((s) => s.id === plan.subject_id)) {
    const { data: row } = await admin
      .from("subjects")
      .select("id, name")
      .eq("id", plan.subject_id)
      .maybeSingle();
    const r = row as { id: string; name: string } | null;
    if (r?.id && r?.name) {
      subjectsByClassId[planClassId] = [...subList, { id: r.id, name: r.name }];
    }
  }

  if (!classes.some((c) => c.id === plan.class_id)) {
    const { data: row } = await admin
      .from("classes")
      .select("id, name")
      .eq("id", plan.class_id)
      .maybeSingle();
    const r = row as { id: string; name: string } | null;
    if (r?.id && r?.name) classes.push({ id: r.id, name: r.name });
  }
  const initialData: LessonPlanFormInitialData = {
    class_id: plan.class_id,
    subject_id: plan.subject_id,
    lesson_date: plan.lesson_date,
    period: plan.period,
    duration_minutes: plan.duration_minutes,
    total_boys: plan.total_boys,
    total_girls: plan.total_girls,
    total_pupils: plan.total_pupils,
    present_count: plan.present_count,
    main_competence: plan.main_competence ?? "",
    specific_competence: plan.specific_competence ?? "",
    main_activities: plan.main_activities ?? "",
    specific_activities: plan.specific_activities ?? "",
    teaching_resources: plan.teaching_resources ?? "",
    teaching_learning_process: plan.teaching_learning_process ?? {},
    references: plan.references ?? "",
    remarks: plan.remarks ?? "",
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Edit lesson plan
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Update fields and save. Demographics refresh from the selected
              class and date.
            </p>
          </div>
          <Link
            href="/teacher-dashboard/lesson-plans"
            className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          >
            ← Back to lesson plans
          </Link>
        </div>

        <LessonPlanForm
          mode="edit"
          planId={id}
          classes={classes}
          subjectsByClassId={subjectsByClassId}
          initialData={initialData}
        />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

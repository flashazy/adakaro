import { redirect } from "next/navigation";
import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { getTeacherClasses, getTeacherSubjectsByClass } from "../actions";
import { LessonPlanForm } from "../components/LessonPlanForm";

export const metadata = {
  title: "New lesson plan — Teacher",
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

export default async function NewLessonPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");
  await ensureTeacherHasAssignmentsOrRedirect(supabase, user.id);

  const [classesRaw, subjectsByClassId] = await Promise.all([
    getTeacherClasses(),
    getTeacherSubjectsByClass(),
  ]);

  const classes = normalizeClassSubjectOptions(
    (classesRaw ?? []) as unknown[]
  );

  return (
    <>
      <div className="max-w-full min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 max-w-full flex-1">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              New lesson plan
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Choose a class first, then a subject you teach for that class.
              Class and date drive pupil counts and present total.
            </p>
          </div>
          <NavLinkWithLoading
            href="/teacher-dashboard/lesson-plans"
            className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          >
            ← Back to lesson plans
          </NavLinkWithLoading>
        </div>

        <div className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LessonPlanForm
            mode="create"
            classes={classes}
            subjectsByClassId={subjectsByClassId}
          />
        </div>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

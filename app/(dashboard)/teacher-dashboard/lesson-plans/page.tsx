import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { getLessonPlans } from "./actions";
import {
  LessonPlansList,
  type LessonPlansListPlanRow,
} from "./components/LessonPlansList";

export default async function LessonPlansPage() {
  const lessonPlans = (await getLessonPlans()) as LessonPlansListPlanRow[];

  return (
    <div className="max-w-full min-w-0 space-y-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Lesson Plans
        </h1>
        <NavLinkWithLoading
          href="/teacher-dashboard/lesson-plans/new"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white touch-manipulation hover:brightness-105 dark:bg-school-primary"
        >
          + New Lesson Plan
        </NavLinkWithLoading>
      </div>

      <LessonPlansList initialPlans={lessonPlans} />
    </div>
  );
}

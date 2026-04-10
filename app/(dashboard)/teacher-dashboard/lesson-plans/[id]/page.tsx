import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TEACHING_LEARNING_PROCESS_STAGES } from "@/lib/teaching-learning-process";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { loadLessonPlanPdfInput } from "../lesson-plan-helpers";

export const metadata = {
  title: "Lesson plan — Teacher",
};

export default async function LessonPlanViewPage({
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

  const loaded = await loadLessonPlanPdfInput(id, user.id);
  if (!loaded.ok) notFound();

  const v = loaded.input;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Lesson plan
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Read-only view. Export PDF or use Edit to change this plan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teacher-dashboard/lesson-plans"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Back to list
            </Link>
            <Link
              href={`/api/lesson-plans/export?id=${encodeURIComponent(id)}`}
              prefetch={false}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Export PDF
            </Link>
            <Link
              href={`/teacher-dashboard/lesson-plans/${id}/edit`}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Edit
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-center text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            LESSON PLAN
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              School:
            </span>{" "}
            {v.schoolName?.trim() || "_______________________________"}
          </p>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                  <th className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                    Subject
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                    Class
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                    Period
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 dark:border-zinc-700">
                  <td className="px-3 py-2 text-slate-900 dark:text-white">
                    {v.lessonDateDisplay}
                  </td>
                  <td className="px-3 py-2 text-slate-900 dark:text-white">
                    {v.subjectName}
                  </td>
                  <td className="px-3 py-2 text-slate-900 dark:text-white">
                    {v.className}
                  </td>
                  <td className="px-3 py-2 text-slate-900 dark:text-white">
                    {v.periodLabel}
                  </td>
                  <td className="px-3 py-2 text-slate-900 dark:text-white">
                    {v.durationMinutes} minutes
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-100 dark:border-zinc-700">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <th
                    colSpan={6}
                    className="px-4 py-2 text-center font-semibold"
                  >
                    Number of Pupils
                  </th>
                </tr>
                <tr className="border-b border-slate-200 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <th
                    colSpan={3}
                    className="px-4 py-2 text-center font-semibold"
                  >
                    Registered
                  </th>
                  <th
                    colSpan={3}
                    className="px-4 py-2 text-center font-semibold"
                  >
                    Present
                  </th>
                </tr>
                <tr className="bg-slate-100 dark:bg-zinc-800">
                  <th className="px-2 py-2 text-center font-semibold">Girls</th>
                  <th className="px-2 py-2 text-center font-semibold">Boys</th>
                  <th className="px-2 py-2 text-center font-semibold">Total</th>
                  <th className="px-2 py-2 text-center font-semibold">Girls</th>
                  <th className="px-2 py-2 text-center font-semibold">Boys</th>
                  <th className="px-2 py-2 text-center font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100 dark:border-zinc-700">
                  <td className="px-2 py-2 text-center tabular-nums">
                    {v.registeredGirls}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {v.registeredBoys}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {v.registeredTotal}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                    {v.presentGirls}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                    {v.presentBoys}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                    {v.presentTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Main competence
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.mainCompetence?.trim() || "—"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Specific competence
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.specificCompetence?.trim() || "—"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Main Activities
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.mainActivities?.trim() || "—"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Specific Activities
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.specificActivities?.trim() || "—"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Teaching and Learning Resources
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.teachingResources?.trim() || "—"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
            Teaching and Learning Process
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-zinc-700">
            <table className="min-w-[720px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800/80">
                  <th className="border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 w-[140px]">
                    Stage
                  </th>
                  <th className="border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 w-[88px]">
                    Time (minutes)
                  </th>
                  <th className="border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 min-w-[140px]">
                    Teaching Activities
                  </th>
                  <th className="border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 min-w-[140px]">
                    Learning Activities
                  </th>
                  <th className="px-2 py-2 font-semibold min-w-[140px]">
                    Assessment Criteria
                  </th>
                </tr>
              </thead>
              <tbody>
                {TEACHING_LEARNING_PROCESS_STAGES.map(({ key, label }) => {
                  const row = v.teachingLearningProcess[key];
                  const time =
                    row?.time === null || row?.time === undefined
                      ? "—"
                      : String(row.time);
                  return (
                    <tr
                      key={key}
                      className="border-b border-slate-100 last:border-b-0 dark:border-zinc-700"
                    >
                      <th
                        scope="row"
                        className="border-r border-slate-100 bg-slate-50/80 px-2 py-2 align-top font-medium text-slate-800 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-200"
                      >
                        {label}
                      </th>
                      <td className="border-r border-slate-100 px-2 py-2 align-top tabular-nums text-slate-800 dark:border-zinc-700 dark:text-zinc-200">
                        {time}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-2 align-top whitespace-pre-wrap text-slate-800 dark:border-zinc-700 dark:text-zinc-200">
                        {row?.teaching_activities?.trim() || "—"}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-2 align-top whitespace-pre-wrap text-slate-800 dark:border-zinc-700 dark:text-zinc-200">
                        {row?.learning_activities?.trim() || "—"}
                      </td>
                      <td className="px-2 py-2 align-top whitespace-pre-wrap text-slate-800 dark:text-zinc-200">
                        {row?.assessment_criteria?.trim() || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            References
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.referencesContent?.trim() || "—"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Remarks / evaluation
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.remarks?.trim() || "—"}
          </p>
        </section>

        <p className="text-sm text-slate-500 dark:text-zinc-500">
          Teacher: {v.teacherName}
        </p>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

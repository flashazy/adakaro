import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TEACHING_LEARNING_PROCESS_STAGES } from "@/lib/teaching-learning-process";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { LessonPlanPrintButton } from "../components/LessonPlanPrintButton";
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
      <div className="max-w-full min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
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
            <LessonPlanPrintButton />
            <Link
              href={`/teacher-dashboard/lesson-plans/${id}/edit`}
              className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
            >
              Edit
            </Link>
          </div>
        </div>

        <div
          id="lesson-plan-print-root"
        className="lesson-plan-print-root max-w-full min-w-0 space-y-6"
        >
          <header className="hidden text-center print:block">
            <p className="text-base font-bold tracking-tight text-black">
              {v.schoolName?.trim() || "_______________________________"}
            </p>
            <h2 className="mt-2 text-sm font-bold tracking-tight text-black">
              TEACHER&apos;S LESSON PLAN
            </h2>
            <div
              className="mx-auto mt-1 h-0.5 w-[min(100%,14rem)] bg-black"
              aria-hidden
            />
          </header>

        <div className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="print:hidden">
            <h2 className="text-center text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              LESSON PLAN
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              <span className="font-medium text-slate-700 dark:text-zinc-300">
                School:
              </span>{" "}
              {v.schoolName?.trim() || "_______________________________"}
            </p>
          </div>

          <div className="mt-6 grid min-w-0 max-w-full grid-cols-1 gap-0 overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-700 lg:grid-cols-[minmax(0,47fr)_minmax(0,53fr)] lg:items-stretch">
          <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col border-b border-slate-200 p-3 dark:border-zinc-700 lg:border-b-0 lg:border-r">
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-auto overflow-y-visible rounded-lg border border-slate-200 dark:border-zinc-700 md:overflow-y-hidden">
            <table className="block w-full min-w-0 max-w-full border-collapse text-sm print:table md:table md:min-w-[36rem] [&_td]:min-w-0">
              <thead className="hidden print:table-header-group md:table-header-group">
                <tr className="bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
                  <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                    Date
                  </th>
                  <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                    Subject
                  </th>
                  <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                    Class
                  </th>
                  <th className="border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 last:border-r-0 dark:border-zinc-700 dark:text-white">
                    Period
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="block print:table-row-group md:table-row-group">
                <tr className="flex flex-col print:table-row md:table-row">
                  <td className="block w-full min-w-0 max-w-full border-b border-slate-200 px-3 py-3 text-slate-900 dark:border-zinc-700 dark:text-white print:table-cell print:border-r print:border-b print:py-2 md:table-cell md:border-r md:border-b md:py-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Date
                    </span>
                    {v.lessonDateDisplay}
                  </td>
                  <td className="block w-full min-w-0 max-w-full border-b border-slate-200 px-3 py-3 text-slate-900 dark:border-zinc-700 dark:text-white print:table-cell print:border-r print:border-b print:py-2 md:table-cell md:border-r md:border-b md:py-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Subject
                    </span>
                    {v.subjectName}
                  </td>
                  <td className="block w-full min-w-0 max-w-full border-b border-slate-200 px-3 py-3 text-slate-900 dark:border-zinc-700 dark:text-white print:table-cell print:border-r print:border-b print:py-2 md:table-cell md:border-r md:border-b md:py-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Class
                    </span>
                    {v.className}
                  </td>
                  <td className="block w-full min-w-0 max-w-full border-b border-slate-200 px-3 py-3 text-slate-900 dark:border-zinc-700 dark:text-white print:table-cell print:border-r print:border-b print:py-2 md:table-cell md:border-r md:border-b md:py-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Period
                    </span>
                    {v.periodLabel}
                  </td>
                  <td className="block w-full min-w-0 max-w-full border-b border-slate-200 px-3 py-3 text-slate-900 dark:text-white print:table-cell print:border-b print:py-2 md:table-cell md:border-b md:py-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                      Time
                    </span>
                    {v.durationMinutes} minutes
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              className="hidden min-h-0 flex-1 grid-cols-5 print:hidden xl:grid"
              aria-hidden
            >
              <div className="border-r border-slate-200 dark:border-zinc-700" />
              <div className="border-r border-slate-200 dark:border-zinc-700" />
              <div className="border-r border-slate-200 dark:border-zinc-700" />
              <div className="border-r border-slate-200 dark:border-zinc-700" />
              <div />
            </div>
          </div>
          </div>

          <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col p-3">
          <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
            <table className="w-full min-w-0 border-collapse text-sm">
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
                <tr>
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
          </div>
        </div>

        <section className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Main competence
          </h3>
          <p className="break-words whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.mainCompetence?.trim() || "—"}
          </p>
        </section>

        <section className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Specific competence
          </h3>
          <p className="break-words whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.specificCompetence?.trim() || "—"}
          </p>
        </section>

        <section className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Main Activities
          </h3>
          <p className="break-words whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.mainActivities?.trim() || "—"}
          </p>
        </section>

        <section className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Specific Activities
          </h3>
          <p className="break-words whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.specificActivities?.trim() || "—"}
          </p>
        </section>

        <section className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Teaching and Learning Resources
          </h3>
          <p className="break-words whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.teachingResources?.trim() || "—"}
          </p>
        </section>

        <section className="lesson-plan-print-tlp max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
            Teaching and Learning Process
          </h3>
          <div className="max-w-full min-w-0 rounded-lg border border-slate-100 dark:border-zinc-700 md:overflow-x-auto">
            <table className="block w-full min-w-0 max-w-full border-collapse text-left text-sm print:table md:table md:w-full md:min-w-[720px] [&_td]:min-w-0 [&_th]:min-w-0">
              <thead className="hidden print:table-header-group md:table-header-group">
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800/80">
                  <th className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 md:w-[140px]">
                    Stage
                  </th>
                  <th className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 md:w-[88px]">
                    Time (minutes)
                  </th>
                  <th className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 md:min-w-[140px]">
                    Teaching Activities
                  </th>
                  <th className="min-w-0 border-r border-slate-200 px-2 py-2 font-semibold dark:border-zinc-600 md:min-w-[140px]">
                    Learning Activities
                  </th>
                  <th className="min-w-0 px-2 py-2 font-semibold md:min-w-[140px]">
                    Assessment Criteria
                  </th>
                </tr>
              </thead>
              <tbody className="block space-y-4 p-4 print:table-row-group print:space-y-0 print:p-0 md:table-row-group md:space-y-0 md:p-0">
                {TEACHING_LEARNING_PROCESS_STAGES.map(({ key, label }) => {
                  const row = v.teachingLearningProcess[key];
                  const time =
                    row?.time === null || row?.time === undefined
                      ? "—"
                      : String(row.time);
                  return (
                    <tr
                      key={key}
                      className="block rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/40 print:table-row print:border-0 print:border-b print:border-slate-100 print:bg-transparent print:p-0 md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent md:p-0 md:last:border-b-0 dark:md:border-zinc-700"
                    >
                      <th
                        scope="row"
                        className="block w-full min-w-0 bg-transparent px-0 pb-3 text-left text-base font-medium text-slate-800 dark:text-zinc-200 print:table-cell print:border-r print:border-slate-100 print:bg-slate-50/80 print:px-2 print:py-2 print:text-sm md:table-cell md:w-auto md:border-r md:border-slate-100 md:bg-slate-50/80 md:px-2 md:py-2 md:text-sm md:align-top dark:border-zinc-700 dark:md:bg-zinc-800/40"
                      >
                        {label}
                      </th>
                      <td className="block w-full min-w-0 py-2 tabular-nums text-slate-800 dark:text-zinc-200 print:table-cell print:border-r print:border-slate-100 print:px-2 print:py-2 md:table-cell md:border-r md:border-slate-100 md:px-2 md:py-2 dark:md:border-zinc-700">
                        <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                          Time (minutes)
                        </span>
                        {time}
                      </td>
                      <td className="block w-full min-w-0 py-2 break-words whitespace-pre-wrap text-slate-800 dark:text-zinc-200 print:table-cell print:border-r print:border-slate-100 print:px-2 print:py-2 md:table-cell md:border-r md:border-slate-100 md:px-2 md:py-2 dark:md:border-zinc-700">
                        <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                          Teaching activities
                        </span>
                        {row?.teaching_activities?.trim() || "—"}
                      </td>
                      <td className="block w-full min-w-0 py-2 break-words whitespace-pre-wrap text-slate-800 dark:text-zinc-200 print:table-cell print:border-r print:border-slate-100 print:px-2 print:py-2 md:table-cell md:border-r md:border-slate-100 md:px-2 md:py-2 dark:md:border-zinc-700">
                        <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                          Learning activities
                        </span>
                        {row?.learning_activities?.trim() || "—"}
                      </td>
                      <td className="block w-full min-w-0 py-2 break-words whitespace-pre-wrap text-slate-800 dark:text-zinc-200 print:table-cell print:px-2 print:py-2 md:table-cell md:px-2 md:py-2">
                        <span className="mb-1 block text-xs font-semibold text-slate-600 print:hidden md:hidden dark:text-zinc-400">
                          Assessment criteria
                        </span>
                        {row?.assessment_criteria?.trim() || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            References
          </h3>
          <p className="break-words whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.referencesContent?.trim() || "—"}
          </p>
        </section>

        <section className="max-w-full min-w-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
            Remarks / evaluation
          </h3>
          <p className="break-words whitespace-pre-wrap text-sm text-slate-800 dark:text-zinc-200">
            {v.remarks?.trim() || "—"}
          </p>
        </section>

        <p className="text-sm text-slate-500 dark:text-zinc-500 print:hidden">
          Teacher: {v.teacherName}
        </p>

        <footer className="hidden text-sm text-black print:block">
          <p>Date: {v.lessonDateDisplay}</p>
          <p className="mt-2">Teacher&apos;s name: {v.teacherName}</p>
        </footer>
        </div>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

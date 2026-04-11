import { format } from "date-fns";
import Link from "next/link";
import { formatPeriodForDisplay } from "@/lib/lesson-plan-period";
import { getLessonPlans } from "./actions";
import { LessonPlanDeleteButton } from "./components/LessonPlanDeleteButton";

type PlanRow = {
  id: string;
  lesson_date: string;
  period: string;
  classes?: { name: string } | null;
  subjects?: { name: string } | null;
};

export default async function LessonPlansPage() {
  const lessonPlans = (await getLessonPlans()) as PlanRow[];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lesson Plans</h1>
        <Link
          href="/teacher-dashboard/lesson-plans/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + New Lesson Plan
        </Link>
      </div>

      {lessonPlans.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-12 text-center">
          <p className="text-gray-500">No lesson plans yet.</p>
          <Link
            href="/teacher-dashboard/lesson-plans/new"
            className="mt-2 inline-block text-blue-600 hover:underline"
          >
            Create your first lesson plan
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full rounded-lg border bg-white">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Class</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lessonPlans.map((plan) => (
                <tr key={plan.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {format(new Date(plan.lesson_date), "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    {plan.classes?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {plan.subjects?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {formatPeriodForDisplay(plan.period)}
                  </td>
                  <td className="space-x-2 px-4 py-3">
                    <Link
                      href={`/teacher-dashboard/lesson-plans/${plan.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    <Link
                      href={`/teacher-dashboard/lesson-plans/${plan.id}/edit`}
                      className="text-green-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <LessonPlanDeleteButton planId={plan.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

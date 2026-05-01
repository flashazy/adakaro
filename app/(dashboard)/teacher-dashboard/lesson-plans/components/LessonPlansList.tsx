"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { formatPeriodForDisplay } from "@/lib/lesson-plan-period";
import { LessonPlanDeleteButton } from "./LessonPlanDeleteButton";

export type LessonPlansListPlanRow = {
  id: string;
  lesson_date: string;
  period: string;
  classes?: { name: string } | null;
  subjects?: { name: string } | null;
};

export function LessonPlansList({
  initialPlans,
}: {
  initialPlans: LessonPlansListPlanRow[];
}) {
  const [plans, setPlans] = useState(initialPlans);

  const removePlan = (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
  };

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950/60">
        <p className="text-slate-500 dark:text-zinc-400">No lesson plans yet.</p>
        <NavLinkWithLoading
          href="/teacher-dashboard/lesson-plans/new"
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-school-primary hover:underline dark:text-school-primary"
        >
          Create your first lesson plan
        </NavLinkWithLoading>
      </div>
    );
  }

  const actionBtnClass =
    "inline-flex min-h-11 min-w-[44px] flex-1 shrink-0 items-center justify-center rounded-lg px-4 text-center text-sm font-medium touch-manipulation transition-colors md:flex-none md:justify-center md:py-2";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full rounded-lg border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <thead className="bg-slate-100 dark:bg-zinc-800/80">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Date
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Class
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Subject
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Period
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr
              key={plan.id}
              className="border-t border-slate-200 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <td className="px-4 py-3 text-slate-900 dark:text-zinc-100">
                {format(new Date(plan.lesson_date), "dd/MM/yyyy")}
              </td>
              <td className="px-4 py-3 text-slate-900 dark:text-zinc-100">
                {plan.classes?.name ?? "-"}
              </td>
              <td className="px-4 py-3 text-slate-900 dark:text-zinc-100">
                {plan.subjects?.name ?? "-"}
              </td>
              <td className="px-4 py-3 text-slate-900 dark:text-zinc-100">
                {formatPeriodForDisplay(plan.period)}
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-xl flex-col gap-2 md:flex-row md:flex-wrap md:gap-3">
                  <Link
                    href={`/teacher-dashboard/lesson-plans/${plan.id}`}
                    className={`${actionBtnClass} text-school-primary underline-offset-4 hover:bg-slate-100 hover:underline dark:hover:bg-zinc-800`}
                  >
                    View
                  </Link>
                  <Link
                    href={`/teacher-dashboard/lesson-plans/${plan.id}/edit`}
                    className={`${actionBtnClass} text-emerald-700 underline-offset-4 hover:bg-emerald-50 hover:underline dark:text-emerald-400 dark:hover:bg-emerald-950/40`}
                  >
                    Edit
                  </Link>
                  <LessonPlanDeleteButton
                    planId={plan.id}
                    onDeleted={() => removePlan(plan.id)}
                    buttonClassName={actionBtnClass}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

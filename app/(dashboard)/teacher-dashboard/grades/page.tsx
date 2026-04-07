import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { TeacherGradebook } from "../components/TeacherGradebook";
import { getTeacherClassOptions } from "../data";

export const metadata = {
  title: "Grades — Teacher",
};

export default async function TeacherGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");
  await ensureTeacherHasAssignmentsOrRedirect(supabase, user.id);

  const options = await getTeacherClassOptions(user.id);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Grades
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Assignments and gradebook for your classes.
            </p>
          </div>
          <Link
            href="/teacher-dashboard"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            ← Back to dashboard
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <TeacherGradebook
            options={options}
            initialClassId={sp.classId?.trim() ?? null}
          />
        </div>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

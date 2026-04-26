import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { fetchClassesWhereUserIsClassTeacher } from "@/lib/class-teacher";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Class teacher — Dashboard",
};

export default async function ClassTeacherDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  const classes = await fetchClassesWhereUserIsClassTeacher(user.id);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Class teacher dashboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              View attendance, students and guardians, and marks for your
              assigned class(es).
            </p>
          </div>
          <Link
            href="/teacher-dashboard"
            className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
          >
            ← Teacher home
          </Link>
        </div>

        {classes.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            You are not assigned as class teacher for any class. Your school
            administrator can set this under{" "}
            <span className="font-medium text-slate-800 dark:text-zinc-200">
              Admin → Classes
            </span>{" "}
            when editing a class.
          </section>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/teacher-dashboard/class-teacher/${c.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    {c.name}
                  </h2>
                  <p className="mt-2 text-sm text-school-primary dark:text-school-primary">
                    Open overview →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

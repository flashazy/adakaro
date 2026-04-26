import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { fetchClassesWhereUserIsClassTeacher } from "@/lib/class-teacher";
import {
  loadAcademicBannerForClass,
  loadClassTeacherHomeSummary,
} from "@/lib/class-teacher-dashboard-home";
import { ClassTeacherDashboardHomeView } from "@/components/class-teacher/class-teacher-dashboard-home-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Class teacher — Dashboard",
};

function firstQueryString(
  v: string | string[] | undefined
): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function ClassTeacherDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ class?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  const classes = await fetchClassesWhereUserIsClassTeacher(user.id);

  const sp = searchParams ? await searchParams : {};
  const requestedClassId = firstQueryString(sp.class)?.trim();

  const selectedClassId =
    requestedClassId && classes.some((c) => c.id === requestedClassId)
      ? requestedClassId
      : (classes[0]?.id ?? "");

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <>
      <div className="space-y-6">
        {classes.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            You are not assigned as class teacher for any class. Your school
            administrator can set this under{" "}
            <span className="font-medium text-slate-800 dark:text-zinc-200">
              Admin → Classes
            </span>{" "}
            when editing a class.
          </section>
        ) : selectedClass ? (
          <ClassTeacherHome
            teacherId={user.id}
            classes={classes}
            selectedClassId={selectedClass.id}
            selectedClassName={selectedClass.name?.trim() || "Class"}
          />
        ) : null}
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

async function ClassTeacherHome(props: {
  teacherId: string;
  classes: Awaited<ReturnType<typeof fetchClassesWhereUserIsClassTeacher>>;
  selectedClassId: string;
  selectedClassName: string;
}) {
  const { teacherId, classes, selectedClassId, selectedClassName } = props;

  const [academic, summary] = await Promise.all([
    loadAcademicBannerForClass(selectedClassId),
    loadClassTeacherHomeSummary(teacherId, selectedClassId),
  ]);

  return (
    <ClassTeacherDashboardHomeView
      classes={classes}
      selectedClassId={selectedClassId}
      selectedClassName={selectedClassName}
      academic={academic}
      summary={summary}
    />
  );
}

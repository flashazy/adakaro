import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { fetchClassesWhereUserIsClassTeacher } from "@/lib/class-teacher";
import { loadClassTeacherMessageParentRows } from "@/lib/class-teacher-messages";
import { ClassTeacherDashboardNavTextLink } from "@/components/class-teacher/class-teacher-dashboard-nav-buttons";
import { ClassTeacherMessagesClient } from "@/components/chat/class-teacher-messages-client";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages — Class teacher",
};

function firstQueryString(
  v: string | string[] | undefined
): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function ClassTeacherMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    parentId?: string | string[];
    studentName?: string | string[];
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  const classes = await fetchClassesWhereUserIsClassTeacher(user.id);
  if (classes.length === 0) {
    redirect("/teacher-dashboard/class-teacher");
  }

  const parentRows = await loadClassTeacherMessageParentRows(user.id);
  const sp = searchParams ? await searchParams : {};
  const initialParentId = firstQueryString(sp.parentId)?.trim() || undefined;
  const initialStudentName =
    firstQueryString(sp.studentName)?.trim() || undefined;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Messages
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Chat with parents of students in your class(es). Updates every few
              seconds while this page is open.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <ClassTeacherDashboardNavTextLink
              href="/teacher-dashboard/class-teacher"
              className="text-school-primary hover:opacity-90 dark:text-school-primary"
            >
              ← Class teacher home
            </ClassTeacherDashboardNavTextLink>
            <Link
              href="/teacher-dashboard"
              className="text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Teacher home
            </Link>
          </div>
        </div>

        <ClassTeacherMessagesClient
          teacherId={user.id}
          parentRows={parentRows}
          initialParentId={initialParentId}
          initialStudentName={initialStudentName}
        />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { userIsClassTeacherForClass } from "@/lib/class-teacher";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import {
  loadClassTeacherAttendanceOverview,
  loadClassTeacherGradesReadOnly,
  loadClassTeacherStudentsWithParents,
} from "../load-class-teacher-data";
import { ClassTeacherClassDetailTablesClient } from "../class-teacher-class-detail-tables-client";

export const dynamic = "force-dynamic";

export default async function ClassTeacherClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const trimmed = classId?.trim();
  if (!trimmed) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  const allowed = await userIsClassTeacherForClass(user.id, trimmed);
  if (!allowed) notFound();

  let className = "Class";
  try {
    const admin = createAdminClient();
    const { data: cls } = await admin
      .from("classes")
      .select("name")
      .eq("id", trimmed)
      .maybeSingle();
    className =
      (cls as { name: string } | null)?.name?.trim() || className;
    const [students, attendance, grades] = await Promise.all([
      loadClassTeacherStudentsWithParents(admin, trimmed),
      loadClassTeacherAttendanceOverview(admin, trimmed),
      loadClassTeacherGradesReadOnly(admin, trimmed),
    ]);

    return (
      <>
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                {className}
              </h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Class teacher overview (read-only marks and attendance).
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <Link
                href="/teacher-dashboard/class-teacher"
                className="text-school-primary hover:opacity-90 dark:text-school-primary"
              >
                All my classes
              </Link>
              <Link
                href="/teacher-dashboard"
                className="text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              >
                Teacher home
              </Link>
            </div>
          </div>

          <ClassTeacherClassDetailTablesClient
            students={students}
            attendance={attendance}
            grades={grades}
          />
        </div>
        <div className="print:hidden">
          <SmartFloatingScrollButton sectionIds={[]} />
        </div>
      </>
    );
  } catch {
    notFound();
  }
}

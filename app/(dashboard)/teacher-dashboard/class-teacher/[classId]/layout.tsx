import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { userIsClassTeacherForClass } from "@/lib/class-teacher";
import { ClassTeacherClassTabs } from "@/components/class-teacher/class-teacher-class-tabs";

export const dynamic = "force-dynamic";

export default async function ClassTeacherClassLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
  } catch {
    /* Keep default label — do not 404 the class workspace on transient load errors. */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Current class
          </p>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {className}
          </h1>
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

      <ClassTeacherClassTabs classId={trimmed} />

      {children}
    </div>
  );
}

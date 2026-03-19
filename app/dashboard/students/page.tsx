import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddStudentForm } from "./add-student-form";
import { StudentList } from "./student-list";
import Link from "next/link";

export default async function StudentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/dashboard/setup");
  const membershipTyped = membership as { school_id: string };
  const schoolId = membershipTyped.school_id;

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name");

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("*, class:classes(id, name)")
    .eq("school_id", schoolId)
    .order("full_name");

  console.log("[students] schoolId:", schoolId);
  console.log("[students] data count:", students?.length ?? "null", "error:", studentsError);

  const typedClasses = (classes ?? []) as { id: string; name: string }[];
  const typedStudents = (students ?? []) as {
    id: string;
    full_name: string;
    admission_number: string | null;
    class_id: string;
    class: { id: string; name: string } | null;
    parent_name: string | null;
    parent_email: string | null;
    parent_phone: string | null;
  }[];
  const classOptions = typedClasses.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Students
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Manage enrolment and student records.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <AddStudentForm classes={classOptions} />
        <StudentList students={typedStudents} classes={classOptions} />
      </main>
    </div>
  );
}

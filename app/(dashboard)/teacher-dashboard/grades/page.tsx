import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { TeacherGradebook } from "../components/TeacherGradebook";
import type { TeacherClassOption } from "../data";

/** Manual widen — admin select with nested relation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function loadTeacherClassOptionsWithAdmin(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<TeacherClassOption[]> {
  const { data: assignments } = await (admin as Db)
    .from("teacher_assignments")
    .select(
      `
      id,
      class_id,
      subject,
      academic_year,
      subject_id,
      subjects ( name )
    `
    )
    .eq("teacher_id", userId);

  const rows =
    (assignments ?? []) as {
      id: string;
      class_id: string;
      subject: string;
      academic_year: string;
      subject_id: string | null;
      subjects: { name: string } | null;
    }[];

  const classIds = [...new Set(rows.map((r) => r.class_id))];
  const classNameById = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: classRows } = await admin
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    for (const c of classRows ?? []) {
      const row = c as { id: string; name: string };
      classNameById.set(row.id, row.name);
    }
  }

  return rows.map((a) => ({
    assignmentId: a.id,
    classId: a.class_id,
    className: classNameById.get(a.class_id) ?? "Class",
    subject:
      a.subjects?.name?.trim() ||
      a.subject?.trim() ||
      "General",
    academicYear: a.academic_year?.trim() || "",
  }));
}

export const metadata = {
  title: "Marks — Teacher",
};

/** Always fresh session-backed gradebook data (avoid stale cached shell). */
export const dynamic = "force-dynamic";

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

  const admin = createAdminClient();
  await admin
    .from("teacher_gradebook_assignments")
    .select("id")
    .eq("teacher_id", user.id)
    .limit(1);
  const options = await loadTeacherClassOptionsWithAdmin(admin, user.id);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Marks
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Assignments and markbook for your classes.
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

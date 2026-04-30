import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeacherTeachingClasses } from "../data";
import {
  TeacherStudentProfilesClient,
  type TeacherProfileStudentRow,
} from "./teacher-student-profiles-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Student Profiles — Teacher",
};

type StudentRow = {
  id: string;
  full_name: string;
  admission_number: string | null;
  class_id: string;
  gender: string | null;
};

export default async function TeacherStudentProfilesListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deptRoleRows } = await supabase
    .from("teacher_department_roles")
    .select("school_id")
    .eq("user_id", user.id);

  const schoolIdsFromDept = [
    ...new Set(
      (deptRoleRows ?? []).map((r) => (r as { school_id: string }).school_id)
    ),
  ];
  const hasDepartmentRole = schoolIdsFromDept.length > 0;

  const classOptions = await getTeacherTeachingClasses(user.id);
  const classIdsFromAssignments = [
    ...new Set(classOptions.map((c) => c.classId)),
  ];

  const classNameById = new Map<string, string>();
  for (const c of classOptions) {
    if (!classNameById.has(c.classId)) {
      classNameById.set(c.classId, c.className);
    }
  }

  const admin = createAdminClient();
  let students: StudentRow[] = [];

  if (hasDepartmentRole) {
    const { data: studentRows } = await admin
      .from("students")
      .select("id, full_name, admission_number, class_id, gender")
      .in("school_id", schoolIdsFromDept)
      .order("full_name", { ascending: true });

    students = (studentRows ?? []) as StudentRow[];

    const allClassIds = [...new Set(students.map((s) => s.class_id))];
    if (allClassIds.length > 0) {
      const { data: classRows } = await admin
        .from("classes")
        .select("id, name")
        .in("id", allClassIds);
      for (const c of classRows ?? []) {
        const row = c as { id: string; name: string };
        classNameById.set(row.id, row.name);
      }
    }
  } else if (classIdsFromAssignments.length > 0) {
    const { data: studentRows } = await admin
      .from("students")
      .select("id, full_name, admission_number, class_id, gender")
      .in("class_id", classIdsFromAssignments)
      .order("full_name", { ascending: true });

    students = (studentRows ?? []) as StudentRow[];
  }

  const tableRows: TeacherProfileStudentRow[] = students.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    admission_number: s.admission_number,
    class_name: classNameById.get(s.class_id) ?? "—",
    gender: s.gender,
  }));

  const noAssignmentsAndNotDept =
    !hasDepartmentRole && classIdsFromAssignments.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <NavLinkWithLoading
          href="/teacher-dashboard"
          className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          ← Back to dashboard
        </NavLinkWithLoading>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Student Profiles
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          {hasDepartmentRole
            ? "All students in your school. Open a profile to view your department section."
            : "Students in your assigned classes. Open a profile to view their profile."}
        </p>
      </div>

      {noAssignmentsAndNotDept ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          You have no class assignments yet. Ask your school administrator to
          assign you to a class in order to see students here.
        </section>
      ) : students.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {hasDepartmentRole
            ? "There are no students enrolled in your school yet."
            : "There are no students enrolled in your classes yet."}
        </section>
      ) : (
        <TeacherStudentProfilesClient students={tableRows} />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { formatShortLocaleDate } from "@/lib/format-date";
import {
  fetchSchoolTeacherMembersForTeachersPage,
  fetchTeacherCoordinatorClassesForSchool,
  fetchTeacherDepartmentRolesForSchool,
} from "./actions";
import type { TeacherDepartment } from "./types";
import { TeachersPageClient, type TeacherRow } from "./teachers-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Teachers — School",
};

export default async function TeachersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const resolved = await resolveSchoolDisplay(user.id, supabase);
  if (!resolved?.schoolId) redirect("/dashboard");

  const schoolId = resolved.schoolId;

  const { data: isAdmin } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );

  if (!isAdmin) redirect("/dashboard");

  const memberRows = await fetchSchoolTeacherMembersForTeachersPage(schoolId);
  const departmentRolesByUser =
    await fetchTeacherDepartmentRolesForSchool(schoolId);
  const coordinatorClassesByUser =
    await fetchTeacherCoordinatorClassesForSchool(schoolId);

  const teacherDisplayName = (
    fullName: string | null | undefined,
    email: string | null | undefined
  ): string => {
    const n = fullName?.trim();
    if (n) return n;
    const e = email?.trim();
    if (e) return e;
    return "Unknown";
  };

  const teachers: TeacherRow[] = memberRows.map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    fullName: teacherDisplayName(m.profileFullName, m.profileEmail),
    email: m.profileEmail,
    joinedAtLabel: formatShortLocaleDate(m.created_at),
    passwordChanged: m.profilePasswordChanged,
    departmentRoles:
      (departmentRolesByUser[m.user_id] as TeacherDepartment[] | undefined) ??
      [],
    coordinatorClassIds: coordinatorClassesByUser[m.user_id] ?? [],
  }));

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, parent_class_id")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  const classRowsTyped = (classRows ?? []) as {
    id: string;
    name: string;
    parent_class_id: string | null;
  }[];

  // Coordinators may supervise a parent class — use the full class list for labels.
  const coordinatorClassOptions = classRowsTyped.map((c) => ({
    id: c.id,
    name: c.name,
    parent_class_id: c.parent_class_id,
  }));

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Teachers
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Create teacher accounts, set department roles and coordinators, and
            manage who belongs to your school. Class and subject teaching
            assignments are on the{" "}
            <Link
              href="/dashboard/assignments"
              className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
            >
              Assignments
            </Link>{" "}
            page. Teachers use the teacher dashboard — they never see fees or
            payments.
          </p>
        </div>
        <TeachersPageClient
          teachers={teachers}
          coordinatorClassOptions={coordinatorClassOptions}
        />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

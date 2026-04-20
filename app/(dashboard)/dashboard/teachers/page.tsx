import { redirect } from "next/navigation";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { formatShortLocaleDate } from "@/lib/format-date";
import { filterLeafClassOptions } from "@/lib/class-options";
import {
  fetchSchoolTeacherMembersForTeachersPage,
  fetchTeacherCoordinatorClassesForSchool,
  fetchTeacherDepartmentRolesForSchool,
} from "./actions";
import type { TeacherDepartment } from "./types";
import {
  TeachersPageClient,
  type AssignmentRow,
  type TeacherRow,
} from "./teachers-page-client";

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

  const profilesById = new Map(
    memberRows.map((m) => [
      m.user_id,
      {
        full_name: m.profileFullName,
        email: m.profileEmail,
      },
    ])
  );

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

  // Coordinators (form masters) may supervise a parent class, so they get the
  // full list. Teacher subject assignments bind to a concrete stream, so the
  // picker there is filtered to non-parent classes only.
  const coordinatorClassOptions = classRowsTyped.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const classOptions = filterLeafClassOptions(classRowsTyped).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const admin = createAdminClient();
  const { data: subjectRows } = await admin
    .from("subjects")
    .select("id, name, code")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  const subjectOptionsList =
    (subjectRows ?? []).map((s) => ({
      id: (s as { id: string }).id,
      name: (s as { name: string }).name,
      code: (s as { code: string | null }).code,
    })) ?? [];

  const subjectById = new Map(subjectOptionsList.map((s) => [s.id, s]));
  const classIds = classOptions.map((c) => c.id);
  const subjectOptionsByClassId: Record<
    string,
    { id: string; name: string; code: string | null }[]
  > = {};
  for (const c of classOptions) {
    subjectOptionsByClassId[c.id] = [];
  }
  if (classIds.length > 0 && subjectOptionsList.length > 0) {
    const { data: scLinks } = await admin
      .from("subject_classes")
      .select("subject_id, class_id")
      .in("class_id", classIds);
    for (const row of scLinks ?? []) {
      const r = row as { subject_id: string; class_id: string };
      const sub = subjectById.get(r.subject_id);
      if (!sub) continue;
      const list = subjectOptionsByClassId[r.class_id] ?? [];
      list.push(sub);
      subjectOptionsByClassId[r.class_id] = list;
    }
    for (const cid of classIds) {
      const arr = subjectOptionsByClassId[cid] ?? [];
      arr.sort((a, b) => a.name.localeCompare(b.name));
      subjectOptionsByClassId[cid] = arr;
    }
  }

  const subjectsData = { subjectOptionsByClassId };
  const subjectOptionsByClassIdResolved =
    subjectsData?.subjectOptionsByClassId ?? {};

  // Service role bypasses RLS so school admins always see all rows for this school.
  // The user-scoped client can return no rows if policies / JWT context do not match.
  const taRes = await admin
    .from("teacher_assignments")
    .select(
      `
      id,
      teacher_id,
      class_id,
      subject,
      subject_id,
      academic_year,
      subjects ( name )
    `
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  const taRows =
    (taRes.data ?? []) as {
      id: string;
      teacher_id: string;
      class_id: string;
      subject: string | null;
      subject_id: string | null;
      academic_year: string | null;
      subjects: { name: string } | null;
    }[];

  // Use the full class list (including any parent classes) for name lookups —
  // legacy teacher_assignments rows may still reference a parent class id.
  const classNameById = new Map(
    coordinatorClassOptions.map((c) => [c.id, c.name])
  );

  const assignments: AssignmentRow[] = taRows.map((row) => {
    const prof = profilesById.get(row.teacher_id);
    const fromCatalog = row.subjects?.name?.trim();
    const legacy = row.subject?.trim() ?? "";
    return {
      id: row.id,
      teacherId: row.teacher_id,
      teacherName: teacherDisplayName(prof?.full_name, prof?.email),
      classId: row.class_id,
      className: classNameById.get(row.class_id) ?? "Class",
      subject: fromCatalog || legacy,
      subjectId: row.subject_id,
      academicYear: row.academic_year ?? "",
    };
  });

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Teachers
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Create teacher accounts with a name and password, assign classes,
            and manage access. Teachers use the teacher dashboard — they never
            see fees or payments.
          </p>
        </div>
        <TeachersPageClient
          teachers={teachers}
          assignments={assignments}
          classOptions={classOptions}
          coordinatorClassOptions={coordinatorClassOptions}
          subjectOptionsByClassId={subjectOptionsByClassIdResolved}
        />
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

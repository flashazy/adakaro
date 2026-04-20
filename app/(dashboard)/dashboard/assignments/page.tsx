import { redirect } from "next/navigation";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSchoolDisplay } from "@/lib/dashboard/resolve-school-display";
import { filterLeafClassOptions } from "@/lib/class-options";
import { AssignmentsPageClient, type AssignmentRow } from "./assignments-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Teacher Assignments — School",
};

function teacherDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const n = fullName?.trim();
  if (n) return n;
  const e = email?.trim();
  if (e) return e;
  return "Unknown";
}

export default async function AssignmentsPage() {
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

  // Teacher subject assignments must target a concrete stream — parent
  // classes are umbrellas and handled cluster-wide via class_cluster_ids.
  const classOptions = filterLeafClassOptions(classRowsTyped).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  // Keep a name-lookup map that includes any parent classes so legacy rows
  // still render with their original class name.
  const allClassNameById = new Map(
    classRowsTyped.map((c) => [c.id, c.name] as const)
  );

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

  const teacherIds = [...new Set(taRows.map((r) => r.teacher_id))];
  const profilesById = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (teacherIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", teacherIds);
    for (const p of profs ?? []) {
      const row = p as {
        id: string;
        full_name: string | null;
        email: string | null;
      };
      profilesById.set(row.id, {
        full_name: row.full_name,
        email: row.email,
      });
    }
  }

  const classNameById = allClassNameById;

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
      <AssignmentsPageClient
        assignments={assignments}
        classOptions={classOptions}
        subjectOptionsByClassId={subjectOptionsByClassId}
      />
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { TeacherGradebook } from "../components/TeacherGradebook";
import type { TeacherClassOption } from "../data";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  normalizeSchoolLevel,
  type SchoolLevel,
} from "@/lib/school-level";

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
  const parentByChild = new Map<string, string | null>();
  if (classIds.length > 0) {
    const { data: classRows } = await admin
      .from("classes")
      .select("id, name, parent_class_id")
      .in("id", classIds);
    for (const c of classRows ?? []) {
      const row = c as {
        id: string;
        name: string;
        parent_class_id: string | null;
      };
      classNameById.set(row.id, row.name);
      parentByChild.set(row.id, row.parent_class_id ?? null);
    }
  }

  // Resolve parent class names so we can add cross-stream options for every
  // child the teacher is assigned to. A single teacher assigned to FORM 1A
  // and FORM 1B will see FORM 1A, FORM 1B, and FORM ONE in their dropdown.
  const parentIds = [
    ...new Set(
      [...parentByChild.values()].filter((v): v is string => typeof v === "string")
    ),
  ];
  const parentNameById = new Map<string, string>();
  if (parentIds.length > 0) {
    const { data: parentRows } = await admin
      .from("classes")
      .select("id, name")
      .in("id", parentIds);
    for (const p of parentRows ?? []) {
      const row = p as { id: string; name: string };
      parentNameById.set(row.id, row.name);
    }
  }

  const streamOptions: TeacherClassOption[] = rows.map((a) => ({
    assignmentId: a.id,
    classId: a.class_id,
    className: classNameById.get(a.class_id) ?? "Class",
    subject:
      a.subjects?.name?.trim() ||
      a.subject?.trim() ||
      "General",
    academicYear: a.academic_year?.trim() || "",
    subjectId: a.subject_id,
  }));

  // Synthesize a "parent class" option for each (parent, subject) pair so the
  // teacher can create a FORM ONE exam that spans every stream. We key on
  // (parent_id + subject display) so each subject the teacher teaches on any
  // child stream shows up exactly once under the parent.
  const parentOptions: TeacherClassOption[] = [];
  const seenParentKey = new Set<string>();
  for (const opt of streamOptions) {
    const parentId = parentByChild.get(opt.classId) ?? null;
    if (!parentId) continue;
    const parentName = parentNameById.get(parentId);
    if (!parentName) continue;
    const key = `${parentId}\0${opt.subject.toLowerCase()}\0${opt.academicYear}`;
    if (seenParentKey.has(key)) continue;
    seenParentKey.add(key);
    parentOptions.push({
      assignmentId: opt.assignmentId,
      classId: parentId,
      className: parentName,
      subject: opt.subject,
      academicYear: opt.academicYear,
      subjectId: opt.subjectId,
    });
  }

  return [...streamOptions, ...parentOptions];
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

  // Look up the teacher's school grading tier so the markbook can default new
  // assignments to the right max score and label grades with the right scale.
  // Falls back to "secondary" if the column is missing or the school isn't
  // resolvable, which keeps legacy databases working unchanged.
  let schoolLevel: SchoolLevel = "secondary";
  try {
    const schoolId = await getSchoolIdForUser(supabase, user.id);
    if (schoolId) {
      const { data: schoolRow } = await admin
        .from("schools")
        .select("school_level")
        .eq("id", schoolId)
        .maybeSingle();
      schoolLevel = normalizeSchoolLevel(
        (schoolRow as { school_level: string | null } | null)?.school_level
      );
    }
  } catch {
    // keep secondary fallback
  }

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
            schoolLevel={schoolLevel}
          />
        </div>
      </div>
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { ensureTeacherHasAssignmentsOrRedirect } from "@/lib/teacher-assignment-status";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { TeacherGradebook } from "../components/TeacherGradebook";
import { getTeacherMarkingClasses } from "../data";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  normalizeSchoolLevel,
  type SchoolLevel,
} from "@/lib/school-level";

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
  const options = await getTeacherMarkingClasses(user.id);

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
            className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
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

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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

  try {
    const admin = createAdminClient();
    const [students, attendance, grades] = await Promise.all([
      loadClassTeacherStudentsWithParents(admin, trimmed),
      loadClassTeacherAttendanceOverview(admin, trimmed),
      loadClassTeacherGradesReadOnly(admin, trimmed),
    ]);

    return (
      <>
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Class List
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Read-only subject participation records for students in this class.
            </p>
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

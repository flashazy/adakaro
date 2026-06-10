import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { CurriculumCoverageDetailClient } from "./curriculum-coverage-detail-client";

export const metadata = {
  title: "Coverage Details — Curriculum",
};

export default async function CurriculumCoverageDetailPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const classId = typeof sp.classId === "string" ? sp.classId : "";
  const teacherId = typeof sp.teacherId === "string" ? sp.teacherId : "";
  const subjectId =
    typeof sp.subjectId === "string" && sp.subjectId ? sp.subjectId : null;
  const academicYear =
    typeof sp.year === "string" ? sp.year : String(currentAcademicYear());
  const subjectName =
    typeof sp.subjectName === "string" ? sp.subjectName : "Subject";
  const teacherName =
    typeof sp.teacherName === "string" ? sp.teacherName : "Teacher";

  if (!classId || !teacherId) {
    return (
      <p className="text-sm text-slate-600">
        Missing class or teacher. Open this page from Curriculum Coverage
        overview.
      </p>
    );
  }

  return (
    <CurriculumCoverageDetailClient
      classId={classId}
      subjectId={subjectId}
      teacherId={teacherId}
      academicYear={academicYear}
      subjectName={subjectName}
      teacherName={teacherName}
    />
  );
}

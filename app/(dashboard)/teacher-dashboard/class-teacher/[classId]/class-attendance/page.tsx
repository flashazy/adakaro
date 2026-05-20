import { notFound } from "next/navigation";
import { SmartFloatingScrollButton } from "@/components/landing/landing-scroll";
import { ClassAttendanceForm } from "@/components/class-teacher/class-attendance-form";
import { loadClassAttendancePageData } from "@/lib/class-attendance/load-class-attendance";
import { todayIsoDate } from "@/lib/class-attendance/class-attendance-utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Class Attendance",
};

function firstQueryString(
  v: string | string[] | undefined
): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function ClassAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<{ date?: string | string[] }>;
}) {
  const { classId } = await params;
  const trimmed = classId?.trim();
  if (!trimmed) notFound();

  const sp = searchParams ? await searchParams : {};
  const requestedDate = firstQueryString(sp.date)?.trim();
  const attendanceDate = requestedDate || todayIsoDate();

  const data = await loadClassAttendancePageData(trimmed, attendanceDate);
  if (!data) notFound();

  return (
    <>
      <ClassAttendanceForm
        classId={data.classId}
        className={data.className}
        initialDate={data.attendanceDate}
        initialHasRecords={data.hasRecordsForDate}
        initialHistory={data.history}
        totalClassStudents={data.totalClassStudents}
        initialDaySummary={data.daySummary}
      />
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

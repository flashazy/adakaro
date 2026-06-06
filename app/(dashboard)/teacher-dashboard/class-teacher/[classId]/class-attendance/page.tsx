import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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
  if (data) {
    return (
      <>
        <ClassAttendanceForm
          classId={data.classId}
          className={data.className}
          initialDate={data.attendanceDate}
          serverToday={todayIsoDate()}
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

  let className = "Class";
  try {
    const admin = createAdminClient();
    const { data: cls } = await admin
      .from("classes")
      .select("id, name")
      .eq("id", trimmed)
      .maybeSingle();
    if (!cls) notFound();
    className = (cls as { name: string }).name?.trim() || className;
  } catch {
    notFound();
  }

  return (
    <>
      <ClassAttendanceForm
        classId={trimmed}
        className={className}
        initialDate={attendanceDate}
        serverToday={todayIsoDate()}
        initialHasRecords={false}
        initialHistory={[]}
        totalClassStudents={0}
        initialDaySummary={null}
      />
      <div className="print:hidden">
        <SmartFloatingScrollButton sectionIds={[]} />
      </div>
    </>
  );
}

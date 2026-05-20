"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ClassTeacherClassTabs({
  classId,
}: {
  classId: string;
}) {
  const pathname = usePathname();
  const base = `/teacher-dashboard/class-teacher/${classId}`;
  const listHref = base;
  const attendanceHref = `${base}/class-attendance`;

  const onAttendance = pathname?.includes("/class-attendance") ?? false;

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex items-center border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
      active
        ? "border-school-primary text-school-primary dark:border-school-primary dark:text-school-primary"
        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
    );

  return (
    <nav
      className="-mb-px flex gap-6 border-b border-slate-200 dark:border-zinc-800"
      aria-label="Class teacher sections"
    >
      <Link href={listHref} className={tabClass(!onAttendance)}>
        Class List
      </Link>
      <Link href={attendanceHref} className={tabClass(onAttendance)}>
        Class Attendance
      </Link>
    </nav>
  );
}

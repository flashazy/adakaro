import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClassAttendanceDaySummary,
  ClassAttendanceHistoryRow,
  ClassAttendancePageData,
  ClassAttendanceStatus,
  ClassAttendanceStudentRow,
  ClassAttendanceStudentsPageData,
  ClassAttendanceTodaySummary,
} from "./class-attendance-types";
import {
  LARGE_STUDENT_LIST_ROW_OPTIONS,
  type LargeStudentListRowOption,
} from "@/lib/student-list-pagination";
import {
  isClassAttendanceStatus,
  presentPercent,
  rollupFromStatuses,
  tallyStatuses,
  todayIsoDate,
} from "./class-attendance-utils";

const HISTORY_DAYS = 45;

async function loadDaySummaryForClass(
  admin: ReturnType<typeof createAdminClient>,
  classId: string,
  attendanceDate: string
): Promise<ClassAttendanceDaySummary | null> {
  const { data: studs, error: stErr } = await admin
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "active");
  if (stErr || !studs?.length) return null;

  const studentIds = (studs as { id: string }[]).map((s) => s.id);

  const { data: rows, error } = await admin
    .from("class_attendance")
    .select("student_id, status")
    .eq("class_id", classId)
    .eq("attendance_date", attendanceDate);
  if (error) return null;

  const attRows = (rows ?? []) as { student_id: string; status: string }[];
  if (attRows.length === 0) return null;

  const statusByStudent = new Map<string, ClassAttendanceStatus>();
  for (const r of attRows) {
    statusByStudent.set(
      r.student_id,
      isClassAttendanceStatus(r.status) ? r.status : "present"
    );
  }

  const statuses: ClassAttendanceStatus[] = studentIds.map(
    (id) => statusByStudent.get(id) ?? "present"
  );
  return tallyStatuses(statuses);
}

function mapStudentRow(
  s: {
    id: string;
    full_name: string;
    admission_number: string | null;
    avatar_url: string | null;
  },
  status: ClassAttendanceStatus,
  notes: string | null
): ClassAttendanceStudentRow {
  return {
    id: s.id,
    fullName: s.full_name?.trim() || "Student",
    admissionNumber: s.admission_number?.trim() || null,
    avatarUrl: s.avatar_url?.trim() || null,
    status,
    notes,
  };
}

export async function loadClassAttendancePageData(
  classId: string,
  attendanceDate: string
): Promise<ClassAttendancePageData | null> {
  try {
    const admin = createAdminClient();

    const { data: cls, error: cErr } = await admin
      .from("classes")
      .select("id, name, school_id")
      .eq("id", classId)
      .maybeSingle();
    if (cErr || !cls) return null;
    const classRow = cls as {
      id: string;
      name: string;
      school_id: string;
    };

    const { count: totalClassStudents, error: countErr } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("status", "active");
    if (countErr) return null;

    const { count: dayRecordCount, error: dErr } = await admin
      .from("class_attendance")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("attendance_date", attendanceDate);
    if (dErr) return null;

    const historyStart = new Date(attendanceDate);
    historyStart.setDate(historyStart.getDate() - HISTORY_DAYS);
    const historyStartIso = historyStart.toISOString().slice(0, 10);

    const { data: histRows, error: hErr } = await admin
      .from("class_attendance")
      .select("attendance_date, status")
      .eq("class_id", classId)
      .gte("attendance_date", historyStartIso)
      .order("attendance_date", { ascending: false });
    if (hErr) return null;

    const byDate = new Map<string, ClassAttendanceStatus[]>();
    for (const r of (histRows ?? []) as {
      attendance_date: string;
      status: string;
    }[]) {
      const date = r.attendance_date;
      if (!date) continue;
      const status = isClassAttendanceStatus(r.status) ? r.status : "present";
      const arr = byDate.get(date) ?? [];
      arr.push(status);
      byDate.set(date, arr);
    }

    const totalStudents = totalClassStudents ?? 0;
    const daySummary = await loadDaySummaryForClass(
      admin,
      classId,
      attendanceDate
    );
    const history: ClassAttendanceHistoryRow[] = [...byDate.entries()]
      .map(([attendanceDateKey, statuses]) => ({
        attendanceDate: attendanceDateKey,
        summary: tallyStatuses(statuses),
        totalStudents: Math.max(totalStudents, statuses.length),
      }))
      .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate))
      .slice(0, 20);

    return {
      classId: classRow.id,
      className: classRow.name?.trim() || "Class",
      schoolId: classRow.school_id,
      attendanceDate,
      hasRecordsForDate: (dayRecordCount ?? 0) > 0,
      history,
      totalClassStudents: totalStudents,
      daySummary,
    };
  } catch {
    return null;
  }
}

export async function loadClassAttendanceTodaySummary(
  classId: string
): Promise<ClassAttendanceTodaySummary | null> {
  try {
    const admin = createAdminClient();
    const today = todayIsoDate();

    const { count: total, error: tcErr } = await admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("status", "active");
    if (tcErr) return null;
    const totalStudents = total ?? 0;
    if (totalStudents === 0) {
      return {
        total: 0,
        inClass: 0,
        notInClass: 0,
        late: 0,
        percentPresent: 0,
      };
    }

    const { data: studs, error: stErr } = await admin
      .from("students")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "active");
    if (stErr) return null;
    const studentIds = ((studs ?? []) as { id: string }[]).map((s) => s.id);

    const { data: rows, error } = await admin
      .from("class_attendance")
      .select("student_id, status")
      .eq("class_id", classId)
      .eq("attendance_date", today);
    if (error) return null;

    const attRows = (rows ?? []) as { student_id: string; status: string }[];
    if (attRows.length === 0) return null;

    const statusByStudent = new Map<string, ClassAttendanceStatus>();
    for (const r of attRows) {
      statusByStudent.set(
        r.student_id,
        isClassAttendanceStatus(r.status) ? r.status : "present"
      );
    }

    const statuses: ClassAttendanceStatus[] = studentIds.map(
      (id) => statusByStudent.get(id) ?? "present"
    );
    const rollup = rollupFromStatuses(statuses);

    return {
      total: totalStudents,
      inClass: rollup.inClass,
      notInClass: rollup.notInClass,
      late: rollup.late,
      percentPresent: presentPercent(rollup.inClass, totalStudents),
    };
  } catch {
    return null;
  }
}

function sanitizeSearchTerm(raw: string): string {
  return raw.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
}

function parsePageSize(n: number): LargeStudentListRowOption {
  return (LARGE_STUDENT_LIST_ROW_OPTIONS as readonly number[]).includes(n)
    ? (n as LargeStudentListRowOption)
    : 25;
}

/**
 * Paginated active students for a class with attendance for one date.
 */
export async function loadClassAttendanceStudentsPage(
  classId: string,
  attendanceDate: string,
  options: {
    page: number;
    pageSize: number;
    search?: string;
  }
): Promise<ClassAttendanceStudentsPageData | null> {
  try {
    const admin = createAdminClient();
    const page = Math.max(1, Math.floor(options.page) || 1);
    const pageSize = parsePageSize(options.pageSize);
    const search = sanitizeSearchTerm(options.search ?? "");
    const offset = (page - 1) * pageSize;

    let studentQuery = admin
      .from("students")
      .select("id, full_name, admission_number, avatar_url", {
        count: "exact",
      })
      .eq("class_id", classId)
      .eq("status", "active")
      .order("full_name");

    if (search.length > 0) {
      const pattern = `%${search}%`;
      studentQuery = studentQuery.or(
        `full_name.ilike.${pattern},admission_number.ilike.${pattern}`
      );
    }

    const { data: students, count, error: stErr } = await studentQuery.range(
      offset,
      offset + pageSize - 1
    );
    if (stErr) return null;

    const studentList = (students ?? []) as {
      id: string;
      full_name: string;
      admission_number: string | null;
      avatar_url: string | null;
    }[];

    const studentIds = studentList.map((s) => s.id);
    const byStudent = new Map<
      string,
      { status: ClassAttendanceStatus; notes: string | null }
    >();

    if (studentIds.length > 0) {
      const { data: dayRows, error: dErr } = await admin
        .from("class_attendance")
        .select("student_id, status, notes")
        .eq("class_id", classId)
        .eq("attendance_date", attendanceDate)
        .in("student_id", studentIds);
      if (dErr) return null;

      for (const r of (dayRows ?? []) as {
        student_id: string;
        status: string;
        notes: string | null;
      }[]) {
        const status = isClassAttendanceStatus(r.status) ? r.status : "present";
        byStudent.set(r.student_id, {
          status,
          notes: r.notes?.trim() ? r.notes.trim() : null,
        });
      }
    }

    const mergedStudents: ClassAttendanceStudentRow[] = studentList.map((s) => {
      const saved = byStudent.get(s.id);
      return mapStudentRow(
        s,
        saved?.status ?? "present",
        saved?.notes ?? null
      );
    });

    return {
      students: mergedStudents,
      totalCount: count ?? 0,
      page,
      pageSize,
    };
  } catch {
    return null;
  }
}

export function hasRecordedToday(
  history: ClassAttendanceHistoryRow[],
  today: string
): boolean {
  return history.some((h) => h.attendanceDate === today);
}

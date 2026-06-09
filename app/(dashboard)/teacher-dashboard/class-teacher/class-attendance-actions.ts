"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsTeacher } from "@/lib/teacher-auth";
import {
  assertCanManageClassAttendance,
  getClassSchoolId,
} from "@/lib/class-attendance/class-attendance-access";
import { canViewHistoricalAttendance } from "@/lib/class-attendance/can-view-historical-attendance";
import {
  loadHistoricalAttendanceForClassTeacher,
  listStudentIdsWithHistoricalAttendance,
  type HistoricalAttendanceClassGroup,
} from "@/lib/class-attendance/load-historical-attendance-for-class-teacher";
import {
  CLASS_ATTENDANCE_STATUSES,
  type ClassAttendanceStatus,
} from "@/lib/class-attendance/class-attendance-types";
import type { ClassAttendanceDaySummary } from "@/lib/class-attendance/class-attendance-types";
import {
  isClassAttendanceStatus,
  parseAttendanceDate,
  tallyStatuses,
} from "@/lib/class-attendance/class-attendance-utils";
import { assertAttendanceDateEditableForSave } from "@/lib/attendance-date-policy";
import {
  loadClassAttendancePageData,
  loadClassAttendanceStudentsPage,
} from "@/lib/class-attendance/load-class-attendance";
import {
  LARGE_STUDENT_LIST_ROW_OPTIONS,
  type LargeStudentListRowOption,
} from "@/lib/student-list-pagination";
import type { Database } from "@/types/supabase";
import { reportHealthAlert } from "@/lib/watchdog/report-health-alert";
import { HEALTH_FEATURES } from "@/lib/watchdog/features";

type ClassAttendanceInsert =
  Database["public"]["Tables"]["class_attendance"]["Insert"];

function revalidateClassAttendancePaths(classId: string) {
  revalidatePath("/teacher-dashboard/class-teacher");
  revalidatePath(`/teacher-dashboard/class-teacher/${classId}`);
  revalidatePath(
    `/teacher-dashboard/class-teacher/${classId}/class-attendance`
  );
}

export type SaveClassAttendanceEntry = {
  studentId: string;
  status: ClassAttendanceStatus;
  notes?: string | null;
};

export async function saveClassAttendanceAction(input: {
  classId: string;
  attendanceDate: string;
  entries: SaveClassAttendanceEntry[];
}): Promise<
  | { ok: true; summary: ClassAttendanceDaySummary }
  | { ok: false; error: string }
> {
  const classId = input.classId?.trim();
  if (!classId) {
    return { ok: false, error: "Invalid class or date." };
  }

  const dateCheck = assertAttendanceDateEditableForSave(input.attendanceDate);
  if (!dateCheck.ok) {
    return { ok: false, error: dateCheck.error };
  }
  const attendanceDate = dateCheck.date;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (!(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Only teachers can save class attendance." };
  }

  const access = await assertCanManageClassAttendance(
    supabase,
    user.id,
    classId
  );
  if (!access.ok) return { ok: false, error: access.error };

  const entries = input.entries ?? [];

  for (const e of entries) {
    if (!e.studentId?.trim()) {
      return { ok: false, error: "Invalid student in attendance list." };
    }
    if (!isClassAttendanceStatus(e.status)) {
      return {
        ok: false,
        error: `Invalid status. Allowed: ${CLASS_ATTENDANCE_STATUSES.join(", ")}.`,
      };
    }
  }

  const admin = createAdminClient();
  const { data: classStudents, error: stErr } = await admin
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "active");
  if (stErr) {
    return { ok: false, error: "Could not verify students for this class." };
  }
  const activeIds = ((classStudents ?? []) as { id: string }[]).map((s) => s.id);
  if (activeIds.length === 0) {
    return { ok: false, error: "No active students in this class." };
  }

  const entryById = new Map(
    entries.map((e) => [e.studentId, e] as const)
  );
  for (const id of entryById.keys()) {
    if (!activeIds.includes(id)) {
      return {
        ok: false,
        error: "One or more students are not active members of this class.",
      };
    }
  }

  const { data: existingRows, error: exErr } = await admin
    .from("class_attendance")
    .select("student_id, status, notes")
    .eq("class_id", classId)
    .eq("attendance_date", attendanceDate)
    .in("student_id", activeIds);
  if (exErr) {
    return {
      ok: false,
      error: "Could not load existing attendance for this date.",
    };
  }

  const existingById = new Map(
    ((existingRows ?? []) as {
      student_id: string;
      status: string;
      notes: string | null;
    }[]).map((r) => [
      r.student_id,
      {
        status: isClassAttendanceStatus(r.status) ? r.status : "present",
        notes: r.notes?.trim() ? r.notes.trim() : null,
      },
    ])
  );

  const rows: ClassAttendanceInsert[] = activeIds.map((studentId) => {
    const fromClient = entryById.get(studentId);
    const fromDb = existingById.get(studentId);
    const status =
      fromClient?.status ?? fromDb?.status ?? ("present" as ClassAttendanceStatus);
    const notes =
      fromClient?.notes !== undefined
        ? fromClient.notes?.trim()
          ? fromClient.notes.trim()
          : null
        : (fromDb?.notes ?? null);
    return {
      school_id: access.schoolId,
      class_id: classId,
      student_id: studentId,
      attendance_date: attendanceDate,
      status,
      notes,
      recorded_by: user.id,
    };
  });

  const { error: upsertErr } = await admin
    .from("class_attendance")
    .upsert(rows as never, {
      onConflict: "class_id,attendance_date,student_id",
    });
  if (upsertErr) {
    void reportHealthAlert({
      feature: HEALTH_FEATURES.classAttendance,
      severity: "high",
      title: "Class attendance save failed",
      message: "Class teacher attendance could not be saved for a class.",
      schoolId: access.schoolId,
      dedupeKey: `class_attendance:save_fail:${classId}:${attendanceDate}`,
      metadata: {
        class_id: classId,
        attendance_date: attendanceDate,
        error: upsertErr.message,
      },
    });
    return {
      ok: false,
      error: "Could not save class attendance. Please try again.",
    };
  }

  revalidateClassAttendancePaths(classId);

  const savedStatuses = rows.map((r) => r.status);
  return { ok: true, summary: tallyStatuses(savedStatuses) };
}

export async function loadClassAttendancePageAction(input: {
  classId: string;
  attendanceDate: string;
}): Promise<
  | { ok: true; data: NonNullable<Awaited<ReturnType<typeof loadClassAttendancePageData>>> }
  | { ok: false; error: string }
> {
  const classId = input.classId?.trim();
  const attendanceDate = parseAttendanceDate(input.attendanceDate);
  if (!classId || !attendanceDate) {
    return { ok: false, error: "Invalid class or date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const access = await assertCanManageClassAttendance(
    supabase,
    user.id,
    classId
  );
  if (!access.ok) return { ok: false, error: access.error };

  const data = await loadClassAttendancePageData(classId, attendanceDate);
  if (!data) {
    return { ok: false, error: "Could not load class attendance." };
  }

  return { ok: true, data };
}

function parsePageSize(raw: number): LargeStudentListRowOption {
  return (LARGE_STUDENT_LIST_ROW_OPTIONS as readonly number[]).includes(raw)
    ? (raw as LargeStudentListRowOption)
    : 25;
}

export async function loadClassAttendanceStudentsPageAction(input: {
  classId: string;
  attendanceDate: string;
  page: number;
  pageSize: number;
  search?: string;
}): Promise<
  | {
      ok: true;
      data: NonNullable<
        Awaited<ReturnType<typeof loadClassAttendanceStudentsPage>>
      >;
    }
  | { ok: false; error: string }
> {
  const classId = input.classId?.trim();
  const attendanceDate = parseAttendanceDate(input.attendanceDate);
  if (!classId || !attendanceDate) {
    return { ok: false, error: "Invalid class or date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const access = await assertCanManageClassAttendance(
    supabase,
    user.id,
    classId
  );
  if (!access.ok) return { ok: false, error: access.error };

  const data = await loadClassAttendanceStudentsPage(classId, attendanceDate, {
    page: Math.max(1, input.page || 1),
    pageSize: parsePageSize(input.pageSize),
    search: input.search,
  });
  if (!data) {
    return { ok: false, error: "Could not load students." };
  }

  return { ok: true, data };
}

async function assertClassTeacherHistoricalAttendanceAccess(
  userId: string,
  classId: string
): Promise<
  | { ok: true; schoolId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const schoolId = await getClassSchoolId(supabase, classId);
  if (!schoolId) {
    return { ok: false, error: "Class not found." };
  }

  const allowed = await canViewHistoricalAttendance(userId, classId);
  if (!allowed) {
    return { ok: false, error: "You do not have permission to view this." };
  }

  return { ok: true, schoolId };
}

async function assertStudentActiveInClass(
  studentId: string,
  classId: string
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("students")
      .select("id")
      .eq("id", studentId)
      .eq("class_id", classId)
      .eq("status", "active")
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function listStudentsWithHistoricalAttendanceAction(input: {
  classId: string;
  studentIds: string[];
}): Promise<
  | { ok: true; studentIds: string[] }
  | { ok: false; error: string }
> {
  const classId = input.classId?.trim();
  if (!classId) {
    return { ok: false, error: "Invalid class." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const access = await assertClassTeacherHistoricalAttendanceAccess(
    user.id,
    classId
  );
  if (!access.ok) {
    return { ok: true, studentIds: [] };
  }

  const ids = [
    ...new Set(
      (input.studentIds ?? []).map((id) => id?.trim()).filter(Boolean)
    ),
  ];
  if (ids.length === 0) {
    return { ok: true, studentIds: [] };
  }

  const withHistory = await listStudentIdsWithHistoricalAttendance(
    classId,
    access.schoolId,
    ids
  );

  return { ok: true, studentIds: [...withHistory] };
}

export async function loadStudentHistoricalAttendanceAction(input: {
  classId: string;
  studentId: string;
}): Promise<
  | { ok: true; groups: HistoricalAttendanceClassGroup[] }
  | { ok: false; error: string }
> {
  const classId = input.classId?.trim();
  const studentId = input.studentId?.trim();
  if (!classId || !studentId) {
    return { ok: false, error: "Invalid class or student." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const access = await assertClassTeacherHistoricalAttendanceAccess(
    user.id,
    classId
  );
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  const inClass = await assertStudentActiveInClass(studentId, classId);
  if (!inClass) {
    return { ok: false, error: "Student not found in this class." };
  }

  const loaded = await loadHistoricalAttendanceForClassTeacher(
    studentId,
    classId,
    access.schoolId
  );
  if (loaded.error) {
    return { ok: false, error: loaded.error };
  }

  return { ok: true, groups: loaded.groups };
}

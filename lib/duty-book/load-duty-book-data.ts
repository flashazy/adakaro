import "server-only";

import {
  classifyStudentDayAttendance,
  emptyAttendanceRollup,
  type AttendanceRollupCounts,
  type StudentHealthRecord,
} from "@/lib/attendance-counts";
import { sortClassRowsByHierarchy } from "@/lib/class-options";
import { isStudentHealthAttendanceStatus } from "@/lib/student-attendance-status";
import type { DutyBookGenderFilter } from "./duty-book-class-filters";
import { isBoyGender, isGirlGender, studentInGenderView } from "./duty-book-gender";
import type {
  DutyBookClassRow,
  DutyBookPayload,
  DutyBookSchoolSummary,
  DutyBookViewSlice,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Db = SupabaseClient<Database>;

const GENDER_VIEWS: DutyBookGenderFilter[] = ["all", "boys", "girls"];

function normalizeDateOnly(raw: string): string | null {
  const d = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d;
}

type ClassSegmentStats = {
  boys: number;
  girls: number;
  rollup: AttendanceRollupCounts;
  hasAttendance: boolean;
};

function emptyClassSegment(): ClassSegmentStats {
  return {
    boys: 0,
    girls: 0,
    rollup: emptyAttendanceRollup(),
    hasAttendance: false,
  };
}

function addRollup(
  target: AttendanceRollupCounts,
  bucket: keyof AttendanceRollupCounts
) {
  target[bucket] += 1;
}

function buildClassRow(
  classId: string,
  className: string,
  stats: ClassSegmentStats,
  view: DutyBookGenderFilter
): DutyBookClassRow {
  const boys = stats.boys;
  const girls = stats.girls;
  const total =
    view === "boys" ? boys : view === "girls" ? girls : boys + girls;

  return {
    classId,
    className,
    boys: view === "girls" ? 0 : boys,
    girls: view === "boys" ? 0 : girls,
    total,
    hasAttendance: stats.hasAttendance,
    present: stats.hasAttendance ? stats.rollup.present : null,
    absent: stats.hasAttendance ? stats.rollup.absent : null,
    ill: stats.hasAttendance ? stats.rollup.ill : null,
    permitted: stats.hasAttendance ? stats.rollup.permitted : null,
  };
}

/**
 * School-wide duty book snapshot for one calendar date.
 * Uses students, teacher_attendance (all subjects), and student_attendance_status.
 *
 * `healthClient` must be an authenticated Supabase client (admin session). The service-role
 * client cannot read `student_attendance_status` until that table is granted to service_role.
 */
export async function loadDutyBookData(
  admin: Db,
  schoolId: string,
  schoolName: string,
  dateInput: string,
  healthClient: Db
): Promise<{ ok: true; data: DutyBookPayload } | { ok: false; error: string }> {
  const date = normalizeDateOnly(dateInput);
  if (!date) {
    return { ok: false, error: "Invalid date. Use YYYY-MM-DD." };
  }

  const [{ data: classRows }, { data: studentRows }, { data: attRowsRaw }] =
    await Promise.all([
      admin
        .from("classes")
        .select("id, name, parent_class_id")
        .eq("school_id", schoolId)
        .order("name"),
      admin
        .from("students")
        .select("id, class_id, gender")
        .eq("school_id", schoolId)
        .eq("approval_status", "approved")
        .neq("status", "inactive"),
      admin
        .from("teacher_attendance")
        .select("student_id, status, attendance_date, subject_id, class_id")
        .eq("school_id", schoolId)
        .eq("attendance_date", date),
    ]);

  const classes = sortClassRowsByHierarchy(
    (classRows ?? []) as {
      id: string;
      name: string;
      parent_class_id: string | null;
    }[]
  );
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  type StudentRow = {
    id: string;
    class_id: string;
    gender: string | null;
  };
  const students = (studentRows ?? []) as StudentRow[];
  const studentIds = students.map((s) => s.id);

  const healthByStudent: Record<string, StudentHealthRecord | undefined> = {};
  if (studentIds.length > 0) {
    const { data: healthRows, error: healthErr } = await healthClient
      .from("student_attendance_status")
      .select("student_id, status, marked_at")
      .in("student_id", studentIds);
    if (healthErr) {
      console.error(
        "[loadDutyBookData] student_attendance_status",
        healthErr.message
      );
    }
    for (const h of (healthRows ?? []) as {
      student_id: string;
      status: string;
      marked_at: string;
    }[]) {
      if (isStudentHealthAttendanceStatus(h.status)) {
        healthByStudent[h.student_id] = {
          status: h.status,
          marked_at: h.marked_at,
        };
      }
    }
  }

  const healthContext = { byStudent: healthByStudent, attendanceDate: date };

  const statusesByStudent = new Map<string, string[]>();
  for (const row of (attRowsRaw ?? []) as { student_id: string; status: string }[]) {
    const list = statusesByStudent.get(row.student_id) ?? [];
    list.push(row.status);
    statusesByStudent.set(row.student_id, list);
  }

  const classStatsByView = new Map<
    string,
    Record<DutyBookGenderFilter, ClassSegmentStats>
  >();

  const schoolRollupByView: Record<DutyBookGenderFilter, AttendanceRollupCounts> =
    {
      all: emptyAttendanceRollup(),
      boys: emptyAttendanceRollup(),
      girls: emptyAttendanceRollup(),
    };
  const schoolBoysByView: Record<DutyBookGenderFilter, number> = {
    all: 0,
    boys: 0,
    girls: 0,
  };
  const schoolGirlsByView: Record<DutyBookGenderFilter, number> = {
    all: 0,
    boys: 0,
    girls: 0,
  };
  const schoolRegisteredByView: Record<DutyBookGenderFilter, number> = {
    all: 0,
    boys: 0,
    girls: 0,
  };

  for (const s of students) {
    if (!classStatsByView.has(s.class_id)) {
      classStatsByView.set(s.class_id, {
        all: emptyClassSegment(),
        boys: emptyClassSegment(),
        girls: emptyClassSegment(),
      });
    }
    const classSegments = classStatsByView.get(s.class_id)!;
    const rollCallStatuses = statusesByStudent.get(s.id) ?? [];
    const bucket = classifyStudentDayAttendance({
      studentId: s.id,
      rollCallStatuses,
      health: healthContext,
    });

    for (const view of GENDER_VIEWS) {
      if (!studentInGenderView(s.gender, view)) continue;

      schoolRegisteredByView[view] += 1;
      if (isBoyGender(s.gender)) {
        schoolBoysByView[view] += 1;
        classSegments[view].boys += 1;
      } else if (isGirlGender(s.gender)) {
        schoolGirlsByView[view] += 1;
        classSegments[view].girls += 1;
      }

      classSegments[view].hasAttendance = true;
      addRollup(classSegments[view].rollup, bucket);
      addRollup(schoolRollupByView[view], bucket);
    }
  }

  const classIdsWithStudents = [
    ...new Set(students.map((s) => s.class_id).filter(Boolean)),
  ];

  const views = {} as Record<DutyBookGenderFilter, DutyBookViewSlice>;

  for (const view of GENDER_VIEWS) {
    const dutyClasses: DutyBookClassRow[] = classIdsWithStudents.map(
      (classId) => {
        const stats =
          classStatsByView.get(classId) ?? {
            all: emptyClassSegment(),
            boys: emptyClassSegment(),
            girls: emptyClassSegment(),
          };
        return buildClassRow(
          classId,
          classNameById.get(classId) ?? "Unknown class",
          stats[view],
          view
        );
      }
    );
    dutyClasses.sort((a, b) => a.className.localeCompare(b.className));

    const summary: DutyBookSchoolSummary = {
      date,
      registered: schoolRegisteredByView[view],
      boys: view === "girls" ? 0 : schoolBoysByView[view],
      girls: view === "boys" ? 0 : schoolGirlsByView[view],
      ...schoolRollupByView[view],
    };

    views[view] = { summary, classes: dutyClasses };
  }

  return {
    ok: true,
    data: {
      schoolName,
      views,
    },
  };
}

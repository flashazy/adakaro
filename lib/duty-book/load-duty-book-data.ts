import "server-only";

import {
  emptyAttendanceRollup,
  type AttendanceRollupCounts,
} from "@/lib/attendance-counts";
import { sortClassRowsByHierarchy } from "@/lib/class-options";
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

/** Map official class_attendance status into duty book rollup buckets. */
function applyClassAttendanceStatus(
  rollup: AttendanceRollupCounts,
  status: string
): void {
  const s = status.toLowerCase();
  switch (s) {
    case "present":
      rollup.present += 1;
      break;
    case "late":
      rollup.late += 1;
      rollup.present += 1;
      break;
    case "absent":
      rollup.absent += 1;
      break;
    case "sick":
      rollup.ill += 1;
      break;
    case "permitted":
      rollup.permitted += 1;
      break;
    default:
      break;
  }
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

function emptySchoolRollupByView(): Record<
  DutyBookGenderFilter,
  AttendanceRollupCounts
> {
  return {
    all: emptyAttendanceRollup(),
    boys: emptyAttendanceRollup(),
    girls: emptyAttendanceRollup(),
  };
}

/**
 * School-wide duty book snapshot for one calendar date.
 * Registered / boys / girls from active students; attendance from class_attendance only.
 */
export async function loadDutyBookData(
  admin: Db,
  schoolId: string,
  schoolName: string,
  dateInput: string
): Promise<{ ok: true; data: DutyBookPayload } | { ok: false; error: string }> {
  const date = normalizeDateOnly(dateInput);
  if (!date) {
    return { ok: false, error: "Invalid date. Use YYYY-MM-DD." };
  }

  const [{ data: classRows }, { data: studentRows }, attResult] =
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
        .eq("status", "active"),
      admin
        .from("class_attendance")
        .select("student_id, class_id, status")
        .eq("school_id", schoolId)
        .eq("attendance_date", date),
    ]);

  let attendanceRows: {
    student_id: string;
    class_id: string;
    status: string;
  }[] = [];

  if (attResult.error) {
    const msg = attResult.error.message ?? "";
    if (!/class_attendance|does not exist|schema cache/i.test(msg)) {
      console.error("[loadDutyBookData] class_attendance", msg);
    }
  } else {
    attendanceRows = (attResult.data ?? []) as {
      student_id: string;
      class_id: string;
      status: string;
    }[];
  }

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
  const genderByStudentId = new Map(
    students.map((s) => [s.id, s.gender] as const)
  );

  const classStatsByView = new Map<
    string,
    Record<DutyBookGenderFilter, ClassSegmentStats>
  >();

  const schoolRollupByView = emptySchoolRollupByView();
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
    }
  }

  for (const row of attendanceRows) {
    const gender = genderByStudentId.get(row.student_id);
    if (!classStatsByView.has(row.class_id)) {
      classStatsByView.set(row.class_id, {
        all: emptyClassSegment(),
        boys: emptyClassSegment(),
        girls: emptyClassSegment(),
      });
    }
    const classSegments = classStatsByView.get(row.class_id)!;

    for (const view of GENDER_VIEWS) {
      if (!studentInGenderView(gender, view)) continue;

      classSegments[view].hasAttendance = true;
      applyClassAttendanceStatus(classSegments[view].rollup, row.status);
      applyClassAttendanceStatus(schoolRollupByView[view], row.status);
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

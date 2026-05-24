import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { batchCheckParentReportEligibility } from "./batch-eligibility";
import { currentCalendarMonth } from "./schedule-types";

export interface CoordinatorClassParentAccess {
  canOpenCount: number;
  cannotOpenCount: number;
  /** `true` when the parent account can open report cards for this student. */
  accessByStudentId: Record<string, boolean>;
}

/**
 * Display-only parent visibility for coordinator report cards (does not gate
 * coordinator generate/send actions).
 */
export async function buildCoordinatorClassParentAccess(
  admin: SupabaseClient,
  params: {
    students: { studentId: string; classId: string }[];
    term: string;
    academicYear: string;
    sendMonth?: number;
  }
): Promise<CoordinatorClassParentAccess> {
  const sendMonth = params.sendMonth ?? currentCalendarMonth();
  const students = params.students;

  if (students.length === 0) {
    return { canOpenCount: 0, cannotOpenCount: 0, accessByStudentId: {} };
  }

  const eligibilityByStudent = await batchCheckParentReportEligibility(
    admin,
    students,
    {
      academicYear: params.academicYear,
      term: params.term,
      sendMonth,
    }
  );

  const accessByStudentId: Record<string, boolean> = {};
  let canOpenCount = 0;
  for (const s of students) {
    const canOpen = eligibilityByStudent.get(s.studentId)?.eligible ?? true;
    accessByStudentId[s.studentId] = canOpen;
    if (canOpen) canOpenCount++;
  }

  return {
    canOpenCount,
    cannotOpenCount: students.length - canOpenCount,
    accessByStudentId,
  };
}

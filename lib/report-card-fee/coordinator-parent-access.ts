import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkParentReportEligibility } from "./eligibility";
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

  const results = await Promise.all(
    students.map(async (s) => {
      const elig = await checkParentReportEligibility(
        s.studentId,
        s.classId,
        admin,
        {
          academicYear: params.academicYear,
          term: params.term,
          sendMonth,
        }
      );
      return { studentId: s.studentId, canOpen: elig.eligible };
    })
  );

  const accessByStudentId: Record<string, boolean> = {};
  let canOpenCount = 0;
  for (const r of results) {
    accessByStudentId[r.studentId] = r.canOpen;
    if (r.canOpen) canOpenCount++;
  }

  return {
    canOpenCount,
    cannotOpenCount: students.length - canOpenCount,
    accessByStudentId,
  };
}

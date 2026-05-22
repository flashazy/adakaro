"use server";

import { checkParentReportEligibility as checkEligibility } from "./eligibility";
import type { ParentReportEligibilityResult } from "./types";

/** Server action entry point for parent report card fee eligibility. */
export async function checkParentReportEligibility(
  studentId: string,
  classId: string
): Promise<ParentReportEligibilityResult> {
  return checkEligibility(studentId, classId);
}

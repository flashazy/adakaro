"use server";

import {
  getReportCardSubjectsForStudent as getReportCardSubjectsForStudentImpl,
  getSubjectsForClass as getSubjectsForClassImpl,
} from "./queries";

export async function getReportCardSubjectsForStudent(
  params: Parameters<typeof getReportCardSubjectsForStudentImpl>[0]
) {
  return getReportCardSubjectsForStudentImpl(params);
}

export async function getSubjectsForClass(classId: string) {
  return getSubjectsForClassImpl(classId);
}

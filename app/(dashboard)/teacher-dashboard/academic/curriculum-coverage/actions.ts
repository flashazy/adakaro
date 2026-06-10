"use server";

import {
  loadCurriculumCoverageExportRows,
  loadCurriculumCoveragePage,
} from "@/lib/curriculum-coverage/load-curriculum-coverage.server";
import { requireCurriculumCoverageAccess } from "@/lib/curriculum-coverage/access.server";
import { loadSyllabusWorkspace } from "@/lib/syllabus-coverage/load-coverage.server";
import {
  reportSyllabusHealthAlert,
  SYLLABUS_HEALTH_REASONS,
} from "@/lib/syllabus-coverage/syllabus-health-alerts";
import type { CurriculumCoverageStatusFilter } from "@/lib/curriculum-coverage/types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";

export async function loadCurriculumCoverageAction(input: {
  academicYear?: string;
  search?: string;
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  statusFilter?: CurriculumCoverageStatusFilter;
  overviewPage?: number;
  overviewPageSize?: number;
  teacherPage?: number;
  teacherPageSize?: number;
  classPage?: number;
  classPageSize?: number;
  teacherSort?: "coverage" | "teacher" | "activity";
  teacherSortDir?: "asc" | "desc";
  behindScheduleOnly?: boolean;
}) {
  const access = await requireCurriculumCoverageAccess();
  if (!access.ok) return { ok: false as const, error: access.error };

  const academicYear =
    input.academicYear?.trim() || String(currentAcademicYear());

  try {
    const data = await loadCurriculumCoveragePage({
      schoolId: access.schoolId,
      academicYear,
      search: input.search,
      classId: input.classId || undefined,
      subjectId: input.subjectId || undefined,
      teacherId: input.teacherId || undefined,
      statusFilter: input.statusFilter ?? "all",
      overviewPage: input.overviewPage ?? 0,
      overviewPageSize: input.overviewPageSize ?? 10,
      teacherPage: input.teacherPage ?? 0,
      teacherPageSize: input.teacherPageSize ?? 10,
      classPage: input.classPage ?? 0,
      classPageSize: input.classPageSize ?? 10,
      teacherSort: input.teacherSort ?? "teacher",
      teacherSortDir: input.teacherSortDir ?? "asc",
      behindScheduleOnly: input.behindScheduleOnly ?? false,
    });
    return { ok: true as const, academicYear, ...data };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId: access.schoolId,
      error: err,
    });
    return { ok: false as const, error: "Could not load curriculum coverage." };
  }
}

export async function loadCurriculumCoverageDetailAction(input: {
  classId: string;
  subjectId: string | null;
  teacherId: string;
  academicYear?: string;
}) {
  const access = await requireCurriculumCoverageAccess();
  if (!access.ok) return { ok: false as const, error: access.error };

  const academicYear =
    input.academicYear?.trim() || String(currentAcademicYear());

  try {
    const workspace = await loadSyllabusWorkspace({
      classId: input.classId,
      subjectId: input.subjectId,
      academicYear,
      teacherId: input.teacherId,
    });
    return { ok: true as const, academicYear, ...workspace };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId: access.schoolId,
      metadata: {
        class_id: input.classId,
        subject_id: input.subjectId ?? undefined,
        teacher_id: input.teacherId,
      },
      error: err,
    });
    return { ok: false as const, error: "Could not load coverage details." };
  }
}

export async function checkCurriculumCoverageAccessAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const access = await requireCurriculumCoverageAccess();
  if (!access.ok) return { ok: false, error: access.error };
  return { ok: true };
}

export async function exportCurriculumCoverageAction(input: {
  academicYear?: string;
  search?: string;
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  statusFilter?: CurriculumCoverageStatusFilter;
}) {
  const access = await requireCurriculumCoverageAccess();
  if (!access.ok) return { ok: false as const, error: access.error };

  const academicYear =
    input.academicYear?.trim() || String(currentAcademicYear());

  try {
    const rows = await loadCurriculumCoverageExportRows({
      schoolId: access.schoolId,
      academicYear,
      search: input.search,
      classId: input.classId || undefined,
      subjectId: input.subjectId || undefined,
      teacherId: input.teacherId || undefined,
      statusFilter: input.statusFilter ?? "all",
    });
    return { ok: true as const, academicYear, rows };
  } catch (err) {
    reportSyllabusHealthAlert({
      reason: SYLLABUS_HEALTH_REASONS.coverageLoadFailed,
      schoolId: access.schoolId,
      error: err,
    });
    return { ok: false as const, error: "Could not export curriculum coverage." };
  }
}

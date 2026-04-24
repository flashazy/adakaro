"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveClassCluster } from "@/lib/class-cluster";
import {
  loadReportCardSupplementaryBatch,
  mergeSupplementaryForPreview,
} from "@/lib/report-card-supplementary";
import type { ReportCardSupplementaryPreviewSlice } from "./report-card-preview-types";
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

/**
 * Calendar / fee / coordinator extras for the teacher report-card workspace
 * (same payload as the coordinator preview). Returns an empty object when the
 * caller is not allowed to read the class.
 */
export async function fetchReportCardSupplementaryForClassTeachers(params: {
  classId: string;
  schoolId: string;
  term: string;
  academicYear: string;
  studentIds: string[];
}): Promise<Record<string, ReportCardSupplementaryPreviewSlice>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: allowed } = await supabase.rpc("is_teacher_for_class", {
    p_class_id: params.classId,
  } as never);
  if (!allowed) return {};

  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, params.classId);
  try {
    const { shared, feeByStudentId } = await loadReportCardSupplementaryBatch(
      admin,
      {
        settingsClassId: cluster.rootClassId,
        schoolId: params.schoolId,
        term: params.term,
        academicYear: params.academicYear,
        studentIds: params.studentIds,
      }
    );
    const out: Record<string, ReportCardSupplementaryPreviewSlice> = {};
    for (const sid of params.studentIds) {
      out[sid] = mergeSupplementaryForPreview(
        shared,
        feeByStudentId.get(sid) ?? null
      );
    }
    return out;
  } catch {
    return {};
  }
}

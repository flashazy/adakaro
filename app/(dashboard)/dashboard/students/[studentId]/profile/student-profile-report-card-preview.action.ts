"use server";

import { createClient } from "@/lib/supabase/server";
import { canUserAccessStudentProfile } from "@/lib/student-profile-access";
import { buildStudentProfileReportCardPreviewData } from "./build-student-profile-report-card-preview";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";

export type LoadStudentProfileReportCardPreviewState =
  | { ok: true; data: ReportCardPreviewData; reportCardStatus: string }
  | { ok: false; error: string };

export async function loadStudentProfileReportCardPreviewData(
  studentId: string,
  reportCardId: string
): Promise<LoadStudentProfileReportCardPreviewState> {
  const sid = studentId.trim();
  const rcid = reportCardId.trim();
  if (!sid || !rcid) {
    return { ok: false, error: "Missing report card or student." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: st } = await supabase
    .from("students")
    .select("id, class_id, school_id")
    .eq("id", sid)
    .maybeSingle();
  const student = st as
    | { id: string; class_id: string; school_id: string }
    | null;
  if (!student) {
    return { ok: false, error: "Student not found." };
  }

  const canView = await canUserAccessStudentProfile(
    supabase,
    user.id,
    student
  );
  if (!canView) {
    return { ok: false, error: "You do not have access to this student." };
  }

  const built = await buildStudentProfileReportCardPreviewData({
    studentId: sid,
    reportCardId: rcid,
  });
  if (!built.ok) {
    return { ok: false, error: "Report card not found." };
  }

  return {
    ok: true,
    data: built.data,
    reportCardStatus: built.status,
  };
}

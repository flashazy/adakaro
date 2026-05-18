import { createAdminClient } from "@/lib/supabase/admin";
import { loadDutyBookEvents } from "./load-duty-book-events";
import { attachDutyBookDisplayNames } from "./resolve-duty-book-display-names";
import { syncDutyBookEvents } from "./sync-duty-book-events";
import type { DutyBookEvent, DutyBookReportRow } from "./duty-book-report-types";

type ReportDbRow = {
  id: string;
  school_id: string;
  report_date: string;
  remarks: string | null;
  head_teacher_comment: string | null;
  head_teacher_signature: string | null;
  head_teacher_id: string | null;
  signed_at: string | null;
  created_by: string;
  remarks_last_modified_by_id: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeRemarks(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function mapRow(
  row: ReportDbRow,
  events: DutyBookEvent[]
): DutyBookReportRow {
  return {
    id: row.id,
    schoolId: row.school_id,
    reportDate: row.report_date,
    events,
    remarks: row.remarks ?? "",
    headTeacherComment: row.head_teacher_comment ?? "",
    headTeacherSignature: row.head_teacher_signature,
    headTeacherId: row.head_teacher_id,
    signedAt: row.signed_at,
    createdBy: row.created_by,
    remarksLastModifiedById: row.remarks_last_modified_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REPORT_SELECT =
  "id, school_id, report_date, remarks, head_teacher_comment, head_teacher_signature, head_teacher_id, signed_at, created_by, remarks_last_modified_by_id, created_at, updated_at";

export async function persistDutyBookReport(input: {
  schoolId: string;
  reportDate: string;
  userId: string;
  events: DutyBookEvent[];
  remarks: string | null;
}): Promise<DutyBookReportRow> {
  const admin = createAdminClient();

  const { data: existing, error: loadErr } = await admin
    .from("duty_book_reports")
    .select(
      "id, signed_at, remarks, remarks_last_modified_by_id"
    )
    .eq("school_id", input.schoolId)
    .eq("report_date", input.reportDate)
    .maybeSingle();

  if (loadErr) {
    throw new Error(loadErr.message);
  }

  const existingRow = existing as {
    id: string;
    signed_at: string | null;
    remarks: string | null;
    remarks_last_modified_by_id: string | null;
  } | null;

  if (existingRow?.signed_at) {
    throw new Error("This report is signed and can no longer be edited.");
  }

  const remarksValue = normalizeRemarks(input.remarks);
  const previousRemarks = normalizeRemarks(existingRow?.remarks ?? null);
  const remarksChanged = remarksValue !== previousRemarks;
  const remarksLastModifiedById = remarksChanged
    ? input.userId
    : (existingRow?.remarks_last_modified_by_id ?? null);

  let reportId = existingRow?.id;
  let reportRow: ReportDbRow;

  if (existingRow) {
    const { data, error } = await admin
      .from("duty_book_reports")
      .update({
        remarks: remarksValue,
        remarks_last_modified_by_id: remarksLastModifiedById,
      } as never)
      .eq("id", existingRow.id)
      .eq("school_id", input.schoolId)
      .select(REPORT_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    reportRow = data as ReportDbRow;
    reportId = reportRow.id;
  } else {
    const { data, error } = await admin
      .from("duty_book_reports")
      .insert({
        school_id: input.schoolId,
        report_date: input.reportDate,
        events: [],
        remarks: remarksValue,
        remarks_last_modified_by_id: remarksValue ? input.userId : null,
        created_by: input.userId,
      } as never)
      .select(REPORT_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    reportRow = data as ReportDbRow;
    reportId = reportRow.id;
  }

  const existingEvents = reportId
    ? await loadDutyBookEvents(admin, reportId, [])
    : [];

  await syncDutyBookEvents(admin, {
    reportId: reportId!,
    schoolId: input.schoolId,
    userId: input.userId,
    events: input.events,
    existingEvents,
  });

  const events = await loadDutyBookEvents(admin, reportId!, []);
  const report = mapRow(reportRow, events);
  return attachDutyBookDisplayNames(report);
}

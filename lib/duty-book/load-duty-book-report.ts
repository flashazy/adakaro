import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { resolveUserDisplayName } from "@/lib/users/resolve-user-display-name";
import { loadDutyBookEvents } from "./load-duty-book-events";
import { attachDutyBookDisplayNames } from "./resolve-duty-book-display-names";
import type {
  DutyBookReportPayload,
  DutyBookReportRow,
  DutyBookReportSigner,
} from "./duty-book-report-types";

type Supabase = SupabaseClient<Database>;

type ReportDbRow = {
  id: string;
  school_id: string;
  report_date: string;
  events: unknown;
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

async function mapReportRow(
  supabase: Supabase,
  row: ReportDbRow
): Promise<DutyBookReportRow> {
  const events = await loadDutyBookEvents(supabase, row.id, row.events);
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

export async function loadDutyBookReport(
  supabase: Supabase,
  schoolId: string,
  reportDate: string
): Promise<DutyBookReportPayload> {
  const { data, error } = await supabase
    .from("duty_book_reports")
    .select(
      "id, school_id, report_date, events, remarks, head_teacher_comment, head_teacher_signature, head_teacher_id, signed_at, created_by, remarks_last_modified_by_id, created_at, updated_at"
    )
    .eq("school_id", schoolId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as ReportDbRow | null;
  if (!row) {
    return { report: null, signer: null };
  }

  const report = await attachDutyBookDisplayNames(await mapReportRow(supabase, row));
  let signer: DutyBookReportSigner | null = null;
  if (report.headTeacherId) {
    const fullName = await resolveUserDisplayName(
      report.headTeacherId,
      report.headTeacherSignature?.trim() || "Head teacher"
    );
    signer = { id: report.headTeacherId, fullName };
  }

  return { report, signer };
}

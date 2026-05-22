import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportCardFeeAuditAction } from "./types";

type AuditDb = SupabaseClient;

export async function logReportCardFeeAudit(
  db: AuditDb,
  entry: {
    schoolId: string;
    classId?: string | null;
    studentId?: string | null;
    performedBy: string;
    action: ReportCardFeeAuditAction;
    details?: Record<string, unknown> | null;
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db as any).from("report_card_fee_audit_log").insert({
    school_id: entry.schoolId,
    class_id: entry.classId ?? null,
    student_id: entry.studentId ?? null,
    performed_by: entry.performedBy,
    action: entry.action,
    details: entry.details ?? null,
  });
  if (error) {
    console.error("[logReportCardFeeAudit]", error.message);
  }
}

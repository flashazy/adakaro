import "server-only";

import { sanitizePaymentError } from "@/lib/watchdog/payment-metadata";
import { HEALTH_FEATURES } from "@/lib/watchdog/features";
import { reportHealthAlert } from "@/lib/watchdog/report-health-alert";

const SYLLABUS_METADATA_ALLOWLIST = new Set([
  "school_id",
  "class_id",
  "subject_id",
  "topic_id",
  "subtopic_id",
  "teacher_id",
  "reason",
  "error_code",
  "error_message",
]);

function buildSyllabusAlertMetadata(
  input: Record<string, unknown> | undefined,
  error?: unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input) {
    for (const [key, value] of Object.entries(input)) {
      if (!SYLLABUS_METADATA_ALLOWLIST.has(key)) continue;
      if (value === undefined) continue;
      out[key] = value;
    }
  }
  if (error !== undefined) {
    const sanitized = sanitizePaymentError(error);
    if (sanitized.error_code) out.error_code = sanitized.error_code;
    out.error_message = sanitized.error_message;
  }
  return out;
}

export const SYLLABUS_HEALTH_REASONS = {
  topicSaveFailed: "topic_save_failed",
  subtopicSaveFailed: "subtopic_save_failed",
  topicEditFailed: "topic_edit_failed",
  subtopicEditFailed: "subtopic_edit_failed",
  noteSaveFailed: "note_save_failed",
  progressSaveFailed: "progress_save_failed",
  coverageLoadFailed: "coverage_load_failed",
  bulkImportFailed: "bulk_import_failed",
} as const;

export type SyllabusHealthReason =
  (typeof SYLLABUS_HEALTH_REASONS)[keyof typeof SYLLABUS_HEALTH_REASONS];

function buildSyllabusDedupeKey(params: {
  schoolId?: string | null;
  reason: SyllabusHealthReason;
  classId?: string | null;
}): string {
  const school = params.schoolId?.trim().toLowerCase();
  const reason = params.reason;
  if (school) return `${school}:syllabus_coverage:${reason}`;
  return `platform:syllabus_coverage:${reason}`;
}

export function reportSyllabusHealthAlert(params: {
  reason: SyllabusHealthReason;
  schoolId?: string | null;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): void {
  const meta = buildSyllabusAlertMetadata(
    {
      ...params.metadata,
      reason: params.reason,
      school_id: params.schoolId ?? undefined,
    },
    params.error
  );

  void reportHealthAlert({
    feature: HEALTH_FEATURES.syllabusCoverage,
    severity: "high",
    title: "Syllabus coverage failure",
    message: "A syllabus coverage operation could not be completed.",
    schoolId: params.schoolId ?? null,
    dedupeKey: buildSyllabusDedupeKey({
      schoolId: params.schoolId,
      reason: params.reason,
      classId:
        typeof params.metadata?.class_id === "string"
          ? params.metadata.class_id
          : null,
    }),
    metadata: meta,
  });
}

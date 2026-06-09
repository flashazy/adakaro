import "server-only";

import { sanitizePaymentError } from "@/lib/watchdog/payment-metadata";

/** Allowed auth/dashboard Health Center metadata keys. */
const AUTH_METADATA_ALLOWLIST = new Set([
  "school_id",
  "student_id",
  "user_id",
  "reason",
  "path",
  "phase",
  "class_id",
  "source",
  "error_code",
  "error_message",
]);

const AUTH_METADATA_FORBIDDEN = new Set([
  "email",
  "phone",
  "full_name",
  "parent_name",
  "student_name",
  "admission_number",
  "student_admission_number",
  "parent_id",
  "error",
  "identifier",
  "customername",
  "customeremail",
  "customerphone",
  "raw_webhook",
  "notes",
]);

/** Filters auth/dashboard alert metadata — no PII, sanitized errors. */
export function buildAuthAlertMetadata(
  input: Record<string, unknown> | undefined,
  error?: unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (input) {
    for (const [key, value] of Object.entries(input)) {
      const normalized = key.trim().toLowerCase();
      if (AUTH_METADATA_FORBIDDEN.has(normalized)) continue;
      if (!AUTH_METADATA_ALLOWLIST.has(key)) continue;
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

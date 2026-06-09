import "server-only";

/** Allowed payment Health Center metadata keys (PII review). */
const PAYMENT_METADATA_ALLOWLIST = new Set([
  "school_id",
  "student_id",
  "payment_id",
  "order_reference",
  "payment_reference",
  "clickpesa_bill_id",
  "bill_id",
  "reason",
  "source",
  "payment_method",
  "amount",
  "webhook_received_at",
  "fee_structure_id",
  "error_code",
  "error_message",
]);

/** Keys that must never be stored on payment health alerts. */
const PAYMENT_METADATA_FORBIDDEN = new Set([
  "customername",
  "customeremail",
  "customerphone",
  "raw_webhook",
  "notes",
  "admission_number",
  "student_admission_number",
  "parent_id",
  "email",
  "phone",
  "full_name",
  "parent_name",
  "student_name",
  "error",
  "phase",
]);

const MAX_ERROR_MESSAGE_LENGTH = 500;

export function sanitizePaymentError(
  error: unknown
): { error_code: string | null; error_message: string } {
  if (error == null) {
    return { error_code: null, error_message: "unknown_error" };
  }
  if (typeof error === "object" && error !== null) {
    const row = error as { code?: string; message?: string };
    const code =
      typeof row.code === "string" && row.code.trim()
        ? row.code.trim().slice(0, 32)
        : null;
    const message =
      typeof row.message === "string" && row.message.trim()
        ? row.message.trim().slice(0, MAX_ERROR_MESSAGE_LENGTH)
        : "unknown_error";
    return { error_code: code, error_message: message };
  }
  const text = String(error).trim().slice(0, MAX_ERROR_MESSAGE_LENGTH);
  return { error_code: null, error_message: text || "unknown_error" };
}

/**
 * Filters and normalizes payment alert metadata. Strips PII and legacy keys.
 */
export function buildPaymentAlertMetadata(
  input: Record<string, unknown> | undefined,
  error?: unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (input) {
    for (const [key, value] of Object.entries(input)) {
      const normalized = key.trim().toLowerCase();
      if (PAYMENT_METADATA_FORBIDDEN.has(normalized)) continue;
      if (!PAYMENT_METADATA_ALLOWLIST.has(key)) continue;
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

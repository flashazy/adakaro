import "server-only";

import type { PaymentSettlementReason } from "@/lib/watchdog/payment-reasons";
import {
  isPlatformPaymentSettlementReason,
  PAYMENT_SETTLEMENT_REASONS,
} from "@/lib/watchdog/payment-reasons";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @deprecated Phase 2B — global payment keys replaced by scoped keys. */
export const LEGACY_PAYMENT_DEDUPE_KEYS = {
  paymentSettlementFailure: "payment_settlement_failure",
  paymentReceiptFailure: "payment_receipt_failure",
} as const;

export function normalizeOrderReferenceForKey(orderReference: string): string {
  return orderReference.trim().slice(0, 64);
}

export function buildPaymentSettlementDedupeKey(params: {
  reason: PaymentSettlementReason;
  schoolId?: string | null;
  orderReference?: string | null;
  studentId?: string | null;
  feeStructureId?: string | null;
}): string | null {
  const { reason } = params;

  if (reason === PAYMENT_SETTLEMENT_REASONS.adminClientUnavailable) {
    return "platform:payment_settlement:admin_client_unavailable";
  }
  if (reason === PAYMENT_SETTLEMENT_REASONS.unexpectedException) {
    return "platform:payment_settlement:unexpected_exception";
  }

  if (reason === PAYMENT_SETTLEMENT_REASONS.feeBillNotFound) {
    const order = params.orderReference?.trim();
    if (!order) return null;
    return `platform:payment_settlement:fee_bill_not_found:${normalizeOrderReferenceForKey(order)}`;
  }

  if (reason === PAYMENT_SETTLEMENT_REASONS.reactivationBillNotFound) {
    const order = params.orderReference?.trim();
    if (!order) return null;
    return `platform:payment_settlement:reactivation_bill_not_found:${normalizeOrderReferenceForKey(order)}`;
  }

  if (reason === PAYMENT_SETTLEMENT_REASONS.manualPaymentInsert) {
    const schoolId = params.schoolId?.trim();
    const studentId = params.studentId?.trim();
    const feeStructureId = params.feeStructureId?.trim();
    if (!schoolId || !UUID_RE.test(schoolId)) return null;
    if (!studentId || !UUID_RE.test(studentId)) return null;
    if (!feeStructureId || !UUID_RE.test(feeStructureId)) return null;
    return `${schoolId.toLowerCase()}:payment_settlement:manual_payment_insert:${studentId.toLowerCase()}:${feeStructureId.toLowerCase()}`;
  }

  const schoolId = params.schoolId?.trim();
  const order = params.orderReference?.trim();
  if (!schoolId || !UUID_RE.test(schoolId)) return null;
  if (!order) return null;

  return `${schoolId.toLowerCase()}:payment_settlement:${normalizeOrderReferenceForKey(order)}:${reason}`;
}

export function buildPaymentReceiptDedupeKey(params: {
  schoolId: string;
  paymentId: string;
}): string | null {
  const schoolId = params.schoolId?.trim();
  const paymentId = params.paymentId?.trim();
  if (!schoolId || !UUID_RE.test(schoolId)) return null;
  if (!paymentId || !UUID_RE.test(paymentId)) return null;
  return `${schoolId.toLowerCase()}:payment_receipt:${paymentId.toLowerCase()}`;
}

export function schoolIdForPaymentDedupeKey(
  dedupeKey: string,
  explicitSchoolId?: string | null
): string | null {
  if (dedupeKey.startsWith("platform:")) return null;
  const prefix = dedupeKey.split(":")[0]?.toLowerCase();
  if (prefix && UUID_RE.test(prefix)) return prefix;
  return explicitSchoolId?.trim().toLowerCase() ?? null;
}

export function assertSchoolIdMatchesDedupeKey(
  dedupeKey: string,
  schoolId: string | null | undefined
): string | null {
  if (dedupeKey.startsWith("platform:")) return null;
  const fromKey = schoolIdForPaymentDedupeKey(dedupeKey);
  if (!fromKey) return schoolId ?? null;
  const explicit = schoolId?.trim().toLowerCase();
  if (explicit && explicit !== fromKey) return fromKey;
  return fromKey;
}

export function isPlatformPaymentDedupeKey(dedupeKey: string): boolean {
  return dedupeKey.startsWith("platform:");
}

/** Map legacy webhook phase strings to registry reasons. */
export function legacyPhaseToSettlementReason(
  phase: string | undefined
): PaymentSettlementReason | null {
  switch (phase) {
    case "admin_client":
      return PAYMENT_SETTLEMENT_REASONS.adminClientUnavailable;
    case "payment_insert":
      return PAYMENT_SETTLEMENT_REASONS.paymentInsert;
    case "duplicate_fee_settlement":
    case "duplicate_reactivation_settlement":
      return null;
    case "fee_bill_not_found":
      return PAYMENT_SETTLEMENT_REASONS.feeBillNotFound;
    case "reactivation_bill_not_found":
      return PAYMENT_SETTLEMENT_REASONS.reactivationBillNotFound;
    case "reactivation_bill_update":
      return PAYMENT_SETTLEMENT_REASONS.reactivationBillUpdate;
    case "school_reactivation":
      return PAYMENT_SETTLEMENT_REASONS.schoolReactivationUpdate;
    case "unexpected_exception":
      return PAYMENT_SETTLEMENT_REASONS.unexpectedException;
    default:
      return null;
  }
}

export { isPlatformPaymentSettlementReason };

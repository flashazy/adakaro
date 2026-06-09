import "server-only";

/** Official payment settlement reasons (Phase 2B registry). */
export const PAYMENT_SETTLEMENT_REASONS = {
  adminClientUnavailable: "admin_client_unavailable",
  paymentInsert: "payment_insert",
  transactionInsert: "transaction_insert",
  feeBillNotFound: "fee_bill_not_found",
  reactivationBillNotFound: "reactivation_bill_not_found",
  reactivationBillUpdate: "reactivation_bill_update",
  schoolReactivationUpdate: "school_reactivation_update",
  manualPaymentInsert: "manual_payment_insert",
  billPersist: "bill_persist",
  unexpectedException: "unexpected_exception",
} as const;

export type PaymentSettlementReason =
  (typeof PAYMENT_SETTLEMENT_REASONS)[keyof typeof PAYMENT_SETTLEMENT_REASONS];

/** Reasons that must not create Health Center alerts. */
export const PAYMENT_SETTLEMENT_SUPPRESSED_REASONS = new Set([
  "duplicate_fee_settlement",
  "duplicate_reactivation_settlement",
]);

export const PAYMENT_RECEIPT_REASON = "receipt_missing" as const;

const PLATFORM_SETTLEMENT_REASONS = new Set<PaymentSettlementReason>([
  PAYMENT_SETTLEMENT_REASONS.adminClientUnavailable,
  PAYMENT_SETTLEMENT_REASONS.unexpectedException,
]);

const PLATFORM_ORDER_SETTLEMENT_REASONS = new Set<PaymentSettlementReason>([
  PAYMENT_SETTLEMENT_REASONS.feeBillNotFound,
  PAYMENT_SETTLEMENT_REASONS.reactivationBillNotFound,
]);

export function isPlatformPaymentSettlementReason(
  reason: PaymentSettlementReason
): boolean {
  return (
    PLATFORM_SETTLEMENT_REASONS.has(reason) ||
    PLATFORM_ORDER_SETTLEMENT_REASONS.has(reason)
  );
}

export function settlementSeverity(
  reason: PaymentSettlementReason
): "critical" | "high" {
  if (
    reason === PAYMENT_SETTLEMENT_REASONS.transactionInsert ||
    reason === PAYMENT_SETTLEMENT_REASONS.billPersist
  ) {
    return "high";
  }
  return "critical";
}

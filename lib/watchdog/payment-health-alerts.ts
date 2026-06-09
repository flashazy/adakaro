import "server-only";

import {
  assertSchoolIdMatchesDedupeKey,
  buildPaymentReceiptDedupeKey,
  buildPaymentSettlementDedupeKey,
} from "@/lib/watchdog/payment-dedupe-keys";
import { buildPaymentAlertMetadata } from "@/lib/watchdog/payment-metadata";
import type { PaymentSettlementReason } from "@/lib/watchdog/payment-reasons";
import {
  isPlatformPaymentSettlementReason,
  PAYMENT_RECEIPT_REASON,
  PAYMENT_SETTLEMENT_REASONS,
  PAYMENT_SETTLEMENT_SUPPRESSED_REASONS,
  settlementSeverity,
} from "@/lib/watchdog/payment-reasons";
import { reportHealthAlert } from "@/lib/watchdog/report-health-alert";
import { resolveHealthAlertByDedupeKey } from "@/lib/watchdog/resolve-health-alert";
import { HEALTH_FEATURES } from "@/lib/watchdog/features";

export interface PaymentSettlementAlertParams {
  reason: PaymentSettlementReason;
  orderReference?: string | null;
  schoolId?: string | null;
  studentId?: string | null;
  feeStructureId?: string | null;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

export interface PaymentReceiptAlertParams {
  schoolId: string;
  paymentId: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

function settlementTitle(reason: PaymentSettlementReason): string {
  switch (reason) {
    case PAYMENT_SETTLEMENT_REASONS.adminClientUnavailable:
      return "Payment webhook unavailable (platform)";
    case PAYMENT_SETTLEMENT_REASONS.feeBillNotFound:
    case PAYMENT_SETTLEMENT_REASONS.reactivationBillNotFound:
      return "Payment received for unknown order";
    case PAYMENT_SETTLEMENT_REASONS.schoolReactivationUpdate:
      return "School reactivation settlement failure";
    case PAYMENT_SETTLEMENT_REASONS.manualPaymentInsert:
      return "Manual payment recording failure";
    case PAYMENT_SETTLEMENT_REASONS.billPersist:
      return "Online payment bill could not be saved";
    default:
      return "Payment settlement failure";
  }
}

function settlementMessage(params: PaymentSettlementAlertParams): string {
  const order = params.orderReference?.trim();
  switch (params.reason) {
    case PAYMENT_SETTLEMENT_REASONS.adminClientUnavailable:
      return "ClickPesa webhooks cannot be processed due to a server configuration error. All schools may be affected.";
    case PAYMENT_SETTLEMENT_REASONS.unexpectedException:
      return "An unexpected error occurred while processing a ClickPesa webhook.";
    case PAYMENT_SETTLEMENT_REASONS.feeBillNotFound:
    case PAYMENT_SETTLEMENT_REASONS.reactivationBillNotFound:
      return order
        ? `ClickPesa notified payment for order ${order}, but no matching bill exists in Adakaro.`
        : "ClickPesa notified payment for an order that could not be identified.";
    case PAYMENT_SETTLEMENT_REASONS.schoolReactivationUpdate:
      return order
        ? `Reactivation payment ${order} was received but the school could not be reactivated.`
        : "A reactivation payment was received but the school could not be reactivated.";
    case PAYMENT_SETTLEMENT_REASONS.manualPaymentInsert:
      return "A manual payment could not be recorded for the affected school.";
    case PAYMENT_SETTLEMENT_REASONS.billPersist:
      return order
        ? `ClickPesa order ${order} was created but the fee bill could not be saved. A later webhook may fail to settle.`
        : "A ClickPesa fee bill could not be saved after order creation.";
    case PAYMENT_SETTLEMENT_REASONS.reactivationBillUpdate:
      return order
        ? `Reactivation payment ${order} could not be marked paid.`
        : "A reactivation payment could not be marked paid.";
    default:
      return order
        ? `Online payment for order ${order} could not be settled correctly. The payer may have been charged.`
        : "An online payment could not be settled correctly.";
  }
}

/** Legacy phase guard — maps old suppressed phases without alerting. */
export function shouldSuppressPaymentSettlementAlert(
  legacyPhase?: string
): boolean {
  if (!legacyPhase) return false;
  return PAYMENT_SETTLEMENT_SUPPRESSED_REASONS.has(legacyPhase);
}

export function reportPaymentSettlementAlert(
  params: PaymentSettlementAlertParams
): void {
  const dedupeKey = buildPaymentSettlementDedupeKey({
    reason: params.reason,
    schoolId: params.schoolId,
    orderReference: params.orderReference,
    studentId: params.studentId,
    feeStructureId: params.feeStructureId,
  });
  if (!dedupeKey) return;

  const schoolId = assertSchoolIdMatchesDedupeKey(dedupeKey, params.schoolId);
  const metadata = buildPaymentAlertMetadata(
    { ...params.metadata, reason: params.reason },
    params.error
  );

  void reportHealthAlert({
    feature: HEALTH_FEATURES.paymentSettlement,
    severity: settlementSeverity(params.reason),
    title: settlementTitle(params.reason),
    message: settlementMessage(params),
    schoolId: isPlatformPaymentSettlementReason(params.reason)
      ? null
      : schoolId,
    dedupeKey,
    metadata,
  });
}

export function reportPaymentReceiptAlert(
  params: PaymentReceiptAlertParams
): void {
  const dedupeKey = buildPaymentReceiptDedupeKey({
    schoolId: params.schoolId,
    paymentId: params.paymentId,
  });
  if (!dedupeKey) return;

  const schoolId = assertSchoolIdMatchesDedupeKey(dedupeKey, params.schoolId);
  const metadata = buildPaymentAlertMetadata(
    { ...params.metadata, reason: PAYMENT_RECEIPT_REASON },
    params.error
  );

  void reportHealthAlert({
    feature: HEALTH_FEATURES.paymentReceipt,
    severity: "critical",
    title: "Payment receipt generation failure",
    message: `Payment ${params.paymentId} was recorded but its receipt could not be created.`,
    schoolId,
    dedupeKey,
    metadata,
  });
}

export function resolvePaymentSettlementAlert(params: {
  reason: PaymentSettlementReason;
  schoolId?: string | null;
  orderReference?: string | null;
  studentId?: string | null;
  feeStructureId?: string | null;
}): void {
  const dedupeKey = buildPaymentSettlementDedupeKey(params);
  if (!dedupeKey) return;
  void resolveHealthAlertByDedupeKey(dedupeKey);
}

export function resolvePaymentReceiptAlert(params: {
  schoolId: string;
  paymentId: string;
}): void {
  const dedupeKey = buildPaymentReceiptDedupeKey(params);
  if (!dedupeKey) return;
  void resolveHealthAlertByDedupeKey(dedupeKey);
}

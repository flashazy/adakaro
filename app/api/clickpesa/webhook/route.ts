import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  reportPaymentReceiptAlert,
  reportPaymentSettlementAlert,
  resolvePaymentReceiptAlert,
  resolvePaymentSettlementAlert,
} from "@/lib/watchdog/payment-health-alerts";
import { PAYMENT_SETTLEMENT_REASONS } from "@/lib/watchdog/payment-reasons";

/**
 * ClickPesa webhook — uses service role (no user session).
 * Adjust `event` / payload shape to match ClickPesa's documentation.
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookReceivedAt = new Date().toISOString();

  try {
    const body = payload as Record<string, unknown>;
    const event = typeof body.event === "string" ? body.event : "";
    const data =
      body.data && typeof body.data === "object"
        ? (body.data as Record<string, unknown>)
        : body;

    if (event && event !== "PAYMENT_RECEIVED") {
      return NextResponse.json({ received: true });
    }

    const orderReference =
      typeof data.orderReference === "string"
        ? data.orderReference
        : typeof data.order_reference === "string"
          ? data.order_reference
          : null;

    if (!orderReference) {
      return NextResponse.json(
        { error: "Missing order reference" },
        { status: 400 }
      );
    }

    const amountRaw = data.amount ?? data.paidAmount ?? data.paid_amount;
    const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const paymentReference =
      (typeof data.paymentReference === "string"
        ? data.paymentReference
        : typeof data.payment_reference === "string"
          ? data.payment_reference
          : null) ?? null;

    let admin;
    try {
      admin = createAdminClient();
    } catch (e) {
      console.error("[clickpesa webhook] admin client:", e);
      reportPaymentSettlementAlert({
        reason: PAYMENT_SETTLEMENT_REASONS.adminClientUnavailable,
        orderReference,
        metadata: {
          order_reference: orderReference,
          webhook_received_at: webhookReceivedAt,
        },
        error: e,
      });
      return NextResponse.json(
        { error: "Server misconfigured (service role)" },
        { status: 500 }
      );
    }

    /** School reactivation orders use order refs starting with REACT */
    if (orderReference.startsWith("REACT")) {
      const { data: reactRaw, error: reactErr } = await admin
        .from("school_reactivation_bills")
        .select("id, school_id, amount, status")
        .eq("order_reference", orderReference)
        .maybeSingle();

      const reactBill = reactRaw as {
        id: string;
        school_id: string;
        amount: number;
        status: string;
      } | null;

      if (reactErr || !reactBill) {
        console.error(
          "[clickpesa webhook] reactivation bill not found:",
          orderReference,
          reactErr
        );
        reportPaymentSettlementAlert({
          reason: PAYMENT_SETTLEMENT_REASONS.reactivationBillNotFound,
          orderReference,
          metadata: {
            order_reference: orderReference,
            payment_reference: paymentReference,
            amount,
            webhook_received_at: webhookReceivedAt,
          },
          error: reactErr ?? "bill_missing",
        });
        return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      }

      if (reactBill.status === "paid") {
        console.info(
          "[clickpesa webhook] duplicate reactivation settlement:",
          orderReference
        );
        return NextResponse.json({ received: true, duplicate: true });
      }

      const paidAmount = Math.min(amount, Number(reactBill.amount));

      const { error: billUpdErr } = await admin
        .from("school_reactivation_bills")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_reference: paymentReference,
          raw_webhook_last: payload as object,
        } as never)
        .eq("id", reactBill.id);

      if (billUpdErr) {
        console.error("[clickpesa webhook] reactivation bill update:", billUpdErr);
        reportPaymentSettlementAlert({
          reason: PAYMENT_SETTLEMENT_REASONS.reactivationBillUpdate,
          orderReference,
          schoolId: reactBill.school_id,
          metadata: {
            order_reference: orderReference,
            bill_id: reactBill.id,
            payment_reference: paymentReference,
            amount: paidAmount,
            webhook_received_at: webhookReceivedAt,
          },
          error: billUpdErr,
        });
        return NextResponse.json(
          { error: "Failed to update reactivation bill" },
          { status: 500 }
        );
      }

      resolvePaymentSettlementAlert({
        reason: PAYMENT_SETTLEMENT_REASONS.reactivationBillUpdate,
        schoolId: reactBill.school_id,
        orderReference,
      });

      const { error: schoolErr } = await admin
        .from("schools")
        .update({
          status: "active",
          suspension_reason: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", reactBill.school_id);

      if (schoolErr) {
        console.error("[clickpesa webhook] school reactivate:", schoolErr);
        reportPaymentSettlementAlert({
          reason: PAYMENT_SETTLEMENT_REASONS.schoolReactivationUpdate,
          orderReference,
          schoolId: reactBill.school_id,
          metadata: {
            order_reference: orderReference,
            bill_id: reactBill.id,
            payment_reference: paymentReference,
            webhook_received_at: webhookReceivedAt,
          },
          error: schoolErr,
        });
        return NextResponse.json(
          { error: "Failed to reactivate school" },
          { status: 500 }
        );
      }

      resolvePaymentSettlementAlert({
        reason: PAYMENT_SETTLEMENT_REASONS.schoolReactivationUpdate,
        schoolId: reactBill.school_id,
        orderReference,
      });

      return NextResponse.json({
        received: true,
        reactivation: true,
        amount: paidAmount,
      });
    }

    const { data: billRaw, error: billError } = await admin
      .from("clickpesa_fee_bills")
      .select("id, student_id, fee_structure_id, parent_id, amount")
      .eq("order_reference", orderReference)
      .maybeSingle();

    const bill = billRaw as {
      id: string;
      student_id: string;
      fee_structure_id: string;
      parent_id: string;
      amount: number;
    } | null;

    if (billError || !bill) {
      console.error("[clickpesa webhook] bill not found:", orderReference, billError);
      reportPaymentSettlementAlert({
        reason: PAYMENT_SETTLEMENT_REASONS.feeBillNotFound,
        orderReference,
        metadata: {
          order_reference: orderReference,
          payment_reference: paymentReference,
          amount,
          webhook_received_at: webhookReceivedAt,
        },
        error: billError ?? "bill_missing",
      });
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    const { data: studentRow } = await admin
      .from("students")
      .select("school_id")
      .eq("id", bill.student_id)
      .maybeSingle();
    const schoolId = (studentRow as { school_id?: string } | null)?.school_id;

    const paidAmount = Math.min(amount, Number(bill.amount));

    const { error: txnErr } = await admin
      .from("clickpesa_payment_transactions")
      .insert({
        clickpesa_bill_id: bill.id,
        payment_reference: paymentReference,
        amount: paidAmount,
        status: "success",
        raw_webhook: payload as object,
      } as never);

    if (txnErr) {
      const code = (txnErr as { code?: string }).code ?? "";
      if (code === "23505") {
        console.info(
          "[clickpesa webhook] duplicate fee settlement:",
          orderReference
        );
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error("[clickpesa webhook] transaction insert:", txnErr);
      reportPaymentSettlementAlert({
        reason: PAYMENT_SETTLEMENT_REASONS.transactionInsert,
        orderReference,
        schoolId,
        metadata: {
          order_reference: orderReference,
          clickpesa_bill_id: bill.id,
          student_id: bill.student_id,
          payment_reference: paymentReference,
          amount: paidAmount,
          webhook_received_at: webhookReceivedAt,
        },
        error: txnErr,
      });
      return NextResponse.json(
        { error: "Failed to record payment transaction" },
        { status: 500 }
      );
    }

    resolvePaymentSettlementAlert({
      reason: PAYMENT_SETTLEMENT_REASONS.transactionInsert,
      schoolId,
      orderReference,
    });

    const paymentDate = new Date().toISOString().slice(0, 10);

    const { data: paymentRow, error: payError } = await admin
      .from("payments")
      .insert({
        student_id: bill.student_id,
        fee_structure_id: bill.fee_structure_id,
        amount: paidAmount,
        payment_method: "clickpesa",
        status: "completed",
        payment_date: paymentDate,
        reference_number: paymentReference,
        recorded_by_id: bill.parent_id,
        recorded_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();

    if (payError) {
      console.error("[clickpesa webhook] payment insert:", payError);
      reportPaymentSettlementAlert({
        reason: PAYMENT_SETTLEMENT_REASONS.paymentInsert,
        orderReference,
        schoolId,
        metadata: {
          order_reference: orderReference,
          clickpesa_bill_id: bill.id,
          student_id: bill.student_id,
          payment_reference: paymentReference,
          amount: paidAmount,
          webhook_received_at: webhookReceivedAt,
        },
        error: payError,
      });
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }

    const paymentTyped = paymentRow as { id: string } | null;

    resolvePaymentSettlementAlert({
      reason: PAYMENT_SETTLEMENT_REASONS.paymentInsert,
      schoolId,
      orderReference,
    });

    if (paymentTyped?.id && schoolId) {
      const { error: recError } = await admin.from("receipts").insert({
        payment_id: paymentTyped.id,
      } as never);
      if (recError) {
        console.error("[clickpesa webhook] receipt insert:", recError);
        reportPaymentReceiptAlert({
          schoolId,
          paymentId: paymentTyped.id,
          metadata: {
            order_reference: orderReference,
            student_id: bill.student_id,
            payment_reference: paymentReference,
            amount: paidAmount,
            payment_method: "clickpesa",
            source: "webhook",
            webhook_received_at: webhookReceivedAt,
          },
          error: recError,
        });
      } else {
        resolvePaymentReceiptAlert({
          schoolId,
          paymentId: paymentTyped.id,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[clickpesa webhook] unexpected:", err);
    reportPaymentSettlementAlert({
      reason: PAYMENT_SETTLEMENT_REASONS.unexpectedException,
      metadata: {
        webhook_received_at: webhookReceivedAt,
      },
      error: err,
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

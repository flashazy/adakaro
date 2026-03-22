import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ClickPesa webhook — uses service role (no user session).
 * Adjust `event` / payload shape to match ClickPesa’s documentation.
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
    return NextResponse.json(
      { error: "Server misconfigured (service role)" },
      { status: 500 }
    );
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
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  const paidAmount = Math.min(amount, Number(bill.amount));

  await admin.from("clickpesa_payment_transactions").insert({
    clickpesa_bill_id: bill.id,
    payment_reference: paymentReference,
    amount: paidAmount,
    status: "success",
    raw_webhook: payload as object,
  } as never);

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
      recorded_by: bill.parent_id,
    } as never)
    .select("id")
    .single();

  if (payError) {
    console.error("[clickpesa webhook] payment insert:", payError);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }

  const paymentTyped = paymentRow as { id: string } | null;

  if (paymentTyped?.id) {
    const { error: recError } = await admin.from("receipts").insert({
      payment_id: paymentTyped.id,
    } as never);
    if (recError) {
      console.error("[clickpesa webhook] receipt insert:", recError);
    }
  }

  return NextResponse.json({ received: true });
}

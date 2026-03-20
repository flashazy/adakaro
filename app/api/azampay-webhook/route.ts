import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import crypto from "crypto";

type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];

export async function GET() {
  console.log("[webhook] GET request received – endpoint is reachable");
  return new Response("Webhook endpoint is live", { status: 200 });
}

/**
 * Verify webhook signature using HMAC-SHA256.
 * AzamPay may send signature in X-Signature or similar header.
 */
function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  console.log("[webhook] 🔥 POST request received");
  const rawBody = await request.text();
  console.log("[webhook] raw body:", rawBody);

  console.log("[webhook] using admin client, service role key exists?", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const apiKey = process.env.AZAMPAY_API_KEY;
  if (!apiKey) {
    console.error("[webhook] AZAMPAY_API_KEY not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  console.log("[webhook] raw body length:", rawBody.length);

  const signature =
    request.headers.get("X-Signature") ??
    request.headers.get("X-Azampay-Signature") ??
    request.headers.get("X-Webhook-Signature");

  if (signature) {
    if (!verifySignature(rawBody, signature, apiKey)) {
      console.warn("[webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: {
    transactionStatus?: string;
    externalId?: string;
    utilityref?: string;
    transactionId?: string;
    pgReferenceId?: string;
    amount?: number;
    status?: unknown;
    TransactionStatus?: unknown;
    external_id?: unknown;
    ExternalId?: unknown;
    transaction_id?: unknown;
    reference?: unknown;
    [key: string]: unknown;
  };

  try {
    body = JSON.parse(rawBody);
    console.log("[webhook] parsed body:", JSON.stringify(body, null, 2));
  } catch (e) {
    console.error("[webhook] JSON parse error:", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status =
    body.transactionStatus ?? body.status ?? body.TransactionStatus;
  const externalId =
    body.externalId ??
    body.external_id ??
    body.ExternalId ??
    body.utilityref;
  const transactionId =
    body.transactionId ?? body.transaction_id ?? body.pgReferenceId ?? body.reference;
  console.log(
    "[webhook] extracted externalId:",
    externalId,
    "transactionId:",
    transactionId
  );

  if (status !== "SUCCESS" && status !== "success" && status !== "Completed") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (!externalId) {
    console.warn("[webhook] SUCCESS but no externalId:", body);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const supabase = createAdminClient();

  console.log("[webhook] looking for pending with externalId:", externalId);
  const { data: pending, error: fetchError } = await supabase
    .from("azampay_pending_payments")
    .select("student_id, fee_structure_id, amount, parent_id")
    .eq("external_id", externalId)
    .limit(1)
    .maybeSingle();

  console.log("[webhook] pending record found?", !!pending);
  if (fetchError) {
    console.error("[webhook] pending query error:", fetchError);
  }
  if (pending) {
    console.log("[webhook] pending record:", JSON.stringify(pending, null, 2));
  } else {
    console.log("[webhook] no pending record found");
  }

  if (fetchError || !pending) {
    console.error("[webhook] Pending not found or error:", externalId, fetchError);
    return NextResponse.json({ received: true }, { status: 200 });
  }
  const pendingRecord = pending as {
    student_id: string;
    fee_structure_id: string;
    amount: number;
    parent_id: string;
  };
  const amount = Number(pendingRecord.amount);

  const paymentInsertPayload: PaymentInsert = {
    student_id: pendingRecord.student_id,
    fee_structure_id: pendingRecord.fee_structure_id,
    amount,
    payment_method: "azampay",
    reference_number: String(transactionId ?? externalId ?? ""),
    recorded_by: pendingRecord.parent_id,
  };
  console.log(
    "[webhook] inserting payment with payload:",
    JSON.stringify(paymentInsertPayload, null, 2)
  );

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert(paymentInsertPayload as never)
    .select("id")
    .single();

  if (paymentError) {
    console.error("[webhook] payment insert ERROR:", paymentError);
    return NextResponse.json({ received: true }, { status: 200 });
  }
  console.log(
    "[webhook] payment insert succeeded, payment:",
    JSON.stringify(payment, null, 2)
  );
  const paymentRecord = payment as { id: string };

  const receiptPayload = { payment_id: paymentRecord.id, receipt_number: "" };
  console.log(
    "[webhook] inserting receipt with payload:",
    JSON.stringify(receiptPayload, null, 2)
  );
  const { error: receiptError } = await supabase
    .from("receipts")
    .insert(receiptPayload as never);

  if (receiptError) {
    console.error("[webhook] receipt insert ERROR:", receiptError);
    // Even if receipt fails, we still return success (payment already recorded)
    return NextResponse.json({ received: true }, { status: 200 });
  }
  console.log("[webhook] receipt insert succeeded");

  console.log(
    "[webhook] deleting pending row for externalId:",
    externalId
  );
  const { error: deleteError } = await supabase
    .from("azampay_pending_payments")
    .delete()
    .eq("external_id", externalId);

  if (deleteError) {
    console.error("[webhook] delete pending ERROR:", deleteError);
  } else {
    console.log("[webhook] delete pending succeeded for externalId:", externalId);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

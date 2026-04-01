import { NextRequest, NextResponse } from "next/server";
import {
  createCustomerControlNumber,
  createCheckoutLink,
} from "@/lib/clickpesa/client";
import {
  isClickPesaOrderCurrency,
  resolveClickPesaOrderCurrency,
} from "@/lib/currency";
import {
  buildReactivationOrderReference,
  findSuspendedSchoolForAdmin,
} from "@/lib/payment/school-reactivation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { amount?: unknown; schoolId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amountRaw = body.amount;
  const amount =
    typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "A valid positive amount is required" },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[school-reactivation] admin client:", e);
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const ctx = await findSuspendedSchoolForAdmin(admin, user.id);
  if (!ctx) {
    return NextResponse.json(
      { error: "No suspended school found for your admin account" },
      { status: 403 }
    );
  }

  if (
    typeof body.schoolId === "string" &&
    body.schoolId &&
    body.schoolId !== ctx.schoolId
  ) {
    return NextResponse.json({ error: "School mismatch" }, { status: 403 });
  }

  const orderReference = buildReactivationOrderReference(ctx.schoolId);
  const schoolCurrency = ctx.currency;
  const clickPesaOrderCurrency = resolveClickPesaOrderCurrency(schoolCurrency);
  const clickpesaCurrencyMismatch = !isClickPesaOrderCurrency(schoolCurrency);
  const clickpesaNote = clickpesaCurrencyMismatch
    ? `Your school currency is ${schoolCurrency}. ClickPesa processes this order in ${clickPesaOrderCurrency}. Confirm the amount matches what you intend to pay.`
    : undefined;

  const customerName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    user.email?.split("@")[0] ||
    "School admin";
  const customerEmail = user.email ?? undefined;
  let customerPhone =
    typeof user.user_metadata?.phone === "string"
      ? user.user_metadata.phone
      : "";
  if (customerPhone.startsWith("+")) customerPhone = customerPhone.slice(1);

  const billDescription = `School reactivation — ${ctx.name} — ref ${orderReference}`;

  try {
    const [controlResult, checkoutResult] = await Promise.allSettled([
      createCustomerControlNumber({
        orderReference,
        amount,
        customerName,
        customerEmail,
        customerPhone: customerPhone || undefined,
        billDescription,
      }),
      createCheckoutLink({
        orderReference,
        amount,
        description: billDescription,
        customerName,
        customerEmail,
        customerPhone: customerPhone || "",
        orderCurrency: clickPesaOrderCurrency,
      }),
    ]);

    let controlNumber: string | null = null;
    let checkoutLink: string | null = null;
    let billpayError: string | null = null;
    let checkoutError: string | null = null;

    if (controlResult.status === "fulfilled") {
      controlNumber = controlResult.value.controlNumber;
    } else {
      billpayError =
        controlResult.reason?.message || "BillPay generation failed";
      console.error("[school-reactivation] BillPay failed:", billpayError);
    }

    if (checkoutResult.status === "fulfilled") {
      checkoutLink = checkoutResult.value.checkoutLink;
    } else {
      checkoutError =
        checkoutResult.reason?.message || "Checkout generation failed";
      console.error("[school-reactivation] Checkout failed:", checkoutError);
    }

    if (!controlNumber && !checkoutLink) {
      throw new Error("Failed to generate any payment option");
    }

    const { error: insertErr } = await admin
      .from("school_reactivation_bills")
      .insert({
        school_id: ctx.schoolId,
        user_id: user.id,
        order_reference: orderReference,
        amount,
        currency: clickPesaOrderCurrency,
        status: "pending",
        control_number: controlNumber,
        checkout_link: checkoutLink,
      } as never);

    if (insertErr) {
      console.error("[school-reactivation] insert bill:", insertErr);
      return NextResponse.json(
        { error: "Could not save payment order. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderReference,
      controlNumber,
      checkoutLink,
      billpayError,
      checkoutError,
      schoolCurrency,
      clickPesaOrderCurrency,
      clickpesaCurrencyMismatch,
      clickpesaNote,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unexpected error creating order";
    console.error("[school-reactivation]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

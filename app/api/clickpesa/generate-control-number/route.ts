import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createCustomerControlNumber,
  createCheckoutLink,
} from "@/lib/clickpesa/client";
import {
  isClickPesaOrderCurrency,
  resolveClickPesaOrderCurrency,
} from "@/lib/currency";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, feeStructureId, amount, feeName } = await req.json();
  console.log("[payment] Request received", { studentId, feeStructureId, amount, feeName });

  // Verify parent-student link
  const { data: link, error: linkError } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", user.id)
    .eq("student_id", studentId)
    .single();
  if (linkError || !link) {
    console.error("[payment] Parent-student link failed", linkError);
    return NextResponse.json({ error: "Not linked to this student" }, { status: 403 });
  }

  const { data: studentRow, error: studentErr } = await supabase
    .from("students")
    .select("school_id")
    .eq("id", studentId)
    .single();
  if (studentErr || !studentRow) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const schoolId = (studentRow as { school_id: string }).school_id;
  const { data: schoolRow, error: schoolErr } = await supabase
    .from("schools")
    .select("currency")
    .eq("id", schoolId)
    .single();
  const schoolCurrency =
    (schoolRow as { currency?: string } | null)?.currency ?? "KES";
  const clickPesaOrderCurrency = resolveClickPesaOrderCurrency(schoolCurrency);
  const clickpesaCurrencyMismatch = !isClickPesaOrderCurrency(schoolCurrency);
  const clickpesaNote = clickpesaCurrencyMismatch
    ? `Your school displays fees in ${schoolCurrency}. Online checkout is processed in ${clickPesaOrderCurrency} — confirm amounts with your school if unsure.`
    : undefined;

  // Get fee balance (use the view)
  const { data: feeBalance, error: fbError } = await supabase
    .from("student_fee_balances")
    .select("balance")
    .eq("student_id", studentId)
    .eq("fee_structure_id", feeStructureId)
    .single();
  const balRow = feeBalance as { balance: number } | null;
  if (fbError || !balRow || Number(balRow.balance) <= 0) {
    console.error("[payment] No outstanding balance", fbError);
    return NextResponse.json({ error: "No outstanding balance" }, { status: 400 });
  }

  // Short order reference (≤20 characters)
  const orderReference = `${studentId.slice(0, 4)}${feeStructureId.slice(0, 4)}${Date.now().toString().slice(-8)}`;
  const customerName = user.user_metadata?.full_name || "Parent";
  const customerEmail = user.email;
  let customerPhone = user.user_metadata?.phone || "";
  if (customerPhone.startsWith("+")) customerPhone = customerPhone.slice(1);

  console.log("[payment] Order reference:", orderReference);
  console.log("[payment] Customer info:", { customerName, customerEmail, customerPhone });

  try {
    // Create both options in parallel
    const [controlResult, checkoutResult] = await Promise.allSettled([
      createCustomerControlNumber({
        orderReference,
        amount,
        customerName,
        customerEmail,
        customerPhone: customerPhone || undefined,
      }),
      createCheckoutLink({
        orderReference,
        amount,
        description: `School fees — ${feeName}`,
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
    console.log("[payment] Control number generated:", controlNumber);
    } else {
      billpayError = controlResult.reason?.message || "BillPay generation failed";
      console.error("[payment] BillPay failed:", billpayError);
    }

    if (checkoutResult.status === "fulfilled") {
      checkoutLink = checkoutResult.value.checkoutLink;
      console.log("[payment] Checkout link generated:", checkoutLink);
    } else {
      checkoutError = checkoutResult.reason?.message || "Checkout generation failed";
      console.error("[payment] Checkout failed:", checkoutError);
    }

    if (!controlNumber && !checkoutLink) {
      throw new Error("Failed to generate any payment option");
    }

    // Store the bill
    const { error: billError } = await supabase
      .from("clickpesa_fee_bills")
      .insert({
        student_id: studentId as string,
        fee_structure_id: feeStructureId as string,
        control_number: controlNumber,
        order_reference: orderReference,
        parent_id: user.id,
        checkout_link: checkoutLink,
        amount: Number(amount),
      } as never);

    if (billError) {
      console.error("[payment] Failed to save bill:", billError);
    }

    return NextResponse.json({
      controlNumber,
      checkoutLink,
      billpayError,
      checkoutError,
      schoolCurrency,
      clickPesaOrderCurrency,
      clickpesaCurrencyMismatch,
      clickpesaNote,
    });
  } catch (err: any) {
    console.error("[payment] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

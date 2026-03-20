"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiateAzamPayCheckout } from "@/lib/azampay";

export interface AzamPayState {
  error?: string;
  success?: string;
  transactionId?: string;
}

export async function initiateAzamPayPayment(
  _prevState: AzamPayState,
  formData: FormData
): Promise<AzamPayState> {
  const studentId = (formData.get("student_id") as string)?.trim();
  const feeStructureId = (formData.get("fee_structure_id") as string)?.trim();
  const amountStr = (formData.get("amount") as string)?.trim();
  const mobileNumber = (formData.get("mobile_number") as string)?.trim();

  if (!studentId || !feeStructureId || !amountStr || !mobileNumber) {
    return { error: "Missing required fields." };
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { error: "Invalid amount." };
  }

  // Normalize mobile: remove spaces, ensure format (e.g. 255... for Tanzania)
  const normalizedMobile = mobileNumber.replace(/\s/g, "");
  if (normalizedMobile.length < 9) {
    return { error: "Please enter a valid mobile number." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated." };

    // Verify parent is linked to this student
    const { data: link } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", user.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!link) {
      return { error: "You are not linked to this student." };
    }

    const externalId = `payment-${Date.now()}-${studentId}`;

    const insertPayload = {
      external_id: externalId,
      student_id: studentId,
      fee_structure_id: feeStructureId,
      amount,
      parent_id: user.id,
    };
    console.log("[initiateAzamPayPayment] user.id:", user.id);
    console.log("[initiateAzamPayPayment] insert object:", JSON.stringify(insertPayload, null, 2));

    // Store pending payment for webhook lookup
    console.log("[initiateAzamPayPayment] about to insert into azampay_pending_payments (using admin client)");
    const supabaseAdmin = createAdminClient();
    const { error: insertError } = await supabaseAdmin
      .from("azampay_pending_payments")
      .insert(insertPayload as never);

    if (insertError) {
      console.error("[initiateAzamPayPayment] INSERT ERROR:", insertError);
      return { error: insertError.message };
    }
    console.log("[initiateAzamPayPayment] insert succeeded");
    console.log("[initiateAzamPayPayment] 🔥 About to call AzamPay checkout");

    console.log("[initiateAzamPayPayment] calling initiateAzamPayCheckout...");
    const result = await initiateAzamPayCheckout({
      accountNumber: normalizedMobile,
      amount,
      externalId,
      provider: "Mpesa",
    });
    console.log("[initiateAzamPayPayment] AzamPay checkout result:", JSON.stringify(result, null, 2));

    if (!result.success || !result.transactionId) {
      const msg = result.message ?? result.msg ?? "Payment initiation failed.";
      return { error: msg };
    }

    revalidatePath("/parent-dashboard");
    return {
      success:
        "Payment initiated. Please check your phone to complete the transaction.",
      transactionId: result.transactionId,
    };
  } catch (e) {
    console.error("[initiateAzamPayPayment] caught error:", e);
    return {
      error: (e as Error).message ?? "Something went wrong. Please try again.",
    };
  }
}

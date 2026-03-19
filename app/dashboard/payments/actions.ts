"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types/supabase";

const VALID_METHODS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "mobile_money",
  "card",
  "cheque",
  "azampay",
];

export interface PaymentActionState {
  error?: string;
  success?: string;
  paymentId?: string;
  receiptNumber?: string;
}

export async function recordPayment(
  _prevState: PaymentActionState,
  formData: FormData
): Promise<PaymentActionState> {
  const studentId = (formData.get("student_id") as string)?.trim();
  const feeStructureId = (formData.get("fee_structure_id") as string)?.trim();
  const amount = parseFloat(formData.get("amount") as string);
  const method = (formData.get("payment_method") as string)?.trim() as PaymentMethod;
  const referenceNumber = (formData.get("reference_number") as string)?.trim() || null;
  const paymentDate = (formData.get("payment_date") as string)?.trim() || undefined;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!studentId) return { error: "Student is required." };
  if (!feeStructureId) return { error: "Please select a fee to pay." };
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be greater than 0." };
  if (!VALID_METHODS.includes(method)) return { error: "Invalid payment method." };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated." };

    // Insert payment
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        student_id: studentId,
        fee_structure_id: feeStructureId,
        amount,
        payment_method: method,
        reference_number: referenceNumber,
        payment_date: paymentDate,
        notes,
        recorded_by: user.id,
      })
      .select("id")
      .single();

    if (paymentError) return { error: paymentError.message };

    // Create receipt (trigger auto-generates receipt_number)
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({ payment_id: payment.id, receipt_number: "" })
      .select("id, receipt_number")
      .single();

    if (receiptError) {
      console.log("[payments] receipt error:", receiptError);
    }

    revalidatePath("/dashboard/payments");

    return {
      success: `Payment of ${amount.toLocaleString()} recorded.${receipt ? ` Receipt: ${receipt.receipt_number}` : ""}`,
      paymentId: payment.id,
      receiptNumber: receipt?.receipt_number ?? undefined,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

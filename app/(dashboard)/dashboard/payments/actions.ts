"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminActionFromServerAction } from "@/lib/admin-activity-log";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { canUserRecordStudentPayment } from "@/lib/payments/record-permission.server";
import type { PaymentMethod } from "@/types/supabase";

const VALID_METHODS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "mobile_money",
  "card",
  "cheque",
  "clickpesa",
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

    const userSchoolId = await getSchoolIdForUser(supabase, user.id);
    const { data: isSuper, error: superRpcErr } = await supabase.rpc(
      "is_super_admin",
      {} as never
    );
    const superOk = !superRpcErr && isSuper === true;

    const { data: studentRow, error: studentErr } = await supabase
      .from("students")
      .select("school_id")
      .eq("id", studentId)
      .maybeSingle();

    if (studentErr || !studentRow) {
      return { error: "Student not found." };
    }
    const studentSchoolId = (studentRow as { school_id: string }).school_id;
    if (userSchoolId) {
      if (studentSchoolId !== userSchoolId) {
        return { error: "You can only record payments for students in your school." };
      }
    } else if (!superOk) {
      return { error: "No school for this user." };
    }

    const schoolForPerm = userSchoolId ?? studentSchoolId;
    if (!(await canUserRecordStudentPayment(supabase, user.id, schoolForPerm))) {
      return { error: "You do not have permission to record payments." };
    }

    // Insert payment
    const recordedAt = new Date().toISOString();
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
        recorded_by_id: user.id,
        recorded_at: recordedAt,
      } as never)
      .select("id")
      .single();

    if (paymentError) return { error: paymentError.message };
    const paymentTyped = payment as { id: string };

    // Create receipt (trigger auto-generates receipt_number)
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({ payment_id: paymentTyped.id, receipt_number: "" } as never)
      .select("id, receipt_number")
      .single();

    const receiptTyped = receipt as { receipt_number: string } | null;
    if (receiptError) {
      console.log("[payments] receipt error:", receiptError);
    }

    revalidatePath("/dashboard/payments");
    revalidatePath(`/dashboard/students/${studentId}/profile`);

    void logAdminActionFromServerAction(
      user.id,
      "record_payment",
      {
        payment_id: paymentTyped.id,
        amount,
        payment_method: method,
        fee_structure_id: feeStructureId,
        student_id: studentId,
      },
      schoolForPerm
    );

    return {
      success: `Payment of ${amount.toLocaleString()} recorded.${receiptTyped ? ` Receipt: ${receiptTyped.receipt_number}` : ""}`,
      paymentId: paymentTyped.id,
      receiptNumber: receiptTyped?.receipt_number ?? undefined,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

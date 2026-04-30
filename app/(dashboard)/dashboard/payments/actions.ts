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
  /**
   * True when the action stopped because a payment with the same
   * (student_id, fee_structure_id, payment_date, amount) already exists.
   * The offline sync layer surfaces this in the conflict UI; the user
   * can re-submit with `force_duplicate=1` to record anyway.
   */
  conflict?: boolean;
  /** Existing rows that triggered the duplicate match — used to render
   * "Possible duplicate payment" details. Only when conflict === true. */
  duplicateCandidates?: Array<{
    id: string;
    amount: number;
    payment_method: PaymentMethod;
    payment_date: string;
    reference_number: string | null;
    receipt_number: string | null;
  }>;
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

    // Duplicate detection (Phase 3 offline sync). Definition: same
    // (student_id, fee_structure_id, amount) on the same payment_date.
    // This catches the most common offline-replay scenario — the network
    // dropped after the server committed but before the response reached
    // the client, so the queue retried and a manual submit raced. The
    // user can bypass with `force_duplicate=1` (e.g. legitimate split
    // payments on the same day).
    const forceDuplicate =
      String(formData.get("force_duplicate") ?? "") === "1";
    if (!forceDuplicate) {
      const checkDate = paymentDate ?? new Date().toISOString().slice(0, 10);
      const { data: existing, error: dupErr } = await supabase
        .from("payments")
        .select(
          "id, amount, payment_method, payment_date, reference_number, receipts(receipt_number)"
        )
        .eq("student_id", studentId)
        .eq("fee_structure_id", feeStructureId)
        .eq("amount", amount)
        .eq("payment_date", checkDate)
        .limit(5);
      if (!dupErr && existing && existing.length > 0) {
        const candidates = (existing as Array<{
          id: string;
          amount: number;
          payment_method: PaymentMethod;
          payment_date: string;
          reference_number: string | null;
          receipts: Array<{ receipt_number: string }> | null;
        }>).map((r) => ({
          id: r.id,
          amount: r.amount,
          payment_method: r.payment_method,
          payment_date: r.payment_date,
          reference_number: r.reference_number,
          receipt_number: r.receipts?.[0]?.receipt_number ?? null,
        }));
        return {
          conflict: true,
          duplicateCandidates: candidates,
          error: `A payment of ${amount.toLocaleString()} for this fee on ${checkDate} already exists.`,
        };
      }
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

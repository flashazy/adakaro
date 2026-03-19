"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getSchoolId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) throw new Error("No school found");

  return { supabase, schoolId: membership.school_id };
}

export interface FeeStructureActionState {
  error?: string;
  success?: string;
}

export async function addFeeStructure(
  _prevState: FeeStructureActionState,
  formData: FormData
): Promise<FeeStructureActionState> {
  const feeTypeId = (formData.get("fee_type_id") as string)?.trim() || null;
  const targetType = formData.get("target_type") as string;
  const classId = (formData.get("class_id") as string)?.trim() || null;
  const studentId = (formData.get("student_id") as string)?.trim() || null;
  const amount = parseFloat(formData.get("amount") as string);
  const dueDate = (formData.get("due_date") as string)?.trim() || null;

  if (!feeTypeId) return { error: "Please select a fee type." };
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be greater than 0." };

  if (targetType === "class" && !classId) {
    return { error: "Please select a class." };
  }
  if (targetType === "student" && !studentId) {
    return { error: "Please select a student." };
  }

  try {
    const { supabase, schoolId } = await getSchoolId();

    // Fetch fee type name to use as the structure name
    const { data: feeType } = await supabase
      .from("fee_types")
      .select("name")
      .eq("id", feeTypeId)
      .single();

    const { error } = await supabase.from("fee_structures").insert({
      school_id: schoolId,
      fee_type_id: feeTypeId,
      class_id: targetType === "class" ? classId : null,
      student_id: targetType === "student" ? studentId : null,
      amount,
      due_date: dueDate,
      name: feeType?.name ?? "Fee",
      term: new Date().getFullYear().toString(),
    });

    if (error) return { error: error.message };

    revalidatePath("/dashboard/fee-structures");
    return { success: "Fee structure created." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateFeeStructure(
  id: string,
  formData: FormData
): Promise<FeeStructureActionState> {
  const feeTypeId = (formData.get("fee_type_id") as string)?.trim() || null;
  const targetType = formData.get("target_type") as string;
  const classId = (formData.get("class_id") as string)?.trim() || null;
  const studentId = (formData.get("student_id") as string)?.trim() || null;
  const amount = parseFloat(formData.get("amount") as string);
  const dueDate = (formData.get("due_date") as string)?.trim() || null;

  if (!feeTypeId) return { error: "Please select a fee type." };
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be greater than 0." };

  try {
    const { supabase } = await getSchoolId();

    const { data: feeType } = await supabase
      .from("fee_types")
      .select("name")
      .eq("id", feeTypeId)
      .single();

    const { error } = await supabase
      .from("fee_structures")
      .update({
        fee_type_id: feeTypeId,
        class_id: targetType === "class" ? classId : null,
        student_id: targetType === "student" ? studentId : null,
        amount,
        due_date: dueDate,
        name: feeType?.name ?? "Fee",
      })
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/fee-structures");
    return { success: "Fee structure updated." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteFeeStructure(
  id: string
): Promise<FeeStructureActionState> {
  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("fee_structures")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "23503") {
        return { error: "Cannot delete — payments reference this fee structure." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/fee-structures");
    return { success: "Fee structure deleted." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

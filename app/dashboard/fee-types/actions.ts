"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";

async function getSchoolId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) throw new Error("No school found");

  return { supabase, schoolId };
}

export interface FeeTypeActionState {
  error?: string;
  success?: string;
}

export async function addFeeType(
  _prevState: FeeTypeActionState,
  formData: FormData
): Promise<FeeTypeActionState> {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const isRecurring = formData.get("is_recurring") === "on";

  if (!name) return { error: "Fee type name is required." };

  try {
    const { supabase, schoolId } = await getSchoolId();

    const { error } = await supabase.from("fee_types").insert({
      school_id: schoolId,
      name,
      description,
      is_recurring: isRecurring,
    } as never);

    if (error) {
      if (error.code === "23505") {
        return { error: `A fee type named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/fee-types");
    return { success: `Fee type "${name}" created.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateFeeType(
  feeTypeId: string,
  formData: FormData
): Promise<FeeTypeActionState> {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const isRecurring = formData.get("is_recurring") === "on";

  if (!name) return { error: "Fee type name is required." };

  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("fee_types")
      .update({ name, description, is_recurring: isRecurring } as never)
      .eq("id", feeTypeId);

    if (error) {
      if (error.code === "23505") {
        return { error: `A fee type named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/fee-types");
    return { success: "Fee type updated." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteFeeType(
  feeTypeId: string
): Promise<FeeTypeActionState> {
  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("fee_types")
      .delete()
      .eq("id", feeTypeId);

    if (error) {
      if (error.code === "23503") {
        return { error: "Cannot delete a fee type that is in use." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/fee-types");
    return { success: "Fee type deleted." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

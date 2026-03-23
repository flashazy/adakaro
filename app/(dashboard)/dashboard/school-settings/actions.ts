"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  isSchoolCurrencyCode,
  type SchoolCurrencyCode,
} from "@/lib/currency";

export interface SchoolSettingsState {
  error?: string;
  success?: boolean;
}

export async function updateSchoolCurrency(
  _prev: SchoolSettingsState,
  formData: FormData
): Promise<SchoolSettingsState> {
  const raw = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!isSchoolCurrencyCode(raw)) {
    return { error: "Please choose a valid currency." };
  }
  const currency = raw as SchoolCurrencyCode;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in." };
  }

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return { error: "No school found for your account." };
  }

  const { error } = await supabase
    .from("schools")
    .update({ currency } as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[updateSchoolCurrency]", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  revalidatePath("/dashboard/fee-structures");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/reports");
  return { success: true };
}

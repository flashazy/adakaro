"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateAndNormalizeClassTeacherPhone,
} from "@/lib/class-teacher-phone";
import { checkIsTeacher } from "@/lib/teacher-auth";

export async function updateClassTeacherOwnPhoneAction(
  raw: string
): Promise<{ ok: true; phone: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  if (!(await checkIsTeacher(supabase, user.id))) {
    return { ok: false, error: "Only teachers can update this number." };
  }

  const validated = validateAndNormalizeClassTeacherPhone(raw);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ phone: validated.phone } as never)
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message || "Could not save phone number." };
  }

  revalidatePath("/teacher-dashboard/class-teacher");
  revalidatePath("/parent-dashboard");

  return { ok: true, phone: validated.phone };
}

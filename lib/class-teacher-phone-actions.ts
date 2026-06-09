"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateAndNormalizeClassTeacherPhone,
  loadClassTeacherOwnPhone,
} from "@/lib/class-teacher-phone";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { reportTeacherPhoneFailure } from "@/lib/watchdog/health-alert-reporters";

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
    reportTeacherPhoneFailure({
      phase: "save",
      teacher_id: user.id,
      error: error.message,
    });
    return { ok: false, error: error.message || "Could not save phone number." };
  }

  const reloaded = await loadClassTeacherOwnPhone(user.id);
  if (reloaded !== validated.phone) {
    reportTeacherPhoneFailure({
      phase: "verify_after_save",
      teacher_id: user.id,
      expected_null: validated.phone == null,
      reloaded_null: reloaded == null,
    });
    return {
      ok: false,
      error: "Phone number could not be verified after save. Please try again.",
    };
  }

  revalidatePath("/teacher-dashboard/class-teacher");
  revalidatePath("/parent-dashboard");

  return { ok: true, phone: validated.phone };
}

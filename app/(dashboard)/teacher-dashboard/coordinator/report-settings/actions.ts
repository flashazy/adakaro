"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reportAcademicYearToEnrollmentYear } from "@/lib/student-subject-enrollment-queries";

export type ClassReportSettingsActionState = {
  error?: string;
  success?: string;
};

function parseItemsJson(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => String(x ?? "").trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

export async function upsertClassReportSettings(
  _prev: ClassReportSettingsActionState,
  formData: FormData
): Promise<ClassReportSettingsActionState> {
  const classId = String(formData.get("class_id") ?? "").trim();
  const term = String(formData.get("term") ?? "").trim();
  const academicYearRaw = String(formData.get("academic_year") ?? "").trim();
  const closingDate = String(formData.get("closing_date") ?? "").trim() || null;
  const openingDate = String(formData.get("opening_date") ?? "").trim() || null;
  const coordinatorMessage = String(
    formData.get("coordinator_message") ?? ""
  ).trim();
  const itemsJson = String(formData.get("required_items_json") ?? "[]");

  if (!classId) return { error: "Class is required." };
  if (term !== "Term 1" && term !== "Term 2") {
    return { error: "Invalid term." };
  }
  const academicYearInt = reportAcademicYearToEnrollmentYear(academicYearRaw);
  if (coordinatorMessage.length > 500) {
    return { error: "Coordinator message must be at most 500 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: cls } = await supabase
    .from("classes")
    .select("id, school_id")
    .eq("id", classId)
    .maybeSingle();
  const schoolId = (cls as { school_id?: string } | null)?.school_id;
  if (!cls || !schoolId) return { error: "Class not found." };

  const [{ data: coord }, { data: isAdmin }] = await Promise.all([
    supabase
      .from("teacher_coordinators")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("class_id", classId)
      .maybeSingle(),
    supabase.rpc("is_school_admin", { p_school_id: schoolId } as never),
  ]);

  if (!coord && !isAdmin) {
    return {
      error:
        "You must be the class coordinator or a school admin to edit report settings.",
    };
  }

  const requiredItems = parseItemsJson(itemsJson);

  const payload = {
    class_id: classId,
    term,
    academic_year: academicYearInt,
    closing_date: closingDate,
    opening_date: openingDate,
    coordinator_message: coordinatorMessage || null,
    required_items: requiredItems.length > 0 ? requiredItems : null,
    created_by: user.id,
  };

  const { error } = await supabase.from("class_report_settings").upsert(
    payload as never,
    { onConflict: "class_id,term,academic_year" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/teacher-dashboard/coordinator/report-settings");
  revalidatePath("/teacher-dashboard/report-cards");
  revalidatePath("/parent-dashboard");

  return { success: "Report settings saved." };
}

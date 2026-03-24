"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { escapeRegExp } from "@/lib/admission-number";
import { checkStudentLimit } from "@/lib/plan-limits";

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

export interface StudentActionState {
  error?: string;
  success?: string;
}

export async function addStudent(
  _prevState: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const fullName = (formData.get("full_name") as string)?.trim();
  const snapshotField = formData.get("admission_default_snapshot");
  const admissionDefaultSnapshot =
    typeof snapshotField === "string" ? snapshotField.trim() : "";
  const admissionNumberRaw =
    (formData.get("admission_number") as string)?.trim() || null;
  const classId = (formData.get("class_id") as string)?.trim();
  const parentName = (formData.get("parent_name") as string)?.trim() || null;
  const parentEmail = (formData.get("parent_email") as string)?.trim() || null;
  const parentPhone = (formData.get("parent_phone") as string)?.trim() || null;

  if (!fullName) return { error: "Student name is required." };
  if (!classId) return { error: "Please select a class." };

  try {
    const { supabase, schoolId } = await getSchoolId();

    const { data: schoolRow, error: schoolErr } = await supabase
      .from("schools")
      .select("admission_prefix")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolErr) {
      return { error: schoolErr.message };
    }

    const schoolPrefix = (
      schoolRow as { admission_prefix: string | null } | null
    )?.admission_prefix?.trim();

    let admissionNumber: string | null = null;

    async function allocateNextAdmission(): Promise<
      { ok: true; value: string } | { ok: false; message: string }
    > {
      if (!schoolPrefix) {
        return {
          ok: false,
          message:
            "Set an admission prefix under School settings before using auto-generated admission numbers.",
        };
      }
      const { data: generated, error: genErr } = await supabase.rpc(
        "get_next_admission_number",
        { p_school_id: schoolId } as never
      );
      if (genErr) {
        return { ok: false, message: genErr.message };
      }
      const genText = generated as string | null | undefined;
      if (typeof genText !== "string" || !genText.trim()) {
        return {
          ok: false,
          message: "Could not generate an admission number.",
        };
      }
      return { ok: true, value: genText.trim() };
    }

    if (!schoolPrefix) {
      admissionNumber =
        admissionNumberRaw && admissionNumberRaw !== ""
          ? admissionNumberRaw
          : null;
    } else {
      const submitted = admissionNumberRaw ?? "";
      const snapshot = admissionDefaultSnapshot;
      const stillUsingSuggested =
        snapshot !== "" && submitted !== "" && submitted === snapshot;
      const cleared = submitted === "";

      if (stillUsingSuggested || cleared) {
        const alloc = await allocateNextAdmission();
        if (!alloc.ok) {
          return { error: alloc.message };
        }
        admissionNumber = alloc.value;
      } else {
        admissionNumber = submitted;
        const re = new RegExp(
          `^${escapeRegExp(schoolPrefix)}-\\d+$`,
          "i"
        );
        if (!re.test(admissionNumber)) {
          return {
            error: `Admission number should match your school format (e.g. ${schoolPrefix}-001).`,
          };
        }
      }
    }

    const limitCheck = await checkStudentLimit(supabase, schoolId);
    if (!limitCheck.allowed) {
      return {
        error:
          "You've reached your plan limit. Upgrade to add more students.",
      };
    }

    const { error } = await supabase.from("students").insert({
      school_id: schoolId,
      class_id: classId,
      full_name: fullName,
      admission_number: admissionNumber,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
    } as never);

    if (error) {
      if (error.code === "23505") {
        return {
          error: "This admission number is already in use for another student.",
        };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/students");
    return { success: `Student "${fullName}" added.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateStudent(
  studentId: string,
  formData: FormData
): Promise<StudentActionState> {
  const fullName = (formData.get("full_name") as string)?.trim();
  const admissionNumber =
    (formData.get("admission_number") as string)?.trim() || null;
  const classId = (formData.get("class_id") as string)?.trim();
  const parentName = (formData.get("parent_name") as string)?.trim() || null;
  const parentEmail = (formData.get("parent_email") as string)?.trim() || null;
  const parentPhone = (formData.get("parent_phone") as string)?.trim() || null;

  if (!fullName) return { error: "Student name is required." };
  if (!classId) return { error: "Please select a class." };

  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("students")
      .update({
        full_name: fullName,
        admission_number: admissionNumber,
        class_id: classId,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
      } as never)
      .eq("id", studentId);

    if (error) {
      if (error.code === "23505") {
        return { error: `Admission number "${admissionNumber}" is already in use.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/students");
    return { success: "Student updated." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteStudent(
  studentId: string
): Promise<StudentActionState> {
  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId);

    if (error) {
      if (error.code === "23503") {
        return {
          error: "Cannot delete a student with existing payments or fee records.",
        };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/students");
    return { success: "Student deleted." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

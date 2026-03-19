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
  const membershipTyped = membership as { school_id: string };
  return { supabase, schoolId: membershipTyped.school_id };
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
  const admissionNumber =
    (formData.get("admission_number") as string)?.trim() || null;
  const classId = (formData.get("class_id") as string)?.trim();
  const parentName = (formData.get("parent_name") as string)?.trim() || null;
  const parentEmail = (formData.get("parent_email") as string)?.trim() || null;
  const parentPhone = (formData.get("parent_phone") as string)?.trim() || null;

  if (!fullName) return { error: "Student name is required." };
  if (!classId) return { error: "Please select a class." };

  try {
    const { supabase, schoolId } = await getSchoolId();

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
        return { error: `Admission number "${admissionNumber}" is already in use.` };
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

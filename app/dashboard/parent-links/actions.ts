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

  return { supabase, schoolId: membership.school_id, userId: user.id };
}

export interface LinkActionState {
  error?: string;
  success?: string;
}

export async function addParentLink(
  _prevState: LinkActionState,
  formData: FormData
): Promise<LinkActionState> {
  const parentId = (formData.get("parent_id") as string)?.trim();
  const studentId = (formData.get("student_id") as string)?.trim();

  if (!parentId || !studentId) {
    return { error: "Both parent and student are required." };
  }

  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase.from("parent_students").insert({
      parent_id: parentId,
      student_id: studentId,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: "This parent is already linked to this student." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/parent-links");
    return { success: "Parent linked to student successfully." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteParentLink(
  linkId: string
): Promise<LinkActionState> {
  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("parent_students")
      .delete()
      .eq("id", linkId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/parent-links");
    return { success: "Link removed." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

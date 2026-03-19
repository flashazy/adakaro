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

export interface ClassActionState {
  error?: string;
  success?: string;
}

export async function addClass(
  _prevState: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "Class name is required." };
  }

  try {
    const { supabase, schoolId } = await getSchoolId();

    const { error } = await supabase.from("classes").insert({
      school_id: schoolId,
      name,
      description,
    });

    if (error) {
      if (error.code === "23505") {
        return { error: `A class named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");
    return { success: `Class "${name}" created.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateClass(
  classId: string,
  formData: FormData
): Promise<ClassActionState> {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "Class name is required." };
  }

  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("classes")
      .update({ name, description })
      .eq("id", classId);

    if (error) {
      if (error.code === "23505") {
        return { error: `A class named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");
    return { success: `Class updated.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteClass(classId: string): Promise<ClassActionState> {
  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId);

    if (error) {
      if (error.code === "23503") {
        return { error: "Cannot delete a class that has students." };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");
    return { success: "Class deleted." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

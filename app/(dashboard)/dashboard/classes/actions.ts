"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminActionFromServerAction } from "@/lib/admin-activity-log";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { toUppercase } from "@/lib/utils";

async function getSchoolId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) throw new Error("No school found");

  return { supabase, schoolId, userId: user.id };
}

export interface ClassActionState {
  error?: string;
  success?: string;
}

export async function addClass(
  _prevState: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const name = toUppercase(String(formData.get("name") ?? ""));
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "Class name is required." };
  }

  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    const { error } = await supabase.from("classes").insert({
      school_id: schoolId,
      name,
      description,
    } as never);

    if (error) {
      if (error.code === "23505") {
        return { error: `A class named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");

    void logAdminActionFromServerAction(
      userId,
      "create_class",
      { class_name: name },
      schoolId
    );

    return { success: `Class "${name}" created.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateClass(
  classId: string,
  formData: FormData
): Promise<ClassActionState> {
  const name = toUppercase(String(formData.get("name") ?? ""));
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name) {
    return { error: "Class name is required." };
  }

  try {
    const { supabase, schoolId, userId } = await getSchoolId();

    const { error } = await supabase
      .from("classes")
      .update({ name, description } as never)
      .eq("id", classId);

    if (error) {
      if (error.code === "23505") {
        return { error: `A class named "${name}" already exists.` };
      }
      return { error: error.message };
    }

    revalidatePath("/dashboard/classes");

    void logAdminActionFromServerAction(
      userId,
      "update_class",
      { class_id: classId, class_name: name },
      schoolId
    );

    return { success: `Class updated.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteClass(classId: string): Promise<ClassActionState> {
  try {
    const { supabase, schoolId, userId } = await getSchoolId();

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

    void logAdminActionFromServerAction(
      userId,
      "delete_class",
      { class_id: classId },
      schoolId
    );

    return { success: "Class deleted." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

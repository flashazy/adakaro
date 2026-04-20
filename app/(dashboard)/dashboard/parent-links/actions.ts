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

  return { supabase, schoolId, userId: user.id };
}

export interface LinkActionState {
  error?: string;
  success?: string;
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
    revalidatePath("/dashboard/parent-links/approved");
    return { success: "Link removed." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

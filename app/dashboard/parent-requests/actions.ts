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

export interface RequestActionState {
  error?: string;
  success?: string;
}

export async function approveRequest(
  requestId: string,
  studentId: string
): Promise<RequestActionState> {
  if (!requestId || !studentId) {
    return { error: "Request and student are required." };
  }

  try {
    const { supabase } = await getSchoolId();

    // Get the request to find the parent_id
    const { data: request, error: fetchErr } = await supabase
      .from("parent_link_requests")
      .select("parent_id, student_id")
      .eq("id", requestId)
      .single();

    if (fetchErr || !request) {
      return { error: "Request not found." };
    }
    const requestTyped = request as { parent_id: string; student_id: string | null };

    // Insert the parent-student link
    const { error: linkErr } = await supabase
      .from("parent_students")
      .insert({
        parent_id: requestTyped.parent_id,
        student_id: studentId,
      } as never);

    if (linkErr) {
      if (linkErr.code === "23505") {
        // Already linked — still mark as approved
      } else {
        return { error: linkErr.message };
      }
    }

    // Update request status to approved
    const { error: updateErr } = await supabase
      .from("parent_link_requests")
      .update({ status: "approved" } as never)
      .eq("id", requestId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath("/dashboard/parent-requests");
    return { success: "Request approved. Parent has been linked." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function rejectRequest(
  requestId: string
): Promise<RequestActionState> {
  if (!requestId) {
    return { error: "Request ID is required." };
  }

  try {
    const { supabase } = await getSchoolId();

    const { error } = await supabase
      .from("parent_link_requests")
      .update({ status: "rejected" } as never)
      .eq("id", requestId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard/parent-requests");
    return { success: "Request rejected." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

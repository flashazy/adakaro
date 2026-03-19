"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface LinkRequestState {
  error?: string;
  success?: string;
}

export async function submitLinkRequest(
  _prevState: LinkRequestState,
  formData: FormData
): Promise<LinkRequestState> {
  const admissionNumber = (formData.get("admission_number") as string)?.trim();

  if (!admissionNumber) {
    return { error: "Admission number is required." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated." };

    // Use SECURITY DEFINER function to look up student without RLS restrictions
    const { data: result, error: rpcError } = await supabase.rpc(
      "lookup_student_by_admission",
      { adm_number: admissionNumber }
    );

    if (rpcError) {
      return { error: "Something went wrong. Please try again." };
    }

    if (!result || result.length === 0) {
      return {
        error:
          "No student found with that admission number. Please check and try again.",
      };
    }

    const { student_id, school_id } = result[0];

    // Check if a pending request already exists for this parent + student
    const { data: existing } = await supabase
      .from("parent_link_requests")
      .select("id, status")
      .eq("parent_id", user.id)
      .eq("student_id", student_id)
      .in("status", ["pending"])
      .maybeSingle();

    if (existing) {
      return {
        error:
          "You already have a pending request for this student. Please wait for the school to approve it.",
      };
    }

    // Check if already linked
    const { data: alreadyLinked } = await supabase
      .from("parent_students")
      .select("id")
      .eq("parent_id", user.id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (alreadyLinked) {
      return { error: "This student is already linked to your account." };
    }

    // Insert the link request
    const { error: insertError } = await supabase
      .from("parent_link_requests")
      .insert({
        parent_id: user.id,
        admission_number: admissionNumber,
        student_id,
        school_id,
        status: "pending",
      });

    if (insertError) {
      return { error: insertError.message };
    }

    revalidatePath("/parent-dashboard");
    return {
      success:
        "Request sent to the school. You will be notified when approved.",
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

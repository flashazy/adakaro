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

    // Prefer a school where this parent already has a linked child (avoids wrong school when
    // the same admission number exists in multiple schools).
    const { data: linkRows } = await supabase
      .from("parent_students")
      .select("students(school_id)")
      .eq("parent_id", user.id)
      .limit(1);

    const firstLink = linkRows?.[0] as
      | { students: { school_id: string } | null }
      | undefined;
    const preferSchoolId = firstLink?.students?.school_id ?? null;

    // Use SECURITY DEFINER function to look up student without RLS restrictions
    const { data: result, error: rpcError } = await supabase.rpc(
      "lookup_student_by_admission",
      {
        adm_number: admissionNumber,
        p_prefer_school_id: preferSchoolId,
      } as never
    );

    if (rpcError) {
      return { error: "Something went wrong. Please try again." };
    }

    const resultTyped = result as { student_id: string; school_id: string }[] | null;
    if (!resultTyped || resultTyped.length === 0) {
      return {
        error:
          "No student found with that admission number. Please check and try again.",
      };
    }

    const { student_id, school_id } = resultTyped[0];

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
      } as never);

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

export async function cancelPendingLinkRequest(
  requestId: string
): Promise<{ error?: string; success?: string }> {
  if (!requestId?.trim()) {
    return { error: "Request not found." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated." };

    const { data: deleted, error } = await supabase
      .from("parent_link_requests")
      .delete()
      .eq("id", requestId)
      .eq("parent_id", user.id)
      .eq("status", "pending")
      .select("id");

    if (error) {
      return { error: error.message };
    }
    if (!deleted?.length) {
      return {
        error:
          "Could not cancel this request. It may have already been approved or removed.",
      };
    }

    revalidatePath("/parent-dashboard");
    return { success: "Request cancelled. You can send a new one if needed." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

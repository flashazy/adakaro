"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { checkStudentLimit } from "@/lib/plan-limits";

async function requireSchoolAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }
  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    throw new Error("No school found.");
  }
  const { data: isAdmin, error } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (error || !isAdmin) {
    throw new Error("Forbidden.");
  }
  return { supabase, user, schoolId };
}

export async function approvePendingStudentAction(
  studentId: string
): Promise<{ error?: string; ok?: true }> {
  try {
    const { supabase, user, schoolId } = await requireSchoolAdmin();
    const limit = await checkStudentLimit(supabase, schoolId);
    if (!limit.allowed) {
      return {
        error:
          "This school has reached its student limit. Free a slot or upgrade before approving.",
      };
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("students")
      .update({
        approval_status: "approved",
        approved_by: user.id,
        approved_at: now,
        rejected_at: null,
        rejection_reason: null,
      } as never)
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .eq("approval_status", "pending")
      .select("id");

    if (error) return { error: error.message };
    if (!data?.length) {
      return { error: "This enrolment is no longer pending." };
    }
    revalidatePath("/dashboard/pending-approvals");
    revalidatePath("/dashboard/students");
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function rejectPendingStudentAction(
  studentId: string,
  reason: string | null
): Promise<{ error?: string; ok?: true }> {
  try {
    const { supabase, schoolId } = await requireSchoolAdmin();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("students")
      .update({
        approval_status: "rejected",
        rejected_at: now,
        rejection_reason: reason?.trim() || null,
      } as never)
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .eq("approval_status", "pending")
      .select("id");

    if (error) return { error: error.message };
    if (!data?.length) {
      return { error: "This enrolment is no longer pending." };
    }
    revalidatePath("/dashboard/pending-approvals");
    revalidatePath("/dashboard/students");
    return { ok: true as const };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

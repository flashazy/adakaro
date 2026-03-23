"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

async function getAuthenticatedSupabase() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  return { supabase, user };
}

function parseRpcResult(data: Json | null): { ok: boolean; error?: string } {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Invalid response" };
  }
  const obj = data as Record<string, Json | undefined>;
  const ok = obj.ok === true;
  const err =
    typeof obj.error === "string" ? obj.error : undefined;
  return ok ? { ok: true } : { ok: false, error: err ?? "Request failed" };
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
    const { supabase } = await getAuthenticatedSupabase();

    const { data, error } = await supabase.rpc(
      "admin_approve_parent_link_request",
      {
        p_request_id: requestId,
        p_student_id: studentId,
      } as never
    );

    if (error) {
      return { error: error.message };
    }

    const parsed = parseRpcResult(data);
    if (!parsed.ok) {
      return { error: parsed.error ?? "Could not approve request." };
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
    const { supabase } = await getAuthenticatedSupabase();

    const { data, error } = await supabase.rpc(
      "admin_reject_parent_link_request",
      { p_request_id: requestId } as never
    );

    if (error) {
      return { error: error.message };
    }

    const parsed = parseRpcResult(data);
    if (!parsed.ok) {
      return { error: parsed.error ?? "Could not reject request." };
    }

    revalidatePath("/dashboard/parent-requests");
    return { success: "Request rejected." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

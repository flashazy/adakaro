import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { NewDemoRequestPayload } from "@/lib/demo-requests/bootstrap-lead";

async function fetchSuperAdminProfileIds(
  admin: SupabaseClient<Database>
): Promise<string[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "super_admin");

  if (error) {
    console.error("[demo-requests] fetch super admins:", error.message);
    return [];
  }

  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

export async function notifySuperAdminsOfNewDemoRequest(
  admin: SupabaseClient<Database>,
  payload: NewDemoRequestPayload
): Promise<void> {
  const recipientIds = await fetchSuperAdminProfileIds(admin);
  if (recipientIds.length === 0) return;

  const studentLabel =
    payload.student_count != null
      ? `${payload.student_count} students`
      : "Student count not provided";

  const rows = recipientIds.map((recipientId) => ({
    recipient_id: recipientId,
    category: "demo_request",
    title: "New Demo Request",
    message: `${payload.school_name} · ${payload.full_name} · ${studentLabel}`,
    metadata: {
      demo_request_id: payload.id,
      school_name: payload.school_name,
      full_name: payload.full_name,
      student_count: payload.student_count,
    },
  }));

  const { error } = await admin
    .from("super_admin_notifications")
    .insert(rows as never);

  if (error) {
    console.error("[demo-requests] super admin notification insert:", error.message);
  }
}

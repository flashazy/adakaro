import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { BackButton } from "@/components/dashboard/back-button";
import { CaptureCardUsersClient, type CaptureCardUserRow } from "./capture-card-users-client";

export const dynamic = "force-dynamic";

export default async function CaptureCardUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schoolIdRpc, error: schoolIdRpcError } =
    await supabase.rpc("get_my_school_id");
  if (schoolIdRpcError) {
    console.error("[capture-card-users] page get_my_school_id:", schoolIdRpcError);
  }
  let schoolId =
    schoolIdRpc != null && String(schoolIdRpc).length > 0
      ? (schoolIdRpc as string)
      : null;
  if (!schoolId) {
    schoolId = await getSchoolIdForUser(supabase, user.id);
  }
  if (!schoolId) {
    console.error("[capture-card-users] page no school_id", {
      userId: user.id,
      schoolIdRpc,
    });
    redirect("/dashboard");
  }

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) redirect("/dashboard");

  const { data: rows, error } = await supabase
    .from("capture_card_users")
    .select(
      "id, username, is_active, expires_at, requires_approval, created_at, is_quick_qr_user, quick_qr_label, quick_qr_note"
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[capture-card-users]", error);
  }

  const { data: tokenRows, error: tokenErr } = await supabase
    .from("enrollment_desk_access_tokens")
    .select("capture_card_user_id, expires_at")
    .eq("school_id", schoolId)
    .is("revoked_at", null)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString());

  if (tokenErr) {
    console.error("[capture-card-users] active qr tokens:", tokenErr);
  }

  const activeQrByUserId: Record<string, { expires_at: string }> = {};
  for (const t of tokenRows ?? []) {
    const row = t as { capture_card_user_id: string; expires_at: string };
    if (!activeQrByUserId[row.capture_card_user_id]) {
      activeQrByUserId[row.capture_card_user_id] = {
        expires_at: row.expires_at,
      };
    }
  }

  const users = (rows ?? []) as CaptureCardUserRow[];

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Enrollment Desk Users
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Create temporary users who can help submit student enrollment data.
            </p>
          </div>
          <BackButton
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back
          </BackButton>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <CaptureCardUsersClient
          schoolId={schoolId}
          users={users}
          activeQrByUserId={activeQrByUserId}
        />
      </main>
    </>
  );
}

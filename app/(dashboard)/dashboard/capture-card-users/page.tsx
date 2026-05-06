import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { BackButton } from "@/components/dashboard/back-button";
import { CaptureCardUsersClient } from "./capture-card-users-client";

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
    .select("id, username, is_active, expires_at, requires_approval, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[capture-card-users]", error);
  }

  const users =
    (rows ?? []) as {
      id: string;
      username: string;
      is_active: boolean;
      expires_at: string | null;
      requires_approval: boolean;
      created_at: string;
    }[];

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Capture Card Users
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Create temporary users who can help capture student enrollment data.
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
        <CaptureCardUsersClient schoolId={schoolId} users={users} />
      </main>
    </>
  );
}

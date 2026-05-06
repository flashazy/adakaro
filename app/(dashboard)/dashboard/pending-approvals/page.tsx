import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { BackButton } from "@/components/dashboard/back-button";
import {
  PendingApprovalsClient,
  type PendingStudentRow,
} from "./pending-approvals-client";

export const dynamic = "force-dynamic";

export default async function PendingApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/dashboard");

  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) redirect("/dashboard");

  const { data: stRows, error: stErr } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_number, date_of_birth, parent_phone, enrollment_date, avatar_url, created_at, enrolled_by, class:classes(name)"
    )
    .eq("school_id", schoolId)
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false });

  if (stErr) {
    console.error("[pending-approvals]", stErr);
  }

  const rawList =
    (stRows ?? []) as {
      id: string;
      full_name: string;
      admission_number: string | null;
      date_of_birth: string | null;
      parent_phone: string | null;
      enrollment_date: string;
      avatar_url: string | null;
      created_at: string;
      enrolled_by: string | null;
      class: { name: string } | null;
    }[];

  const enrollIds = [
    ...new Set(
      rawList.map((r) => r.enrolled_by).filter((x): x is string => Boolean(x))
    ),
  ];

  let usernameByAuthId = new Map<string, string>();
  if (enrollIds.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: capRows } = await admin
        .from("capture_card_users")
        .select("auth_user_id, username")
        .eq("school_id", schoolId)
        .in("auth_user_id", enrollIds);
      usernameByAuthId = new Map(
        (capRows ?? []).map((r) => {
          const row = r as { auth_user_id: string; username: string };
          return [row.auth_user_id, row.username] as const;
        })
      );
    } catch {
      usernameByAuthId = new Map();
    }
  }

  const students: PendingStudentRow[] = rawList.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    admission_number: r.admission_number,
    date_of_birth: r.date_of_birth,
    parent_phone: r.parent_phone,
    enrollment_date: r.enrollment_date,
    avatar_url: r.avatar_url,
    created_at: r.created_at,
    class: r.class,
    capture_username: r.enrolled_by
      ? usernameByAuthId.get(r.enrolled_by) ?? null
      : null,
  }));

  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Pending Enrolments
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Review students captured by temporary users before adding them to
              the school records.
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
      <main className="mx-auto max-w-3xl py-8">
        <PendingApprovalsClient students={students} />
      </main>
    </>
  );
}

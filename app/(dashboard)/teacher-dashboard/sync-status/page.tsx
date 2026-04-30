import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsTeacher } from "@/lib/teacher-auth";
import { SyncStatusClient } from "./sync-status-client";

export const metadata = {
  title: "Sync status — Teacher",
};

export default async function SyncStatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await checkIsTeacher(supabase, user.id))) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Sync status
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Anything you saved while offline lives here until it reaches the
            server. Items sync automatically when you&apos;re back online.
          </p>
        </div>
        <Link
          href="/teacher-dashboard"
          className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary"
        >
          ← Back to dashboard
        </Link>
      </div>
      <SyncStatusClient />
    </div>
  );
}

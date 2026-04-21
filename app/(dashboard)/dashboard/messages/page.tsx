import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSchoolAdminBroadcastAudience } from "@/lib/broadcasts/school-admin-audience";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { MessagesClient } from "./messages-client";

export const metadata = {
  title: "Messages | Adakaro",
};

export default async function SchoolAdminMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const isSuper = await checkIsSuperAdmin(supabase, user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile as { role: string } | null)?.role;
  if (role === "parent") {
    redirect("/parent-dashboard");
  }
  const canViewMessages = await isSchoolAdminBroadcastAudience(
    user.id,
    supabase,
    isSuper
  );
  if (!canViewMessages) {
    redirect("/dashboard");
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-school-primary hover:opacity-90 dark:text-school-primary dark:hover:opacity-90"
        >
          ← Back to dashboard
        </Link>
      </div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Messages
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Broadcasts from the Adakaro team. Mark items as read when you have
          seen them.
        </p>
      </header>
      <MessagesClient />
    </div>
  );
}

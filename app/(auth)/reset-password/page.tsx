import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Set a new password — Adakaro",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=" + encodeURIComponent("/reset-password"));
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, recovery_reset_required")
    .eq("id", user.id)
    .maybeSingle();
  const pr = profileRow as {
    role: string;
    recovery_reset_required: boolean;
  } | null;

  if (pr?.role !== "parent") {
    if (pr?.role === "admin") redirect("/dashboard");
    if (pr?.role === "teacher") redirect("/teacher-dashboard");
    redirect("/parent-dashboard");
  }
  if (!pr?.recovery_reset_required) {
    redirect("/parent-dashboard");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
        Set a new password
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
        You&apos;re almost done. Create a new password to secure your account.
        Use your account email to sign in next time, or the same options your
        school has enabled.
      </p>
      <ParentResetPasswordForm />
    </div>
  );
}

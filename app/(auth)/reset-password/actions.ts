"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ParentResetPasswordState = {
  error?: string;
  success?: string;
};

export async function parentResetPasswordAction(
  _prev: ParentResetPasswordState,
  formData: FormData
): Promise<ParentResetPasswordState> {
  void _prev;
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are not signed in." };
  }

  const { data: profileRow, error: profReadErr } = await supabase
    .from("profiles")
    .select("role, recovery_reset_required")
    .eq("id", user.id)
    .maybeSingle();

  if (profReadErr) {
    return { error: "Could not load your profile." };
  }
  const pr = profileRow as {
    role: string;
    recovery_reset_required: boolean;
  } | null;

  if (pr?.role !== "parent") {
    return { error: "This page is for parent accounts only." };
  }
  if (!pr?.recovery_reset_required) {
    redirect("/parent-dashboard");
  }

  const { error: authErr } = await supabase.auth.updateUser({ password });
  if (authErr) {
    return { error: authErr.message };
  }

  const { error: updErr } = await (supabase as Db)
    .from("profiles")
    .update({
      recovery_reset_required: false,
      password_changed: true,
    } satisfies Database["public"]["Tables"]["profiles"]["Update"])
    .eq("id", user.id);

  if (updErr) {
    return {
      error:
        updErr.message ||
        "Password was updated but your profile could not be saved. Contact support.",
    };
  }

  redirect("/parent-dashboard");
}

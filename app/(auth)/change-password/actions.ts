"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase v2 update payload narrows to `never` without generated Relationships
type Db = any;

export type ChangePasswordState =
  | { ok: true }
  | { ok: false; error: string };

export async function changeTeacherPasswordAction(
  _prev: ChangePasswordState | null,
  formData: FormData
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const nextRaw = String(formData.get("next") ?? "").trim();

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, password_changed")
    .eq("id", user.id)
    .maybeSingle();

  const pr = profileRow as {
    role: string;
    password_changed: boolean | null;
  } | null;

  if (pr?.role !== "teacher" && pr?.role !== "admin") {
    return {
      ok: false,
      error: "This password setup page is not available for your account.",
    };
  }

  if (pr?.password_changed !== false) {
    if (pr?.role === "admin") {
      redirect("/dashboard");
    }
    redirect("/teacher-dashboard");
  }

  const { error: authErr } = await supabase.auth.updateUser({ password });
  if (authErr) {
    return { ok: false, error: authErr.message };
  }

  type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
  const { error: profErr } = await (supabase as Db)
    .from("profiles")
    .update({ password_changed: true } satisfies ProfileUpdate)
    .eq("id", user.id);

  if (profErr) {
    return {
      ok: false,
      error:
        profErr.message ||
        "Password was updated but your profile could not be marked complete. Contact support.",
    };
  }

  if (nextRaw.startsWith("/") && !nextRaw.startsWith("//")) {
    redirect(nextRaw);
  }
  if (pr?.role === "admin") {
    redirect("/dashboard");
  }
  redirect("/teacher-dashboard");
}

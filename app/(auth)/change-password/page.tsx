import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = {
  title: "Change password — Adakaro",
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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

  if (pr?.role !== "teacher") {
    redirect("/dashboard");
  }

  if (pr?.password_changed !== false) {
    redirect("/teacher-dashboard");
  }

  const sp = await searchParams;
  const nextParam = sp?.next?.trim() ?? "";
  const nextPath =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/teacher-dashboard";

  return <ChangePasswordForm nextPath={nextPath} />;
}

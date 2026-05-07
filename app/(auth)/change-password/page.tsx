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
    .select("role, password_changed, password_forced_reset, must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  const pr = profileRow as {
    role: string;
    password_changed: boolean | null;
    password_forced_reset: boolean;
    must_change_password?: boolean;
  } | null;

  if (pr?.role === "super_admin") {
    redirect("/super-admin");
  }
  if (pr?.role === "admin") {
    redirect("/dashboard");
  }

  const mustChangeTeacher =
    pr?.role === "teacher" &&
    (pr.password_changed === false || pr.password_forced_reset === true);
  const mustChangeParent =
    pr?.role === "parent" && pr.must_change_password === true;

  if (!mustChangeTeacher && !mustChangeParent) {
    if (pr?.role === "teacher") {
      redirect("/teacher-dashboard");
    }
    if (pr?.role === "parent") {
      redirect("/parent-dashboard");
    }
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const nextParam = sp?.next?.trim() ?? "";
  const defaultNext =
    pr?.role === "parent" ? "/parent-dashboard" : "/teacher-dashboard";
  const nextPath =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : defaultNext;

  return (
    <ChangePasswordForm
      nextPath={nextPath}
      variant={mustChangeParent ? "parent" : "teacher"}
    />
  );
}

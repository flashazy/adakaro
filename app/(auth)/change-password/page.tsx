import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  parentMustChangePassword,
  teacherMustChangePassword,
} from "@/lib/auth-password-gate";
import {
  fetchProfilePasswordGateRow,
  fetchProfilePasswordGateRowForUser,
} from "@/lib/fetch-profile-password-gate-row";
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

  const pr = await fetchProfilePasswordGateRowForUser(
    user.id,
    user.user_metadata
  );

  if (!pr) {
    redirect("/login");
  }

  if (pr.role === "super_admin") {
    redirect("/super-admin");
  }
  if (pr.role === "admin") {
    redirect("/dashboard");
  }

  const mustChangeTeacher = teacherMustChangePassword(pr);
  const mustChangeParent = parentMustChangePassword(pr);

  const sp = await searchParams;
  const nextParam = sp?.next?.trim() ?? "";
  const defaultNext =
    pr.role === "parent" ? "/parent-dashboard" : "/teacher-dashboard";
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

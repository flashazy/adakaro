"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

const COOKIE = "school_dashboard_mode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function setDashboardModeCookie(mode: "admin" | "teacher") {
  document.cookie = `${COOKIE}=${mode};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

/**
 * Lets users who are both school admin and teacher switch between dashboards.
 * Parent layout passes `enabled` for profile teacher when the current school
 * has school_members with role admin or promoted_from_teacher_at set.
 */
export function SchoolDashboardRoleToggle({
  enabled = false,
}: {
  enabled?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!enabled) return null;

  const onAdminArea = pathname.startsWith("/dashboard");
  const onTeacherArea = pathname.startsWith("/teacher-dashboard");

  if (!onAdminArea && !onTeacherArea) return null;

  function goTeacher() {
    setDashboardModeCookie("teacher");
    startTransition(() => {
      router.push("/teacher-dashboard");
    });
  }

  function goAdmin() {
    setDashboardModeCookie("admin");
    startTransition(() => {
      router.push("/dashboard");
    });
  }

  if (onAdminArea) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={goTeacher}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {pending ? "Switching…" : "Teacher view"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={goAdmin}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {pending ? "Switching…" : "Admin view"}
    </button>
  );
}

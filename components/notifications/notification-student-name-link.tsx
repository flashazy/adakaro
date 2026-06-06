"use client";

import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { cn } from "@/lib/utils";

const linkClassName =
  "font-medium text-school-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-school-primary/30 focus-visible:ring-offset-1 dark:text-school-primary";

export function NotificationStudentNameLink({
  studentId,
  studentName,
  profilePath,
  canOpenProfile,
  onNavigate,
  className,
}: {
  studentId: string;
  studentName: string;
  profilePath: string;
  canOpenProfile: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const label = studentName.trim() || "Student";

  if (!canOpenProfile) {
    return (
      <span className={cn("font-medium text-slate-700 dark:text-zinc-300", className)}>
        {label}
      </span>
    );
  }

  return (
    <NavLinkWithLoading
      href={profilePath}
      className={cn(linkClassName, className)}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate?.();
      }}
    >
      {label}
    </NavLinkWithLoading>
  );
}

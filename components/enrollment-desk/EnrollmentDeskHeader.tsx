"use client";

import Image from "next/image";
import { Building2 } from "lucide-react";
import { CaptureButton } from "@/components/ui/capture-button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { toast } from "sonner";
import { useFormStatus } from "react-dom";

function schoolInitials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
      .toUpperCase()
      .slice(0, 2);
  }
  return t.slice(0, 2).toUpperCase();
}

function logoSrcWithVersion(url: string, version: number | null): string {
  const base = url.split("?")[0] ?? url;
  if (version == null || !Number.isFinite(version)) return base;
  return `${base}?v=${version}`;
}

function LogoutButton({ error }: { error?: string }) {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);
  return (
    <CaptureButton
      type="submit"
      variant="outline"
      size="sm"
      className="h-10"
      loading={pending}
      loadingLabel="Logging out…"
    >
      Log out
    </CaptureButton>
  );
}

export function EnrollmentDeskHeader(props: {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolLogoVersion?: number | null;
  title?: string;
  subtitle?: string;
  logoutAction?: (formData: FormData) => void | Promise<void>;
  logoutError?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  const {
    schoolName,
    schoolLogoUrl = null,
    schoolLogoVersion = null,
    title = "Enrollment Desk",
    subtitle = "",
    logoutAction,
    logoutError,
    rightSlot,
    className,
  } = props;

  const displaySchool = schoolName.trim() || "Your school";
  const initials = schoolInitials(displaySchool);
  const logoSrc = schoolLogoUrl?.trim()
    ? logoSrcWithVersion(schoolLogoUrl.trim(), schoolLogoVersion)
    : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            {logoSrc ? (
              <Image
                src={logoSrc}
                alt={`${displaySchool} logo`}
                width={40}
                height={40}
                className="h-full w-full object-contain p-0.5"
              />
            ) : initials ? (
              <span
                className="flex h-full w-full items-center justify-center bg-[rgb(var(--school-primary-rgb)/0.16)] text-xs font-bold text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.20)] dark:text-school-primary"
                aria-hidden
              >
                {initials}
              </span>
            ) : (
              <Building2
                className="h-5 w-5 text-slate-400 dark:text-zinc-500"
                aria-hidden
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              {displaySchool}
            </p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rightSlot}
          {logoutAction ? (
            <form action={logoutAction}>
              <LogoutButton error={logoutError} />
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}


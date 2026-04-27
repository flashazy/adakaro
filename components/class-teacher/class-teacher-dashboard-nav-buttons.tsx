"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const quickPrimaryClass =
  "inline-flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-school-primary px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-[filter,box-shadow] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary disabled:pointer-events-none disabled:opacity-60";

const replyOutlineClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-school-primary shadow-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700 sm:w-auto";

/** Quick actions: purple full-width nav (View students, Messages). */
export function ClassTeacherDashboardQuickNavButton({
  href,
  icon,
  label,
  badge,
  relative,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  badge?: ReactNode;
  relative?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.push(href))}
      className={cn(quickPrimaryClass, relative && "relative")}
    >
      {badge}
      {pending ? (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-white"
          aria-hidden
        />
      ) : (
        <span className="text-base leading-none" aria-hidden>
          {icon}
        </span>
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Recent message row Reply → messages inbox with query. */
export function ClassTeacherDashboardReplyNavButton({
  href,
}: {
  href: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.push(href))}
      className={replyOutlineClass}
    >
      {pending ? (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-school-primary dark:text-school-primary"
          aria-hidden
        />
      ) : null}
      <span>Reply</span>
    </button>
  );
}

/** Header / footer text-style navigation (Messages, View all, Open overview). */
export function ClassTeacherDashboardNavTextLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.push(href))}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 text-left font-medium disabled:opacity-60",
        className
      )}
    >
      {pending ? (
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin text-current"
          aria-hidden
        />
      ) : null}
      <span className={cn("min-w-0", pending && "opacity-90")}>{children}</span>
    </button>
  );
}

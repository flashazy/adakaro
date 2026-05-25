"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { useOptionalDashboardFeedback } from "@/components/dashboard/dashboard-feedback-provider";

interface BackButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Label while navigating (default: Loading...) */
  loadingLabel?: string;
  /**
   * When true, uses `router.back()` if browser history exists;
   * otherwise navigates to `href` (fallback).
   */
  preferHistoryBack?: boolean;
}

/**
 * Navigates via router.push inside startTransition; disables while pending,
 * shows spinner + loading text, and triggers the dashboard top progress bar when the provider is present.
 */
export function BackButton({
  href,
  children,
  className,
  loadingLabel = "Loading...",
  preferHistoryBack = false,
}: BackButtonProps) {
  const router = useRouter();
  const feedback = useOptionalDashboardFeedback();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    feedback?.startNavigation();
    startTransition(() => {
      if (
        preferHistoryBack &&
        typeof window !== "undefined" &&
        window.history.length > 1
      ) {
        router.back();
        return;
      }
      router.push(href);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 disabled:pointer-events-none disabled:opacity-70",
        className
      )}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

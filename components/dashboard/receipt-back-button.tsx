"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { useOptionalDashboardFeedback } from "@/components/dashboard/dashboard-feedback-provider";

interface ReceiptBackButtonProps {
  children: React.ReactNode;
  className?: string;
  loadingLabel?: string;
}

/**
 * Receipt toolbar "Back" — uses SPA history (`router.back()`), not a fixed dashboard route.
 */
export function ReceiptBackButton({
  children,
  className,
  loadingLabel = "Loading…",
}: ReceiptBackButtonProps) {
  const router = useRouter();
  const feedback = useOptionalDashboardFeedback();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    feedback?.startNavigation();
    startTransition(() => {
      router.back();
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

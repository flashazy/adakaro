"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared executive surface styles for Smart Intelligence. */
export const siCardSurface =
  "rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const siCardSurfaceHover =
  "transition-all duration-200 hover:border-slate-200/80 hover:shadow-[0_4px_16px_rgba(15,23,42,0.05)]";

export const siSectionStack = "space-y-8";

export interface IntelligenceEmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}

export function IntelligenceEmptyState({
  title,
  description,
  icon,
  className,
}: IntelligenceEmptyStateProps) {
  return (
    <div className={cn("px-6 py-14 text-center", className)}>
      {icon ? (
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {description}
      </p>
    </div>
  );
}

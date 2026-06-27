"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeHealthLevel } from "@/lib/ai-training/types";

const styles: Record<KnowledgeHealthLevel, string> = {
  healthy: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  needs_review: "bg-amber-50 text-amber-800 ring-amber-200",
};

const labels: Record<KnowledgeHealthLevel, string> = {
  healthy: "Healthy",
  needs_review: "Needs Review",
};

export function KnowledgeHealthBadge({
  level,
  compact = false,
}: {
  level?: KnowledgeHealthLevel | null;
  compact?: boolean;
}) {
  const resolved = level ?? "needs_review";
  const Icon = resolved === "healthy" ? CheckCircle2 : AlertTriangle;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        styles[resolved]
      )}
      title={labels[resolved]}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {compact ? null : labels[resolved]}
    </span>
  );
}

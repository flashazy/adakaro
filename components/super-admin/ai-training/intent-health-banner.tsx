"use client";

import { AlertTriangle } from "lucide-react";
import { saBtnPrimarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import type { IntentHealthSummary } from "@/lib/ai-training/types";

interface IntentHealthBannerProps {
  health: IntentHealthSummary | null;
  onRecalculate: () => void;
}

export function IntentHealthBanner({ health, onRecalculate }: IntentHealthBannerProps) {
  if (!health || health.needsRecalculation === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-950">
            {health.needsRecalculation} knowledge{" "}
            {health.needsRecalculation === 1 ? "entry should" : "entries should"} be
            reclassified using the latest AI intent engine.
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80">
            {health.nullIntentCount > 0
              ? `${health.nullIntentCount} missing intent · `
              : ""}
            Registry {health.registryVersion}
          </p>
        </div>
      </div>
      <button type="button" className={saBtnPrimarySm} onClick={onRecalculate}>
        Recalculate Now
      </button>
    </div>
  );
}

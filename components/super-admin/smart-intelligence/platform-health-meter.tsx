"use client";

import type { PlatformHealthView } from "@/lib/super-admin/smart-intelligence-presentation";
import { platformHealthBadgeClass } from "@/lib/super-admin/smart-intelligence-presentation";
import { cn } from "@/lib/utils";
import { siCardSurface } from "./intelligence-ui-tokens";

export interface PlatformHealthMeterProps {
  health: PlatformHealthView;
}

const SEGMENTS = [
  { label: "Critical", width: 40, className: "bg-red-400/90" },
  { label: "Poor", width: 20, className: "bg-orange-400/90" },
  { label: "Healthy", width: 20, className: "bg-blue-500/90" },
  { label: "Excellent", width: 20, className: "bg-emerald-500/90" },
] as const;

export function PlatformHealthMeter({ health }: PlatformHealthMeterProps) {
  return (
    <article className={cn(siCardSurface, "px-6 py-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Platform Health
          </p>
          <p className="mt-1.5 text-lg font-semibold text-slate-900">
            {health.label}{" "}
            <span className="font-bold tabular-nums text-indigo-600">
              ({health.score}/100)
            </span>
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
            platformHealthBadgeClass(health.tone)
          )}
        >
          {health.label}
        </span>
      </div>

      <div className="relative mt-5">
        <div className="flex h-3 overflow-hidden rounded-full">
          {SEGMENTS.map((seg) => (
            <div
              key={seg.label}
              className={cn("h-full", seg.className)}
              style={{ width: `${seg.width}%` }}
              aria-hidden
            />
          ))}
        </div>

        <div
          className="pointer-events-none absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow-md transition-all duration-700 ease-out"
          style={{ left: `${health.score}%` }}
          aria-hidden
        />

        <div
          className="sr-only"
          role="progressbar"
          aria-valuenow={health.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Platform health ${health.score} out of 100`}
        />
      </div>

      <div className="mt-2.5 flex justify-between text-[11px] font-medium text-slate-400">
        {SEGMENTS.map((seg) => (
          <span key={seg.label}>{seg.label}</span>
        ))}
      </div>
    </article>
  );
}

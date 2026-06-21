"use client";

import { SuperAdminSpinner } from "@/components/super-admin/super-admin-loading-action";
import { cn } from "@/lib/utils";

export function IntelligenceSectionSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[220px] animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex justify-between">
              <div className="h-6 w-20 rounded-full bg-slate-100" />
              <div className="h-8 w-8 rounded-xl bg-slate-100" />
            </div>
            <div className="mt-8 h-3 w-24 rounded bg-slate-200" />
            <div className="mt-2 h-9 w-28 rounded bg-slate-200" />
            <div className="mt-8 h-4 w-full rounded bg-slate-100" />
            <div className="mt-6 h-9 w-full rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntelligenceCardSkeleton() {
  return (
    <div
      className="min-h-[220px] animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-hidden
    >
      <div className="h-6 w-20 rounded-full bg-slate-100" />
      <div className="mt-8 h-9 w-24 rounded bg-slate-200" />
      <div className="mt-4 h-4 w-full rounded bg-slate-100" />
    </div>
  );
}

export function IntelligenceInlineLoading({
  label = "Loading intelligence…",
}: {
  label?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-sm text-slate-500 shadow-sm">
      <SuperAdminSpinner className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

export function intelligenceStatusBadgeClass(tone: string): string {
  return cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
    tone === "healthy" && "border-emerald-200 bg-emerald-50 text-emerald-800",
    tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
    tone === "critical" && "border-red-200 bg-red-50 text-red-800",
    tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600"
  );
}

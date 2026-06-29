"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthorPanel({
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50/80"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          {icon}
          {title}
        </span>
        {badge}
      </button>
      {open ? (
        <div className="animate-in fade-in slide-in-from-top-1 border-t border-slate-100 px-4 pb-4 pt-3 duration-200">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ScoreBadge({
  score,
  variant = "default",
}: {
  score: number;
  variant?: "default" | "success" | "warning" | "muted";
}) {
  const styles = {
    default: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    muted: "bg-slate-50 text-slate-500 ring-slate-100",
  };

  const resolved =
    score >= 80 ? "success" : score >= 50 ? "default" : score >= 25 ? "warning" : "muted";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1 ring-inset",
        styles[variant === "default" ? resolved : variant]
      )}
    >
      {score}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-slate-50 to-white px-3 py-2.5 ring-1 ring-inset ring-slate-100">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 75 ? "bg-emerald-500" : clamped >= 40 ? "bg-indigo-500" : "bg-amber-500";

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

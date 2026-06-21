"use client";

import { cn } from "@/lib/utils";

export interface SparklineProps {
  points: number[];
  /** When true, renders a muted placeholder style */
  placeholder?: boolean;
  direction?: "up" | "down" | "flat" | "unknown";
  className?: string;
  width?: number;
  height?: number;
}

/** Compact 30-day trend sparkline for scorecards (visual only). */
export function Sparkline({
  points,
  placeholder = false,
  direction = "unknown",
  className,
  width = 56,
  height = 22,
}: SparklineProps) {
  if (points.length < 2) return null;

  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * w;
    const y = padding + h - ((p - min) / range) * h;
    return `${x},${y}`;
  });

  const strokeClass = placeholder
    ? "stroke-slate-300"
    : direction === "up"
      ? "stroke-emerald-500"
      : direction === "down"
        ? "stroke-red-400"
        : direction === "flat"
          ? "stroke-slate-400"
          : "stroke-indigo-400";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      aria-hidden
      role="img"
      aria-label={placeholder ? "Insufficient trend history" : "Last 30 days trend"}
    >
      <title>{placeholder ? "Insufficient trend history" : "Last 30 days trend"}</title>
      <polyline
        fill="none"
        className={cn(strokeClass)}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={placeholder ? "3 2" : undefined}
        points={coords.join(" ")}
      />
    </svg>
  );
}

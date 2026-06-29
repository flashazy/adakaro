"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  GitBranch,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BrainHeaderData,
  BrainHealthDiagnosis,
  ExplainableMetric,
  HeatmapCell,
  IntelligenceFeedEvent,
  PageInsightContext,
} from "@/lib/ai-training/operations-presentation";
import { emptyStateMessage } from "@/lib/ai-training/operations-presentation";
import type { IntelligenceTrendPoint } from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";

/* ─── Layout tokens (compact density) ─── */

export const OPS_STACK = "space-y-3";
export const OPS_GRID = "gap-3";

/* ─── Micro animations ─── */

export function AnimatedNumber({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 400;
    const t0 = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setDisplay(Math.round(start + diff * p));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, display]);
  return (
    <span className={cn("tabular-nums", className)}>
      {display}
      {suffix}
    </span>
  );
}

export function AnimatedBar({
  percent,
  className,
  colorClass = "bg-gradient-to-r from-indigo-500 to-violet-500",
}: {
  percent: number;
  className?: string;
  colorClass?: string;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 80);
    return () => clearTimeout(t);
  }, [percent]);
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", colorClass)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/* ─── Semantic colors ─── */

export const SEMANTIC = {
  brand: "text-violet-700 bg-violet-50 border-violet-200",
  healthy: "text-emerald-700 bg-emerald-50 border-emerald-200",
  attention: "text-amber-700 bg-amber-50 border-amber-200",
  info: "text-sky-700 bg-sky-50 border-sky-200",
  critical: "text-red-700 bg-red-50 border-red-200",
} as const;

/* ─── Layout primitives ─── */

export function GlassPanel({
  children,
  className,
  gradient,
  compact,
}: {
  children: React.ReactNode;
  className?: string;
  gradient?: "indigo" | "emerald" | "violet" | "slate" | "sky";
  compact?: boolean;
}) {
  const gradients = {
    indigo: "from-indigo-500/[0.06] via-white/90 to-violet-500/[0.04] border-indigo-100/70",
    emerald: "from-emerald-500/[0.06] via-white/90 to-teal-500/[0.04] border-emerald-100/70",
    violet: "from-violet-500/[0.06] via-white/90 to-purple-500/[0.04] border-violet-100/70",
    slate: "from-slate-50/90 via-white/95 to-slate-100/40 border-slate-200/70",
    sky: "from-sky-500/[0.05] via-white/90 to-blue-500/[0.03] border-sky-100/70",
  };
  return (
    <div
      className={cn(
        "rounded-xl border bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md",
        compact ? "p-3" : "p-3.5",
        gradient ? `bg-gradient-to-br ${gradients[gradient]}` : "border-slate-200/80",
        className
      )}
    >
      {children}
    </div>
  );
}

export function OperationsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-24 rounded-xl bg-slate-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-slate-50" />
      ))}
    </div>
  );
}

export function PageAIInsight({
  message,
  context,
}: {
  message: string;
  context?: PageInsightContext;
}) {
  const tone =
    context === "health"
      ? "sky"
      : context === "missions"
        ? "violet"
        : context === "signals"
          ? "indigo"
          : "slate";
  return (
    <GlassPanel gradient={tone === "sky" ? "sky" : tone === "violet" ? "violet" : "slate"} compact>
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
          <Brain className="h-3.5 w-3.5 text-violet-700" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
            AI Insight
          </p>
          <p className="mt-0.5 text-sm leading-snug text-slate-700 animate-in fade-in duration-300">
            {message}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

export function EmptyStateInsight({
  kind,
  value,
}: {
  kind: Parameters<typeof emptyStateMessage>[0];
  value?: number;
}) {
  return (
    <p className="py-4 text-center text-sm leading-relaxed text-slate-500">
      {emptyStateMessage(kind, value)}
    </p>
  );
}

export function StorySection({
  title,
  what,
  why,
  next,
}: {
  title: string;
  what: string;
  why: string;
  next: string;
}) {
  return (
    <GlassPanel gradient="slate" compact>
      <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="font-bold uppercase tracking-wider text-sky-600">What</dt>
          <dd className="mt-0.5 text-slate-600">{what}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wider text-amber-600">Why</dt>
          <dd className="mt-0.5 text-slate-600">{why}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-wider text-emerald-600">Next</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{next}</dd>
        </div>
      </dl>
    </GlassPanel>
  );
}

/* ─── Brain hero ─── */

export function IntelligenceActivityOrb({
  activity,
  size = "md",
}: {
  activity: BrainHeaderData["brainActivity"];
  size?: "sm" | "md";
}) {
  const intensity =
    activity === "Excellent" ? 1 : activity === "High" ? 0.75 : activity === "Moderate" ? 0.5 : 0.25;
  const outer = size === "sm" ? "h-11 w-11" : "h-14 w-14";
  const inner = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={cn("relative flex items-center justify-center", outer)} aria-hidden>
      <span
        className="absolute inset-0 rounded-full bg-violet-400/25 blur-md animate-pulse"
        style={{ animationDuration: `${3 - intensity}s` }}
      />
      <span
        className="absolute inset-0 rounded-full bg-indigo-400/15 animate-pulse"
        style={{ animationDuration: `${2.2 - intensity * 0.4}s`, animationDelay: "0.2s" }}
      />
      <span
        className={cn(
          "relative flex items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-300/40",
          inner
        )}
      >
        <Brain className={cn("text-white", icon)} />
      </span>
    </div>
  );
}

const STATUS_STYLES = {
  healthy: { dot: "bg-emerald-500", badge: SEMANTIC.healthy, label: "Healthy" },
  attention: { dot: "bg-amber-400", badge: SEMANTIC.attention, label: "Needs Attention" },
  critical: { dot: "bg-red-500", badge: SEMANTIC.critical, label: "Critical" },
};

export function AIBrainHeader({
  data,
  coveragePercent,
}: {
  data: BrainHeaderData;
  coveragePercent?: number;
}) {
  const status = STATUS_STYLES[data.status];
  const confUp = !data.confidenceTrend.startsWith("-");

  return (
    <GlassPanel
      gradient="indigo"
      className="relative overflow-hidden border-violet-200/60"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-indigo-400/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <IntelligenceActivityOrb activity={data.brainActivity} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
                AI Brain
              </p>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", status.dot)} />
              <span className="text-xl font-bold text-slate-900">{data.statusLabel}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1", status.badge)}>
                {status.label}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">
              Version <span className="font-semibold text-violet-700">{data.knowledgeVersion}</span>
              · Mastery{" "}
              <AnimatedNumber value={data.estimatedMastery} suffix="%" className="font-semibold text-violet-700" />
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
          <BrainStat label="Current Mission" value={data.currentMission} tone="brand" />
          <BrainStat label="Focus" value={data.currentFocus} />
          <BrainStat label="Activity" value={data.brainActivity} tone="healthy" />
          <BrainStat label="Learning Rate" value={data.learningRate} tone="info" />
          <BrainStat
            label="Confidence"
            value={data.confidenceTrend}
            tone={confUp ? "healthy" : "attention"}
          />
          <BrainStat label="Growth Today" value={`+${data.lessonsGeneratedToday}`} tone="healthy" />
          <BrainStat label="Approved Today" value={String(data.lessonsApprovedToday)} />
        </div>
      </div>

      {coveragePercent != null ? (
        <div className="relative mt-3 border-t border-white/60 pt-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Coverage progress</span>
            <span className="text-violet-700">
              <AnimatedNumber value={coveragePercent} suffix="%" />
            </span>
          </div>
          <AnimatedBar
            percent={coveragePercent}
            className="mt-1.5"
            colorClass="bg-gradient-to-r from-violet-500 to-indigo-500"
          />
        </div>
      ) : null}
    </GlassPanel>
  );
}

function BrainStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: keyof typeof SEMANTIC;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-0.5 line-clamp-2 font-medium text-slate-800",
          tone === "healthy" && "text-emerald-700",
          tone === "attention" && "text-amber-700",
          tone === "info" && "text-sky-700",
          tone === "brand" && "text-violet-700",
          tone === "critical" && "text-red-700"
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ─── Intelligence feed ─── */

const FEED_ICONS: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  help: HelpCircle,
  "git-branch": GitBranch,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  check: CheckCircle2,
  refresh: RefreshCw,
  target: Target,
  brain: Brain,
  copy: RefreshCw,
  rocket: Zap,
};

const SEVERITY_STYLES = {
  info: "border-sky-100 bg-sky-50/30",
  success: "border-emerald-200 bg-emerald-50/40",
  warning: "border-amber-200 bg-amber-50/40",
  critical: "border-red-200 bg-red-50/40",
};

export function IntelligenceFeed({ events }: { events: IntelligenceFeedEvent[] }) {
  return (
    <GlassPanel compact>
      <div className="flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-sky-600" />
        <h3 className="text-xs font-semibold text-slate-900">Live Intelligence Feed</h3>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-emerald-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
        {events.length === 0 ? (
          <EmptyStateInsight kind="feed" />
        ) : (
          events.map((event) => {
            const Icon = FEED_ICONS[event.icon] ?? Sparkles;
            return (
              <li
                key={event.id}
                className={cn(
                  "flex gap-2 rounded-lg border px-2.5 py-2 transition-all duration-200 hover:-translate-y-px hover:shadow-sm",
                  SEVERITY_STYLES[event.severity]
                )}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900">{event.summary}</p>
                  {event.detail ? (
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">{event.detail}</p>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </GlassPanel>
  );
}

/* ─── Explainable metrics ─── */

export function ExplainableMetricCard({ metric }: { metric: ExplainableMetric }) {
  const tone =
    metric.value >= 80 ? "text-emerald-600" : metric.value >= 60 ? "text-sky-600" : "text-amber-600";

  return (
    <GlassPanel compact className="h-full">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-slate-900">{metric.label}</p>
        <p className={cn("text-2xl font-extrabold tabular-nums", tone)}>
          <AnimatedNumber value={metric.value} suffix="%" />
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{metric.explanation}</p>
      {(metric.strongest || metric.weakest) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          {metric.strongest ? (
            <span className={cn("rounded-full px-2 py-0.5 ring-1", SEMANTIC.healthy)}>
              Strongest: {metric.strongest}
            </span>
          ) : null}
          {metric.weakest ? (
            <span className={cn("rounded-full px-2 py-0.5 ring-1", SEMANTIC.attention)}>
              Weakest: {metric.weakest}
            </span>
          ) : null}
          {metric.estimatedCompletion ? (
            <span className={cn("rounded-full px-2 py-0.5 ring-1", SEMANTIC.info)}>
              ETA: {metric.estimatedCompletion}
            </span>
          ) : null}
        </div>
      )}
      <dl className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 text-[10px]">
        <div>
          <dt className="font-semibold text-slate-500">Why</dt>
          <dd className="text-slate-600">{metric.why}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Improve</dt>
          <dd className="text-slate-600">{metric.howToImprove}</dd>
        </div>
      </dl>
    </GlassPanel>
  );
}

/* ─── Brain health ─── */

export function BrainHealthDiagnosisPanel({ diagnosis }: { diagnosis: BrainHealthDiagnosis }) {
  const gradeTone =
    diagnosis.score >= 85
      ? "text-emerald-600"
      : diagnosis.score >= 70
        ? "text-sky-600"
        : diagnosis.score >= 50
          ? "text-amber-600"
          : "text-red-600";

  return (
    <GlassPanel gradient="emerald" compact>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Brain Health</p>
          <p className={cn("mt-0.5 text-2xl font-bold capitalize", gradeTone)}>
            {diagnosis.grade}
            <span className="ml-2 text-base font-semibold text-slate-500">
              <AnimatedNumber value={diagnosis.score} suffix="%" />
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-amber-800">Recommended</p>
          <p className="mt-0.5 text-xs font-medium text-slate-900">{diagnosis.recommendedAction}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">{diagnosis.narrative}</p>
      <ul className="mt-2 space-y-1">
        {diagnosis.reasons.map((reason) => (
          <li key={reason} className="flex items-start gap-1.5 text-xs text-slate-700">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            {reason}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/* ─── Predictive insights ─── */

export function PredictiveInsightsPanel({
  insights,
}: {
  insights: Array<{ id: string; title: string; description: string; timeframe: string; severity: string }>;
}) {
  if (insights.length === 0) return null;
  return (
    <GlassPanel gradient="violet" compact>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        <h3 className="text-xs font-semibold text-slate-900">Predictive Intelligence</h3>
      </div>
      <ul className="mt-2 space-y-1.5">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="rounded-lg border border-violet-100/80 bg-white/70 px-3 py-2 transition-all duration-200 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-slate-900">{insight.title}</p>
              <span className="shrink-0 text-[10px] font-semibold uppercase text-violet-600">
                {insight.timeframe}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-600">{insight.description}</p>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/* ─── Diagnostic heatmap ─── */

export function HeatmapGrid({
  title,
  cells,
  invert = false,
}: {
  title: string;
  cells: HeatmapCell[];
  invert?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (cells.length === 0) return null;

  const active = cells.find((c) => c.id === hovered);

  return (
    <GlassPanel compact>
      <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
      {active ? (
        <div className="mt-2 rounded-lg border border-sky-200/80 bg-sky-50/50 px-3 py-2 text-[10px] animate-in fade-in duration-200">
          <p className="font-semibold text-slate-900">{active.label}</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-600">
            <dt>Coverage</dt>
            <dd className="font-medium">{active.coverage ?? active.value}%</dd>
            <dt>Confidence</dt>
            <dd className="font-medium">{active.confidence ?? "—"}%</dd>
            <dt>Missing</dt>
            <dd className="font-medium">{active.missingLessons ?? "—"} lessons</dd>
            <dt>ETA</dt>
            <dd className="font-medium">{active.estimatedCompletion ?? "—"}</dd>
          </dl>
          {active.recommendedAction ? (
            <p className="mt-1.5 font-medium text-amber-700">{active.recommendedAction}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-slate-400">Hover a module for diagnostics</p>
      )}
      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {cells.map((cell) => {
          const v = invert ? 100 - cell.value : cell.value;
          const intensity = Math.min(100, Math.max(0, v));
          const bg =
            intensity >= 80
              ? "bg-emerald-500/90 hover:bg-emerald-600"
              : intensity >= 60
                ? "bg-sky-500/85 hover:bg-sky-600"
                : intensity >= 40
                  ? "bg-amber-400/90 hover:bg-amber-500"
                  : "bg-red-400/90 hover:bg-red-500";
          const isActive = hovered === cell.id;

          return (
            <button
              key={cell.id}
              type="button"
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-white transition-all duration-200",
                bg,
                isActive && "ring-2 ring-white ring-offset-1 ring-offset-violet-200 scale-[1.03] shadow-md"
              )}
              onMouseEnter={() => setHovered(cell.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(cell.id)}
              onBlur={() => setHovered(null)}
            >
              <p className="truncate text-[9px] font-medium opacity-90">{cell.label}</p>
              <p className="text-xs font-bold tabular-nums">{cell.value}%</p>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}

/* ─── Trend chart ─── */

export function IntelligenceTrendChart({
  trends,
  dataKey = "confidence",
  label = "Confidence",
  color = "#6366f1",
  compact,
}: {
  trends: IntelligenceTrendPoint[];
  dataKey?: keyof IntelligenceTrendPoint;
  label?: string;
  color?: string;
  compact?: boolean;
}) {
  if (trends.length === 0) return null;

  return (
    <GlassPanel compact>
      <p className="text-xs font-semibold text-slate-900">{label} · 7d</p>
      <div className={cn("mt-2", compact ? "h-28" : "h-32")}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(5)}
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }}
              formatter={(v) => [`${v}%`, label]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassPanel>
  );
}

/* ─── Module strip ─── */

export function ModuleIntelligenceStrip({
  moduleName,
  coverage,
  confidence,
  quality,
  mastery,
  remainingLessons,
  estimatedCompletion,
  upcomingMission,
  narrative,
}: {
  moduleName: string;
  coverage: number;
  confidence: number;
  quality: number;
  mastery: number;
  remainingLessons: number;
  estimatedCompletion: string;
  upcomingMission?: string;
  narrative: string;
}) {
  return (
    <GlassPanel gradient="indigo" compact>
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative shrink-0">
          <MasteryRing percent={mastery} size={56} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-violet-700">
            {mastery}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">{moduleName}</p>
          <p className="mt-0.5 text-xs text-slate-600">{narrative}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] sm:grid-cols-5">
            <MiniStat label="Coverage" value={`${coverage}%`} />
            <MiniStat label="Confidence" value={`${confidence}%`} />
            <MiniStat label="Quality" value={`${quality}%`} />
            <MiniStat label="Remaining" value={`${remainingLessons}`} />
            <MiniStat label="ETA" value={estimatedCompletion} />
            {upcomingMission ? <MiniStat label="Mission" value={upcomingMission} wide /> : null}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

function MiniStat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-md bg-white/60 px-2 py-1.5 ring-1 ring-slate-100", wide && "col-span-2")}>
      <p className="uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function MasteryRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const t = setTimeout(
      () => setOffset(circumference - (percent / 100) * circumference),
      100
    );
    return () => clearTimeout(t);
  }, [percent, circumference]);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#masteryGrad)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
      />
      <defs>
        <linearGradient id="masteryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* Compact brief — folded metrics row */
export function CompactBriefRow({
  generated,
  approved,
  confidenceDelta,
  coverageDelta,
}: {
  generated: number;
  approved: number;
  confidenceDelta: string;
  coverageDelta: string;
}) {
  const items = [
    { label: "Generated", value: String(generated), tone: "info" as const },
    { label: "Approved", value: String(approved), tone: "healthy" as const },
    { label: "Confidence", value: confidenceDelta, tone: "brand" as const },
    { label: "Coverage", value: coverageDelta, tone: "brand" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("rounded-lg px-2.5 py-2 ring-1", SEMANTIC[item.tone])}
        >
          <p className="text-[10px] uppercase opacity-70">{item.label}</p>
          <p className="text-sm font-bold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

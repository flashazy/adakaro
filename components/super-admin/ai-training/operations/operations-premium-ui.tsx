"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
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
  MorningBrief,
  PredictiveInsight,
} from "@/lib/ai-training/operations-presentation";
import type { IntelligenceTrendPoint } from "@/lib/ai-training/knowledge-intelligence-types";
import { cn } from "@/lib/utils";

/* ─── Layout primitives ─── */

export function GlassPanel({
  children,
  className,
  gradient,
}: {
  children: React.ReactNode;
  className?: string;
  gradient?: "indigo" | "emerald" | "violet" | "slate";
}) {
  const gradients = {
    indigo: "from-indigo-500/5 via-white/80 to-violet-500/5 border-indigo-100/80",
    emerald: "from-emerald-500/5 via-white/80 to-teal-500/5 border-emerald-100/80",
    violet: "from-violet-500/5 via-white/80 to-purple-500/5 border-violet-100/80",
    slate: "from-slate-50/80 via-white/90 to-slate-100/50 border-slate-200/80",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md",
        gradient ? `bg-gradient-to-br ${gradients[gradient]}` : "border-slate-200",
        className
      )}
    >
      {children}
    </div>
  );
}

export function OperationsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-32 rounded-2xl bg-slate-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-slate-50" />
      ))}
    </div>
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
    <GlassPanel gradient="slate">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">What happened</dt>
          <dd className="mt-0.5 text-slate-700">{what}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Why it matters</dt>
          <dd className="mt-0.5 text-slate-700">{why}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">What&apos;s next</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{next}</dd>
        </div>
      </dl>
    </GlassPanel>
  );
}

/* ─── Activity orb ─── */

export function IntelligenceActivityOrb({ activity }: { activity: BrainHeaderData["brainActivity"] }) {
  const intensity =
    activity === "Excellent" ? 1 : activity === "High" ? 0.75 : activity === "Moderate" ? 0.5 : 0.25;

  return (
    <div className="relative flex h-14 w-14 items-center justify-center" aria-hidden>
      <span
        className="absolute inset-0 rounded-full bg-indigo-400/20 animate-pulse"
        style={{ animationDuration: `${3 - intensity}s` }}
      />
      <span
        className="absolute inset-1 rounded-full bg-violet-400/15 animate-pulse"
        style={{ animationDuration: `${2.5 - intensity * 0.5}s`, animationDelay: "0.3s" }}
      />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
        <Brain className="h-5 w-5 text-white" />
      </span>
    </div>
  );
}

/* ─── Brain header ─── */

const STATUS_DOT = {
  healthy: "bg-emerald-500",
  attention: "bg-amber-400",
  critical: "bg-red-500",
};

export function AIBrainHeader({ data }: { data: BrainHeaderData }) {
  return (
    <GlassPanel gradient="indigo" className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <IntelligenceActivityOrb activity={data.brainActivity} />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">AI Brain Status</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[data.status])} />
              <span className="text-2xl font-bold text-slate-900">{data.statusLabel}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Knowledge Version <span className="font-semibold text-indigo-700">{data.knowledgeVersion}</span>
              · Estimated mastery{" "}
              <span className="font-semibold tabular-nums">{data.estimatedMastery}%</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <BrainStat label="Current Mission" value={data.currentMission} />
          <BrainStat label="Current Focus" value={data.currentFocus} />
          <BrainStat label="Brain Activity" value={data.brainActivity} />
          <BrainStat label="Learning Rate" value={data.learningRate} />
          <BrainStat label="Confidence Trend" value={data.confidenceTrend} highlight />
          <BrainStat label="Growth Today" value={`+${data.knowledgeGrowthToday} lessons`} />
        </div>
      </div>
    </GlassPanel>
  );
}

function BrainStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-0.5 font-medium text-slate-800", highlight && "text-emerald-700")}>{value}</p>
    </div>
  );
}

/* ─── Welcome + Morning Brief ─── */

export function WelcomeBanner({ message }: { message: string }) {
  const lines = message.split("\n");
  return (
    <GlassPanel gradient="violet">
      <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Operations Assistant</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{lines[0]}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        {lines.slice(1).map((line) => (
          <li key={line} className="flex items-start gap-2">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
            {line}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

export function MorningBriefCard({ brief }: { brief: MorningBrief }) {
  return (
    <GlassPanel gradient="emerald">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{brief.headline}</p>
      <p className="mt-2 text-sm text-slate-600">{brief.story}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BriefMetric label="Generated" value={String(brief.generated)} />
        <BriefMetric label="Approved" value={String(brief.approved)} />
        <BriefMetric label="Rejected" value={String(brief.rejected)} />
        <BriefMetric label="Confidence" value={brief.confidenceDelta} />
        <BriefMetric label="Coverage" value={brief.coverageDelta} />
        <BriefMetric label="Most Requested" value={brief.mostRequested} wide />
        <BriefMetric label="Weakest Module" value={brief.weakestModule} wide />
      </div>
      <div className="mt-4 rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase text-emerald-800">Recommendation</p>
        <p className="mt-1 text-sm font-medium text-emerald-900">{brief.recommendation}</p>
      </div>
    </GlassPanel>
  );
}

function BriefMetric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-lg bg-white/60 px-3 py-2", wide && "col-span-2 sm:col-span-1")}>
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</p>
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
  info: "border-slate-200 bg-white",
  success: "border-emerald-200 bg-emerald-50/40",
  warning: "border-amber-200 bg-amber-50/40",
  critical: "border-red-200 bg-red-50/40",
};

export function IntelligenceFeed({ events }: { events: IntelligenceFeedEvent[] }) {
  return (
    <GlassPanel>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-900">Live Intelligence Feed</h3>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {events.length === 0 ? (
          <li className="py-8 text-center text-sm text-slate-400">No intelligence events yet.</li>
        ) : (
          events.map((event) => {
            const Icon = FEED_ICONS[event.icon] ?? Sparkles;
            return (
              <li
                key={event.id}
                className={cn(
                  "flex gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:border-indigo-200",
                  SEVERITY_STYLES[event.severity]
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{event.summary}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                      {event.category}
                    </span>
                  </div>
                  {event.detail ? <p className="mt-0.5 text-xs text-slate-500">{event.detail}</p> : null}
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
  return (
    <GlassPanel className="h-full">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
        <p className="text-3xl font-extrabold tabular-nums text-indigo-600">{metric.value}%</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{metric.explanation}</p>
      {metric.strongest || metric.weakest ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {metric.strongest ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
              Strongest: {metric.strongest}
            </span>
          ) : null}
          {metric.weakest ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
              Weakest: {metric.weakest}
            </span>
          ) : null}
          {metric.estimatedCompletion ? (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-800">
              ETA: {metric.estimatedCompletion}
            </span>
          ) : null}
        </div>
      ) : null}
      <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
        <div>
          <dt className="font-semibold text-slate-500">Why</dt>
          <dd className="text-slate-600">{metric.why}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">How to improve</dt>
          <dd className="text-slate-600">{metric.howToImprove}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Expected impact</dt>
          <dd className="text-slate-600">{metric.expectedImpact}</dd>
        </div>
      </dl>
    </GlassPanel>
  );
}

/* ─── Brain health diagnosis ─── */

export function BrainHealthDiagnosisPanel({ diagnosis }: { diagnosis: BrainHealthDiagnosis }) {
  const gradeColor =
    diagnosis.score >= 85
      ? "text-emerald-600"
      : diagnosis.score >= 70
        ? "text-indigo-600"
        : diagnosis.score >= 50
          ? "text-amber-600"
          : "text-red-600";

  return (
    <GlassPanel gradient="emerald">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Brain Health</p>
          <p className={cn("mt-1 text-3xl font-bold capitalize", gradeColor)}>
            {diagnosis.grade}
            <span className="ml-2 text-lg font-semibold text-slate-500">{diagnosis.score}%</span>
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-white/60 px-4 py-3">
          <p className="text-[10px] font-bold uppercase text-emerald-800">Recommended next action</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{diagnosis.recommendedAction}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{diagnosis.narrative}</p>
      <ul className="mt-4 space-y-2">
        {diagnosis.reasons.map((reason) => (
          <li key={reason} className="flex items-start gap-2 text-sm text-slate-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {reason}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/* ─── Predictive insights ─── */

export function PredictiveInsightsPanel({ insights }: { insights: PredictiveInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <GlassPanel gradient="violet">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-900">Predictive Intelligence</h3>
      </div>
      <ul className="mt-4 space-y-3">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="rounded-xl border border-violet-100 bg-white/60 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{insight.title}</p>
              <span className="shrink-0 text-[10px] font-semibold uppercase text-violet-600">
                {insight.timeframe}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{insight.description}</p>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/* ─── Heatmap ─── */

export function HeatmapGrid({
  title,
  cells,
  invert = false,
}: {
  title: string;
  cells: HeatmapCell[];
  invert?: boolean;
}) {
  if (cells.length === 0) return null;

  return (
    <GlassPanel>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {cells.map((cell) => {
          const v = invert ? 100 - cell.value : cell.value;
          const intensity = Math.min(100, Math.max(0, v));
          const bg =
            intensity >= 80
              ? "bg-emerald-500/90"
              : intensity >= 60
                ? "bg-indigo-400/80"
                : intensity >= 40
                  ? "bg-amber-400/80"
                  : "bg-red-400/80";

          return (
            <div
              key={cell.id}
              className={cn("rounded-lg px-2 py-2 text-white transition-transform hover:scale-[1.02]", bg)}
              title={`${cell.label}: ${cell.value}%`}
            >
              <p className="truncate text-[10px] font-medium opacity-90">{cell.label}</p>
              <p className="text-sm font-bold tabular-nums">{cell.value}%</p>
            </div>
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
}: {
  trends: IntelligenceTrendPoint[];
  dataKey?: keyof IntelligenceTrendPoint;
  label?: string;
  color?: string;
}) {
  if (trends.length === 0) return null;

  return (
    <GlassPanel>
      <p className="text-sm font-semibold text-slate-900">{label} — 7 day trend</p>
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(5)}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v) => [`${v}%`, label]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassPanel>
  );
}

/* ─── Module intelligence strip ─── */

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
    <GlassPanel gradient="indigo">
      <div className="flex flex-wrap items-start gap-6">
        <div className="relative">
          <MasteryRing percent={mastery} size={72} />
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-indigo-700">
            {mastery}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{moduleName}</p>
          <p className="mt-1 text-sm text-slate-600">{narrative}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Coverage" value={`${coverage}%`} />
            <MiniStat label="Confidence" value={`${confidence}%`} />
            <MiniStat label="Quality" value={`${quality}%`} />
            <MiniStat label="Remaining" value={`${remainingLessons} lessons`} />
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
    <div className={cn("rounded-lg bg-white/60 px-3 py-2", wide && "col-span-2")}>
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function MasteryRing({ percent, size = 64 }: { percent: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={stroke}
      />
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
        className="transition-all duration-700"
      />
      <defs>
        <linearGradient id="masteryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

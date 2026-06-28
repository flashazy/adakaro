"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import {
  SaKpiCard,
  saSection,
  saSectionSubtitle,
  saSectionTitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { QUALITY_TIER_STYLES } from "@/lib/ai-training/knowledge-quality-rules";
import type { KnowledgeQualityReport, QualityPipelineMetrics } from "@/lib/ai-training/knowledge-quality-report";
import {
  ConfidenceDisplay,
  ExplainableQualitySummary,
  QualityBreakdownBars,
} from "@/components/super-admin/ai-training/lesson-review-shared";
import { cn } from "@/lib/utils";

interface KnowledgeQualityPanelProps {
  metrics?: QualityPipelineMetrics | null;
  qualityTrend?: number;
  compact?: boolean;
  title?: string;
}

export function KnowledgeQualityPanel({
  metrics: externalMetrics,
  qualityTrend: externalTrend,
  compact,
  title = "Knowledge Quality",
}: KnowledgeQualityPanelProps) {
  const [metrics, setMetrics] = useState<QualityPipelineMetrics | null>(
    externalMetrics ?? null
  );
  const [qualityTrend, setQualityTrend] = useState(externalTrend ?? 0);
  const [loading, setLoading] = useState(!externalMetrics);

  useEffect(() => {
    if (externalMetrics) {
      setMetrics(externalMetrics);
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/super-admin/ai-training/quality-metrics");
        if (!res.ok) return;
        const data = (await res.json()) as {
          metrics?: QualityPipelineMetrics;
          qualityTrend?: number;
        };
        setMetrics(data.metrics ?? null);
        setQualityTrend(data.qualityTrend ?? 0);
      } finally {
        setLoading(false);
      }
    })();
  }, [externalMetrics]);

  if (loading) {
    return (
      <div className={cn(saSection, "flex items-center justify-center py-10 text-slate-500")}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading quality metrics…
      </div>
    );
  }

  if (!metrics) return null;

  const tier =
    metrics.averageQualityScore >= 95
      ? QUALITY_TIER_STYLES.excellent
      : metrics.averageQualityScore >= 90
        ? QUALITY_TIER_STYLES.ready
        : metrics.averageQualityScore >= 80
          ? QUALITY_TIER_STYLES.needs_improvement
          : metrics.averageQualityScore >= 65
            ? QUALITY_TIER_STYLES.human_review
            : QUALITY_TIER_STYLES.reject;

  return (
    <div className={cn(saSection, "border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className={saSectionTitle}>{title}</h3>
          <p className={saSectionSubtitle}>
            Automatic quality evaluation before lessons reach the Approval Queue.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold uppercase ring-1 ring-inset",
            tier.className
          )}
        >
          {tier.label}
        </span>
      </div>

      <div className={cn("mt-4 grid gap-4", compact ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-5")}>
        <SaKpiCard label="Highest Score" value={String(metrics.highestScore)} />
        <SaKpiCard label="Lowest Score" value={String(metrics.lowestScore)} />
        <SaKpiCard label="Average Score" value={String(metrics.averageQualityScore)} />
        <SaKpiCard label="Average Grade" value={metrics.averageGrade} />
        <SaKpiCard label="Avg Confidence" value={`${metrics.averageConfidence}%`} />
        <SaKpiCard label="Lessons Auto Improved" value={String(metrics.lessonsAutoImproved)} />
        <SaKpiCard label="Auto Improvements Applied" value={String(metrics.lessonsAutoImproved)} />
        <SaKpiCard label="Avg Improvement Gain" value={`+${metrics.averageImprovementGain}`} />
        <SaKpiCard label="Lessons Auto Rejected" value={String(metrics.lessonsAutoRejected)} />
        <SaKpiCard label="Duplicate Rate" value={`${metrics.duplicateRate}%`} />
        <SaKpiCard label="Duplicate False Positives" value={String(metrics.duplicateFalsePositives)} />
        {!compact ? (
          <>
            <SaKpiCard label="Avg Question Quality" value={String(metrics.averageByCategory.questionQuality)} />
            <SaKpiCard label="Avg Coverage" value={String(metrics.averageByCategory.curriculumCoverage)} />
            <SaKpiCard label="Avg Answer Quality" value={String(metrics.averageAnswerQuality)} />
            <SaKpiCard label="Avg Retrieval Score" value={String(metrics.averageRetrievalScore)} />
            <SaKpiCard label="Avg Readability" value={String(metrics.averageReadability)} />
            <SaKpiCard label="Queue Ready" value={String(metrics.readyCount)} />
            <SaKpiCard label="Needs Improvement" value={String(metrics.needsImprovementCount)} />
            <SaKpiCard label="Rejected" value={String(metrics.rejectedCount)} />
          </>
        ) : null}
      </div>

      {metrics.mostCommonFailureReason ? (
        <p className="mt-3 text-sm text-slate-600">
          Most common failure reason:{" "}
          <span className="font-semibold text-slate-800">{metrics.mostCommonFailureReason}</span>
        </p>
      ) : null}

      {metrics.topWeakModules.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm font-semibold text-amber-900">Top weak modules</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {metrics.topWeakModules.map((m) => (
              <li key={m.moduleId}>
                {m.moduleId}: {m.count} blocked draft{m.count === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <TrendingUp className="h-4 w-4 text-indigo-500" />
        Quality trend (recent batch):{" "}
        <span
          className={cn(
            "font-semibold",
            qualityTrend >= 0 ? "text-emerald-700" : "text-red-700"
          )}
        >
          {qualityTrend >= 0 ? "+" : ""}
          {qualityTrend}
        </span>
      </div>
    </div>
  );
}

export function QualityReportCard({
  report,
  className,
  showCalibration,
  compact,
}: {
  report: KnowledgeQualityReport;
  className?: string;
  showCalibration?: boolean;
  compact?: boolean;
}) {
  const tier = QUALITY_TIER_STYLES[report.visualTier];
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Quality Report</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset", tier.className)}>
          {report.grade} · {tier.label}
        </span>
      </div>

      <ConfidenceDisplay
        quality={report.overallQuality}
        confidence={report.reviewerConfidence}
        reasons={report.confidenceReasons}
        className="mt-3 border-0 bg-slate-50 p-3"
      />

      {!compact ? (
        <>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Score Breakdown</p>
            <QualityBreakdownBars breakdown={report.breakdown} />
          </div>
          <ExplainableQualitySummary
            overallQuality={report.overallQuality}
            explanation={report.scoreExplanation}
            className="mt-4"
          />
        </>
      ) : (
        <QualityBreakdownBars breakdown={report.breakdown} compact className="mt-3" />
      )}

      {report.duplicateFalsePositive ? (
        <p className="mt-2 text-[10px] text-amber-700">Similar phrasing but different intent — not treated as duplicate.</p>
      ) : null}
      {showCalibration && report.calibrationAdjustments?.length ? (
        <div className="mt-3 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-2 text-[10px] text-indigo-900">
          {report.calibrationAdjustments.map((adj) => (
            <p key={adj.rule}>
              {adj.rule}: {adj.originalScore} → {adj.adjustedScore} — {adj.reason}
            </p>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[10px] uppercase text-slate-400">
        {report.attempts} improvement attempt{report.attempts === 1 ? "" : "s"} · {report.status.replace(/_/g, " ")}
      </p>
    </div>
  );
}

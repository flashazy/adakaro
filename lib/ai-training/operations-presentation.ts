/**
 * Operations presentation layer — derives feed, briefs, predictions, and
 * explainable copy from existing intelligence snapshots. No API/schema changes.
 */

import { triggerLabel } from "./knowledge-autonomous-suggestions";
import type {
  KnowledgeIntelligenceSnapshot,
  KnowledgeMission,
  KnowledgeMemoryItem,
  ModuleHealthRow,
} from "./knowledge-intelligence-types";
import type { LearningEventRow } from "./learning-types";

/* ─── Feed ─── */

export type FeedSeverity = "info" | "success" | "warning" | "critical";
export type FeedCategory =
  | "discovery"
  | "graph"
  | "confidence"
  | "review"
  | "mission"
  | "coverage"
  | "memory"
  | "maintenance"
  | "recommendation";

export interface IntelligenceFeedEvent {
  id: string;
  timestamp: string;
  icon: string;
  severity: FeedSeverity;
  category: FeedCategory;
  summary: string;
  detail?: string;
}

export function buildIntelligenceFeed(
  snapshot: KnowledgeIntelligenceSnapshot
): IntelligenceFeedEvent[] {
  const events: IntelligenceFeedEvent[] = [];
  const now = snapshot.generatedAt;

  for (const s of snapshot.autonomousSuggestions.slice(0, 6)) {
    events.push({
      id: `auto-${s.id}`,
      timestamp: now,
      icon: "sparkles",
      severity: s.priority === "critical" ? "critical" : s.priority === "high" ? "warning" : "info",
      category: "recommendation",
      summary: s.title,
      detail: `${triggerLabel(s.trigger)} — ${s.suggestedAction}`,
    });
  }

  for (const q of snapshot.topUnansweredQuestions.slice(0, 4)) {
    events.push({
      id: `unanswered-${hash(q.question)}`,
      timestamp: now,
      icon: "help",
      severity: q.occurrences >= 5 ? "warning" : "info",
      category: "discovery",
      summary: "New unanswered question pattern detected",
      detail: `${q.question} (${q.occurrences}× from ${q.source})`,
    });
  }

  if (snapshot.graphSummary.edgeCount > 0) {
    events.push({
      id: "graph-expanded",
      timestamp: now,
      icon: "git-branch",
      severity: "success",
      category: "graph",
      summary: "Knowledge graph expanded",
      detail: `${snapshot.graphSummary.nodeCount} nodes · ${snapshot.graphSummary.edgeCount} connections`,
    });
  }

  const confDelta = trendDelta(snapshot.trends, "confidence");
  if (confDelta !== 0) {
    events.push({
      id: "confidence-trend",
      timestamp: now,
      icon: confDelta > 0 ? "trending-up" : "trending-down",
      severity: confDelta > 0 ? "success" : "warning",
      category: "confidence",
      summary: confDelta > 0 ? "Confidence improved" : "Confidence declined",
      detail: `${confDelta > 0 ? "+" : ""}${confDelta}% over the last 7 days`,
    });
  }

  const { learningSignals: ls } = snapshot;
  if (ls.approvals > 0) {
    events.push({
      id: "review-approved",
      timestamp: now,
      icon: "check",
      severity: "success",
      category: "review",
      summary: "Reviewer approved lessons",
      detail: `${ls.approvals} lessons approved in the last 30 days`,
    });
  }

  if (ls.regenerations > 0) {
    events.push({
      id: "regenerated",
      timestamp: now,
      icon: "refresh",
      severity: "info",
      category: "review",
      summary: "Lessons regenerated for quality",
      detail: `${ls.regenerations} regeneration cycles`,
    });
  }

  const covDelta = trendDelta(snapshot.trends, "coverage");
  if (covDelta > 0) {
    events.push({
      id: "coverage-up",
      timestamp: now,
      icon: "target",
      severity: "success",
      category: "coverage",
      summary: "Coverage increased",
      detail: `+${covDelta}% curriculum coverage this week`,
    });
  }

  events.push({
    id: "memory-sync",
    timestamp: now,
    icon: "brain",
    severity: "info",
    category: "memory",
    summary: "Memory synchronized",
    detail: "Organizational memory aligned with active knowledge base",
  });

  for (const r of snapshot.recommendations.slice(0, 4)) {
    if (r.kind === "duplicate_overlap") {
      events.push({
        id: r.id,
        timestamp: now,
        icon: "copy",
        severity: "warning",
        category: "maintenance",
        summary: "Duplicate risk identified",
        detail: r.title,
      });
    }
  }

  for (const m of snapshot.missions.filter((x) => x.progress >= 95).slice(0, 2)) {
    events.push({
      id: `mission-near-${m.id}`,
      timestamp: now,
      icon: "rocket",
      severity: "success",
      category: "mission",
      summary: "Mission nearing completion",
      detail: `${m.title} — ${m.progress}% complete`,
    });
  }

  return events.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
}

/* ─── Brain Header ─── */

export interface BrainHeaderData {
  status: "healthy" | "attention" | "critical";
  statusLabel: string;
  currentMission: string;
  currentFocus: string;
  brainActivity: "Low" | "Moderate" | "High" | "Excellent";
  learningRate: "Slow" | "Steady" | "Good" | "Excellent";
  confidenceTrend: string;
  knowledgeGrowthToday: number;
  lessonsGeneratedToday: number;
  lessonsApprovedToday: number;
  knowledgeVersion: string;
  estimatedMastery: number;
}

export function buildBrainHeader(snapshot: KnowledgeIntelligenceSnapshot): BrainHeaderData {
  const { health, learningSignals: ls, missions, trends } = snapshot;
  const today = trends.at(-1);
  const yesterday = trends.at(-2);
  const topMission = missions[0];

  const activityScore =
    ls.questionsAsked + ls.approvals + ls.reviewerEdits + snapshot.recommendations.length;
  const brainActivity: BrainHeaderData["brainActivity"] =
    activityScore > 80 ? "Excellent" : activityScore > 40 ? "High" : activityScore > 15 ? "Moderate" : "Low";

  const learningScore = ls.approvals + ls.successfulAnswers;
  const learningRate: BrainHeaderData["learningRate"] =
    learningScore > 100 ? "Excellent" : learningScore > 40 ? "Good" : learningScore > 10 ? "Steady" : "Slow";

  const confDelta = today && yesterday ? today.confidence - yesterday.confidence : 0;
  const status: BrainHeaderData["status"] =
    health.overallHealth >= 80 ? "healthy" : health.overallHealth >= 60 ? "attention" : "critical";

  const weakest = snapshot.weakestModules[0];
  const focusModule = topMission?.moduleName ?? weakest?.moduleName ?? "Curriculum expansion";

  return {
    status,
    statusLabel: status === "healthy" ? "Healthy" : status === "attention" ? "Needs Attention" : "Critical",
    currentMission: topMission?.title ?? "Maintain knowledge excellence",
    currentFocus: topMission ? `Building ${focusModule}` : `Strengthening ${weakest?.moduleName ?? "core modules"}`,
    brainActivity,
    learningRate,
    confidenceTrend: confDelta >= 0 ? `+${confDelta}%` : `${confDelta}%`,
    knowledgeGrowthToday: today?.lessonsCreated ?? 0,
    lessonsGeneratedToday: today?.lessonsCreated ?? 0,
    lessonsApprovedToday: Math.round(ls.approvals / 30),
    knowledgeVersion: formatKnowledgeVersion(snapshot.scorecard.composite),
    estimatedMastery: Math.round(
      health.coverage * 0.4 + health.confidence * 0.35 + health.retrievability * 0.25
    ),
  };
}

/* ─── Morning Brief ─── */

export interface MorningBrief {
  headline: string;
  generated: number;
  approved: number;
  rejected: number;
  confidenceDelta: string;
  coverageDelta: string;
  mostRequested: string;
  weakestModule: string;
  recommendation: string;
  story: string;
}

export function buildMorningBrief(snapshot: KnowledgeIntelligenceSnapshot): MorningBrief {
  const { learningSignals: ls, trends, missions } = snapshot;
  const confDelta = trendDelta(trends, "confidence");
  const covDelta = trendDelta(trends, "coverage");
  const generated = trends.reduce((s, t) => s + t.lessonsCreated, 0);
  const topTopic =
    ls.risingTopics[0]?.topic ??
    snapshot.topUnansweredQuestions[0]?.question ??
    "General platform questions";
  const weakest = snapshot.weakestModules[0]?.moduleName ?? "—";
  const topMission = missions[0];

  return {
    headline: "Today's Intelligence Report",
    generated,
    approved: ls.approvals,
    rejected: ls.rejections,
    confidenceDelta: confDelta >= 0 ? `+${confDelta}%` : `${confDelta}%`,
    coverageDelta: covDelta >= 0 ? `+${covDelta}%` : `${covDelta}%`,
    mostRequested: topTopic,
    weakestModule: weakest,
    recommendation: topMission
      ? `${topMission.title} — ${topMission.lessonsRemaining} lessons remaining`
      : "Review autonomous suggestions and close coverage gaps",
    story: `Yesterday the system processed ${ls.questionsAsked} questions with ${ls.successfulAnswers} successful answers. ${
      confDelta >= 0 ? "Confidence is trending upward." : "Confidence needs attention."
    } ${weakest !== "—" ? `${weakest} remains the priority module.` : ""}`,
  };
}

/* ─── Welcome ─── */

export function buildWelcomeMessage(
  snapshot: KnowledgeIntelligenceSnapshot,
  userName = "there"
): string {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const { learningSignals: ls } = snapshot;
  const confDelta = trendDelta(snapshot.trends, "confidence");
  const mission = snapshot.missions[0];

  const lines = [
    `${greeting}, ${userName}.`,
    `Your AI answered ${ls.questionsAsked.toLocaleString()} questions.`,
    `Learned ${ls.approvals + ls.successfulAnswers} new concepts through review and usage.`,
    confDelta >= 0
      ? `Confidence increased by ${confDelta}%.`
      : `Confidence decreased by ${Math.abs(confDelta)}% — review recommended.`,
    mission
      ? `${mission.moduleName ?? mission.title} should be your next mission.`
      : "All critical missions are on track.",
  ];

  return lines.join("\n");
}

/* ─── Explainable metrics ─── */

export interface ExplainableMetric {
  value: number;
  label: string;
  explanation: string;
  why: string;
  howToImprove: string;
  expectedImpact: string;
  strongest?: string;
  weakest?: string;
  estimatedCompletion?: string;
}

export function buildExplainableCoverage(
  snapshot: KnowledgeIntelligenceSnapshot
): ExplainableMetric {
  const { health, strongestModules, weakestModules, moduleHealth } = snapshot;
  const remaining = moduleHealth.reduce(
    (s, m) => s + (m.remainingLessons ?? Math.max(0, m.targetCount - m.lessonCount)),
    0
  );
  const hours = Math.round((remaining * 0.8) / 60);

  return {
    value: health.coverage,
    label: "Coverage",
    explanation: `I currently understand approximately ${health.coverage}% of my planned curriculum.`,
    why: "Coverage measures active lessons against curriculum targets across all modules.",
    howToImprove: `Complete ${remaining} remaining lessons across ${weakestModules.length} weak modules.`,
    expectedImpact: `Reaching 90% coverage typically improves answer rate by 15–25%.`,
    strongest: strongestModules[0]?.moduleName,
    weakest: weakestModules[0]?.moduleName,
    estimatedCompletion: hours > 0 ? `${hours} hours` : "On track",
  };
}

export function buildExplainableConfidence(
  snapshot: KnowledgeIntelligenceSnapshot
): ExplainableMetric {
  const { health, learningSignals: ls } = snapshot;
  const lowRate =
    ls.questionsAsked > 0
      ? Math.round((ls.lowConfidenceRetrievals / ls.questionsAsked) * 100)
      : 0;

  return {
    value: health.confidence,
    label: "AI Confidence",
    explanation: `My retrieval confidence is approximately ${health.confidence}% based on recent answer success.`,
    why: `${ls.lowConfidenceRetrievals} low-confidence retrievals in the last 30 days (${lowRate}% of questions).`,
    howToImprove: "Improve low-confidence lessons and expand keywords for weak modules.",
    expectedImpact: "Each 5% confidence gain reduces fallback answers significantly.",
  };
}

/* ─── Brain Health Diagnosis ─── */

export interface BrainHealthDiagnosis {
  grade: string;
  score: number;
  reasons: string[];
  recommendedAction: string;
  narrative: string;
}

export function buildBrainHealthDiagnosis(
  snapshot: KnowledgeIntelligenceSnapshot
): BrainHealthDiagnosis {
  const { health, missions } = snapshot;
  const reasons: string[] = [];

  if (health.freshness >= 75) reasons.push("Knowledge freshness is excellent.");
  else if (health.freshness >= 50) reasons.push("Some lessons may need refreshing.");
  else reasons.push("Knowledge freshness is declining — review outdated content.");

  if (health.coverage >= 80) reasons.push("Curriculum coverage is strong.");
  else reasons.push("Coverage is still incomplete across several modules.");

  if (health.duplicateRisk <= 15) reasons.push("Duplicate risk is very low.");
  else reasons.push(`Duplicate risk at ${health.duplicateRisk}% — consolidation recommended.`);

  reasons.push("Memory integrity is healthy.");

  const topMission = missions[0];
  const action = topMission
    ? `Complete ${topMission.title}.`
    : "Review autonomous suggestions and strengthen weakest modules.";

  return {
    grade: health.grade,
    score: health.overallHealth,
    reasons,
    recommendedAction: action,
    narrative: `Brain health is ${health.grade} at ${health.overallHealth}%. ${reasons[0]} ${reasons[1]} Next: ${action}`,
  };
}

/* ─── Predictive Intelligence ─── */

export interface PredictiveInsight {
  id: string;
  severity: FeedSeverity;
  title: string;
  description: string;
  timeframe: string;
}

export function buildPredictiveIntelligence(
  snapshot: KnowledgeIntelligenceSnapshot
): PredictiveInsight[] {
  const insights: PredictiveInsight[] = [];
  const { moduleHealth, missions, trends, learningSignals: ls } = snapshot;

  const declining = [...moduleHealth]
    .filter((m) => m.coverage < 50 && m.lessonCount < m.targetCount * 0.3)
    .sort((a, b) => a.health - b.health);

  for (const mod of declining.slice(0, 2)) {
    const days = Math.max(3, Math.round((mod.targetCount - mod.lessonCount) / 4));
    insights.push({
      id: `pred-weak-${mod.moduleId}`,
      severity: mod.health < 50 ? "warning" : "info",
      title: `${mod.moduleName} will become a critical gap`,
      description: `At current pace, coverage stays below 50% without new lessons.`,
      timeframe: `~${days} days`,
    });
  }

  const confTrend = trendDelta(trends, "confidence");
  if (confTrend < 0) {
    insights.push({
      id: "pred-confidence",
      severity: "warning",
      title: "Confidence may continue declining",
      description: "Low-confidence retrievals are rising without new lesson approvals.",
      timeframe: "7–14 days",
    });
  }

  const nearComplete = moduleHealth.filter(
    (m) => m.coverage >= 85 && m.lessonCount < m.targetCount
  );
  for (const mod of nearComplete.slice(0, 2)) {
    insights.push({
      id: `pred-complete-${mod.moduleId}`,
      severity: "success",
      title: `${mod.moduleName} curriculum nearing completion`,
      description: `${mod.targetCount - mod.lessonCount} lessons remain to reach full coverage.`,
      timeframe: "This week",
    });
  }

  const tomorrowWorkload = Math.round(ls.approvals / 30 + (missions[0]?.lessonsRemaining ?? 0) / 7);
  if (tomorrowWorkload > 5) {
    insights.push({
      id: "pred-reviewer",
      severity: "info",
      title: "Reviewer workload expected tomorrow",
      description: `Approximately ${Math.min(tomorrowWorkload, 50)} lessons may need review based on generation pace.`,
      timeframe: "Tomorrow",
    });
  }

  return insights;
}

/* ─── Signal Insights ─── */

export interface SignalInsights {
  mostLearnedTopic: string;
  mostImprovedModule: string;
  mostRequestedQuestion: string;
  fastestGrowingModule: string;
  highestConfidenceIncrease: string;
  highestDuplicateRate: string;
  narrative: string;
}

export function buildSignalInsights(snapshot: KnowledgeIntelligenceSnapshot): SignalInsights {
  const { learningSignals: ls, moduleHealth, trends } = snapshot;
  const fastest = [...moduleHealth].sort((a, b) => b.coverage - a.coverage)[0];
  const dupHighest = [...moduleHealth].sort((a, b) => b.duplicateRisk - a.duplicateRisk)[0];
  const confDelta = trendDelta(trends, "confidence");

  return {
    mostLearnedTopic: ls.risingTopics[0]?.topic ?? "—",
    mostImprovedModule: fastest?.moduleName ?? "—",
    mostRequestedQuestion: ls.topRepeatedQuestions[0]?.question ?? "—",
    fastestGrowingModule: fastest?.moduleName ?? "—",
    highestConfidenceIncrease: confDelta > 0 ? `+${confDelta}% this week` : "Stable",
    highestDuplicateRate: dupHighest ? `${dupHighest.moduleName} (${dupHighest.duplicateRisk}%)` : "—",
    narrative: `Users asked ${ls.questionsAsked} questions. ${ls.successfulAnswers} were answered confidently. Reviewers approved ${ls.approvals} lessons.`,
  };
}

/* ─── Mission Intelligence ─── */

export interface MissionIntelligence {
  businessImpact: string;
  learningGain: string;
  coverageImprovement: string;
  confidenceImprovement: string;
  scoreGain: string;
  dependencies: string[];
  recommendedNext: string;
  completionPrediction: string;
  narrative: string;
}

export function buildMissionIntelligence(
  mission: KnowledgeMission,
  snapshot: KnowledgeIntelligenceSnapshot
): MissionIntelligence {
  const next = snapshot.missions.find((m) => m.id !== mission.id);
  const mod = snapshot.moduleHealth.find((m) => m.moduleId === mission.moduleId);

  return {
    businessImpact:
      mission.priority === "critical"
        ? "High — blocks accurate answers for core user workflows"
        : mission.priority === "high"
          ? "Medium-high — improves answer quality for frequent topics"
          : "Moderate — strengthens long-tail knowledge",
    learningGain: `~${mission.lessonsRemaining} new retrievable concepts`,
    coverageImprovement: mission.coverageGain
      ? `+${mission.coverageGain}% module coverage`
      : mod
        ? `+${Math.round((mission.lessonsRemaining / Math.max(1, mod.targetCount)) * 100)}% toward target`
        : "Varies by module",
    confidenceImprovement: mission.targetConfidence
      ? `${mission.currentConfidence}% → ${mission.targetConfidence}%`
      : "+3–8% estimated",
    scoreGain: `+${Math.round(mission.lessonsRemaining * 0.15)} composite points`,
    dependencies: mod && mod.health < 60 ? [`Recover ${mod.moduleName} health first`] : [],
    recommendedNext: next?.title ?? "Maintain published knowledge quality",
    completionPrediction: formatMissionEta(mission.estimatedMinutes),
    narrative: `${mission.title} addresses ${mission.description}. Expected quality: ${mission.expectedQuality ?? 92}%.`,
  };
}

/* ─── Heatmaps ─── */

export interface HeatmapCell {
  id: string;
  label: string;
  value: number;
  moduleId?: string;
  coverage?: number;
  confidence?: number;
  missingLessons?: number;
  estimatedCompletion?: string;
  recommendedAction?: string;
}

export type PageInsightContext =
  | "overview"
  | "health"
  | "curriculum"
  | "signals"
  | "missions"
  | "intelligence"
  | "graph"
  | "memory";

export function buildPageInsight(
  context: PageInsightContext,
  snapshot: KnowledgeIntelligenceSnapshot,
  extra?: { curriculumPercent?: number; strongestModule?: string }
): string {
  const { health, learningSignals: ls, missions, scorecard, moduleHealth } = snapshot;
  const weakest = snapshot.weakestModules[0]?.moduleName ?? "several modules";
  const strongest =
    extra?.strongestModule ?? snapshot.strongestModules[0]?.moduleName ?? "core modules";
  const topMission = missions[0];
  const confDelta = trendDelta(snapshot.trends, "confidence");
  const covPct = extra?.curriculumPercent ?? health.coverage;
  const repeated = ls.topRepeatedQuestions.length;

  switch (context) {
    case "overview": {
      const gain = topMission?.coverageGain ?? 4;
      return `Yesterday I answered ${ls.successfulAnswers} questions successfully. ${weakest} remains my weakest area. ${
        topMission
          ? `Completing ${topMission.title} should improve confidence by approximately ${gain}%.`
          : "My knowledge base is stable — I recommend monitoring rising question patterns."
      }`;
    }
    case "health":
      return `My memory remains ${health.freshness >= 70 ? "healthy" : "acceptable"}. I currently understand approximately ${health.coverage}% of my planned curriculum, with ${health.duplicateRisk <= 15 ? "low" : "elevated"} duplicate risk across ${weakest}.`;
    case "curriculum":
      return `I have mastered approximately ${covPct}% of my planned curriculum. ${strongest} is progressing well while ${weakest} requires more lessons to reach operational readiness.`;
    case "signals":
      return repeated > 0
        ? `I detected ${repeated} recurring unanswered question patterns and ${ls.risingTopics.length} rising topics that may need new lessons.`
        : "I am monitoring learning signals steadily. No critical recurring gaps detected in the last period.";
    case "missions":
      return topMission
        ? `My highest priority today is ${topMission.title} — ${topMission.lessonsRemaining} lessons remain with an estimated ${topMission.estimatedMinutes} minutes to complete.`
        : "All strategic missions are complete. I recommend maintaining quality across published knowledge.";
    case "intelligence": {
      const radar = [
        { name: "retrieval accuracy", value: scorecard.retrievalReadiness },
        { name: "knowledge quality", value: scorecard.knowledgeQuality },
        { name: "AI reliability", value: scorecard.aiReliability },
        { name: "learning value", value: scorecard.learningValue },
      ].sort((a, b) => b.value - a.value);
      const strongestAxis = radar[0];
      const weakestAxis = radar[radar.length - 1];
      return `My strongest capability is ${strongestAxis.name} at ${strongestAxis.value}%. ${weakestAxis.name} at ${weakestAxis.value}% still benefits from additional reviewer feedback.`;
    }
    case "graph":
      return `My knowledge graph contains ${snapshot.graphSummary.nodeCount} connected concepts across ${snapshot.graphSummary.edgeCount} relationships. ${
        snapshot.graphSummary.orphanCount > 0
          ? `${snapshot.graphSummary.orphanCount} lessons remain isolated and may need linking.`
          : "Connectivity is strong across curriculum paths."
      }`;
    case "memory":
      return "My organizational memory preserves terminology, brand language, and reviewer preferences so I never relearn the same institutional knowledge twice.";
    default:
      return confDelta >= 0
        ? `My confidence improved by ${confDelta}% this week.`
        : `My confidence declined slightly after several low-confidence retrievals.`;
  }
}

export function emptyStateMessage(
  kind: "coverage" | "lessons" | "missions" | "signals" | "graph" | "memory" | "feed",
  value?: number
): string {
  switch (kind) {
    case "coverage":
      return value && value > 0
        ? `I currently understand approximately ${value}% of my planned curriculum.`
        : "I am beginning my learning journey. Start your first mission to build institutional knowledge.";
    case "lessons":
      return value && value > 0
        ? `${value} lessons are active in my knowledge base.`
        : "No lessons have been generated yet. Start your first mission to begin building institutional knowledge.";
    case "missions":
      return "All strategic missions are complete. I am operating at full curriculum readiness.";
    case "signals":
      return "I have not captured enough interactions yet. As users ask questions, I will surface learning patterns here.";
    case "graph":
      return "My neural map will grow as you publish and connect lessons across the curriculum.";
    case "memory":
      return "My long-term memory is forming. Reviewer decisions and organizational patterns will be stored here.";
    case "feed":
      return "No operational events yet. I will report discoveries, approvals, and coverage changes in real time.";
    default:
      return "Awaiting data to form intelligence.";
  }
}

export function buildModuleHeatmaps(snapshot: KnowledgeIntelligenceSnapshot): {
  coverage: HeatmapCell[];
  confidence: HeatmapCell[];
  usage: HeatmapCell[];
  quality: HeatmapCell[];
  duplicate: HeatmapCell[];
} {
  const { moduleHealth, scorecard } = snapshot;

  return {
    coverage: moduleHealth.map((m) => ({
      id: m.moduleId,
      label: m.moduleName,
      value: m.coverage,
      moduleId: m.moduleId,
      ...heatmapDiagnostics(m),
    })),
    confidence: moduleHealth.map((m) => ({
      id: m.moduleId,
      label: m.moduleName,
      value: Math.max(0, m.health - m.duplicateRisk * 0.2),
      moduleId: m.moduleId,
      ...heatmapDiagnostics(m),
    })),
    usage: moduleHealth.map((m) => ({
      id: m.moduleId,
      label: m.moduleName,
      value: Math.min(100, Math.round((m.lessonCount / Math.max(1, m.targetCount)) * 100)),
      moduleId: m.moduleId,
      ...heatmapDiagnostics(m),
    })),
    quality: moduleHealth.map((m) => ({
      id: m.moduleId,
      label: m.moduleName,
      value: Math.max(0, 100 - m.weakCount * 3),
      moduleId: m.moduleId,
      ...heatmapDiagnostics(m),
    })),
    duplicate: moduleHealth.map((m) => ({
      id: m.moduleId,
      label: m.moduleName,
      value: m.duplicateRisk,
      moduleId: m.moduleId,
      ...heatmapDiagnostics(m),
    })),
  };
}

function heatmapDiagnostics(m: ModuleHealthRow) {
  const remaining = m.remainingLessons ?? Math.max(0, m.targetCount - m.lessonCount);
  return {
    coverage: m.coverage,
    confidence: m.health,
    missingLessons: remaining,
    estimatedCompletion: formatMissionEta(Math.round(remaining * 0.8)),
    recommendedAction:
      remaining > 0
        ? `Generate ${Math.min(remaining, 20)} lessons for ${m.moduleName}`
        : m.weakCount > 0
          ? `Review ${m.weakCount} weak lessons`
          : "Maintain current quality",
  };
}

/* ─── Memory groups ─── */

export const MEMORY_GROUP_LABELS: Record<string, string> = {
  brand_language: "Brand Memory",
  writing_style: "Writing Style",
  terminology: "Terminology",
  feature_naming: "Product Facts",
  reviewer_preference: "Reviewer Preferences",
  wording: "Preferred Vocabulary",
  faq_pattern: "Historical Decisions",
};

export function groupMemoryItems(items: KnowledgeMemoryItem[]): Array<{
  group: string;
  items: KnowledgeMemoryItem[];
}> {
  const groups = new Map<string, KnowledgeMemoryItem[]>();

  for (const item of items) {
    const label = MEMORY_GROUP_LABELS[item.category] ?? item.category.replace(/_/g, " ");
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }

  const order = [
    "Brand Memory",
    "Writing Style",
    "Terminology",
    "Preferred Vocabulary",
    "Reviewer Preferences",
    "Product Facts",
    "Historical Decisions",
  ];

  return order
    .filter((g) => groups.has(g))
    .map((group) => ({ group, items: groups.get(group)! }))
    .concat(
      [...groups.entries()]
        .filter(([g]) => !order.includes(g))
        .map(([group, items]) => ({ group, items }))
    );
}

/* ─── Conversation Replay ─── */

export interface ConversationReplayStep {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "muted";
}

export function buildConversationReplay(event: LearningEventRow): ConversationReplayStep[] {
  const matched =
    event.top_candidate_entries[0]?.question ?? event.matched_entry_id ?? "No match";
  const confidence = event.final_score != null ? `${Math.round(event.final_score * 100)}%` : "—";

  const steps: ConversationReplayStep[] = [
    { label: "Question", value: event.original_question },
    { label: "Matched lesson", value: matched, tone: event.matched_entry_id ? "success" : "warning" },
    { label: "Confidence", value: `${event.confidence_level} (${confidence})`, tone: event.confidence_level === "high" ? "success" : event.confidence_level === "low" ? "warning" : "neutral" },
    { label: "Answer status", value: event.answer_status.replace(/_/g, " "), tone: event.answer_status === "answered" ? "success" : "warning" },
  ];

  if (event.reason_signals.length > 0) {
    steps.push({ label: "Signals", value: event.reason_signals.join(", "), tone: "muted" });
  }

  if (event.answer_status === "unanswered" || event.confidence_level === "low") {
    steps.push({
      label: "Learning created",
      value: "Queued for knowledge gap analysis",
      tone: "warning",
    });
    steps.push({
      label: "Recommended action",
      value: "Generate or improve matching lesson",
      tone: "neutral",
    });
  } else {
    steps.push({
      label: "Outcome",
      value: "Knowledge successfully applied",
      tone: "success",
    });
  }

  return steps;
}

/* ─── Module dashboard ─── */

export function buildModuleDashboardRow(
  mod: ModuleHealthRow,
  snapshot: KnowledgeIntelligenceSnapshot
) {
  const mission = snapshot.missions.find((m) => m.moduleId === mod.moduleId);
  const remaining = mod.remainingLessons ?? Math.max(0, mod.targetCount - mod.lessonCount);
  const mastery = mod.targetCount > 0 ? Math.round((mod.lessonCount / mod.targetCount) * 100) : 0;

  return {
    coverage: mod.coverage,
    confidence: mod.health,
    lessonCount: mod.lessonCount,
    targetCount: mod.targetCount,
    quality: Math.max(0, 100 - mod.weakCount * 4),
    duplicateRisk: mod.duplicateRisk,
    mastery,
    remainingLessons: remaining,
    estimatedCompletion: formatMissionEta(Math.round(remaining * 0.8)),
    upcomingMission: mission?.title,
    narrative: `${mod.moduleName} is ${mod.health >= 80 ? "healthy" : mod.health >= 60 ? "developing" : "needs attention"} at ${mod.coverage}% coverage.`,
  };
}

/* ─── Helpers ─── */

function trendDelta(
  trends: KnowledgeIntelligenceSnapshot["trends"],
  field: "confidence" | "coverage" | "health"
): number {
  if (trends.length < 2) return 0;
  const latest = trends[trends.length - 1][field];
  const prev = trends[trends.length - 2][field];
  return Math.round(latest - prev);
}

function severityWeight(s: FeedSeverity): number {
  switch (s) {
    case "critical":
      return 4;
    case "warning":
      return 3;
    case "success":
      return 2;
    default:
      return 1;
  }
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h).toString(36);
}

export function formatKnowledgeVersion(composite: number): string {
  const major = Math.floor(composite / 30);
  const minor = Math.floor((composite % 30) / 3);
  return `v${major}.${minor}`;
}

function formatMissionEta(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

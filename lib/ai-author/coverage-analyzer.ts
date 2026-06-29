/**
 * Coverage Analyzer — detailed topic coverage breakdown.
 */

import { gapsByCategory } from "./knowledge-gap-detector";
import type { CoverageAnalysis, CoverageTopicBreakdown, KnowledgeGapItem } from "./types";
import type { QuestionContext } from "./context-engine";

const TOPIC_GROUPS: Record<string, string[]> = {
  Audience: ["School owners", "Principals", "Teachers", "Finance officers", "Parents", "Students"],
  Features: [
    "Attendance tracking",
    "Finance management",
    "Report cards",
    "Parent portal",
    "Student enrollment",
    "Staff management",
    "AI assistant",
    "Analytics",
  ],
  Pricing: ["Free plan limits", "Paid tiers", "Billing cycle", "Upgrade path", "Payment methods"],
  Permissions: ["Admin access", "Teacher roles", "Parent access", "Staff permissions"],
  Schools: ["Primary schools", "Secondary schools", "School size"],
  Parents: ["Parent portal", "Parents"],
  Teachers: ["Teachers", "Staff management"],
  Students: ["Students", "Student enrollment"],
};

function computeGroupCoverage(
  groupName: string,
  topics: string[],
  gaps: KnowledgeGapItem[]
): CoverageTopicBreakdown {
  const relevant = gaps.filter((g) => topics.some((t) => g.topic.includes(t) || t.includes(g.topic)));
  const covered = relevant.filter((g) => g.covered).length;
  const total = relevant.length || topics.length;
  const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;
  const missing = relevant.filter((g) => !g.covered).map((g) => g.topic);

  if (relevant.length === 0) {
    const fallbackCovered = gaps.filter((g) => topics.some((t) => g.topic === t) && g.covered).length;
    const fallbackTotal = topics.length;
    return {
      topic: groupName,
      percentage: fallbackTotal > 0 ? Math.round((fallbackCovered / fallbackTotal) * 100) : 0,
      missing: topics.filter((t) => !gaps.some((g) => g.topic === t && g.covered)),
    };
  }

  return { topic: groupName, percentage, missing };
}

export function analyzeCoverage(input: {
  questionContext: QuestionContext;
  gaps: KnowledgeGapItem[];
  sectionPlan: string[];
  filledSections: string[];
}): CoverageAnalysis {
  const { gaps, sectionPlan, filledSections } = input;
  const byCategory = gapsByCategory(gaps);

  const byTopic: CoverageTopicBreakdown[] = [];

  for (const [groupName, topics] of Object.entries(TOPIC_GROUPS)) {
    const groupGaps = [...(byCategory.get(groupName) ?? []), ...gaps];
    byTopic.push(computeGroupCoverage(groupName, topics, groupGaps));
  }

  const uncoveredGaps = gaps.filter((g) => !g.covered);
  const overall =
    gaps.length > 0
      ? Math.round(((gaps.length - uncoveredGaps.length) / gaps.length) * 100)
      : Math.round((filledSections.length / Math.max(1, sectionPlan.length)) * 100);

  const missingSections = sectionPlan.filter((s) => !filledSections.includes(s));

  return {
    overall,
    byTopic: byTopic.sort((a, b) => a.percentage - b.percentage),
    missingSections,
  };
}

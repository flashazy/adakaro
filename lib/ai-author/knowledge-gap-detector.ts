/**
 * Knowledge Gap Detector — identifies missing knowledge for the authoring question.
 */

import { audienceTopicPatterns } from "./fact-explainer";
import type { QuestionContext } from "./context-engine";
import type { AuthorIntent, KnowledgeGapItem, ScoredFact } from "./types";

const CAPABILITY_GAPS = [
  "Attendance tracking",
  "Finance management",
  "Report cards",
  "Parent portal",
  "Student enrollment",
  "Staff management",
  "AI assistant",
  "Analytics",
];

const PROCESS_GAPS = [
  "Prerequisites",
  "Required permissions",
  "Step-by-step instructions",
  "Expected outcome",
  "Common errors",
];

const PRICING_GAPS = [
  "Free plan limits",
  "Paid tiers",
  "Billing cycle",
  "Upgrade path",
  "Payment methods",
];

const PRICING_PATTERNS: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "Free plan limits", pattern: /\bfree\b|\blimit\b|\bup to\b/i },
  { topic: "Paid tiers", pattern: /\bpaid\b|\btier\b|\bplan\b/i },
  { topic: "Billing cycle", pattern: /\bbilling\b|\bcycle\b|\bmonthly\b|\bannual\b/i },
  { topic: "Upgrade path", pattern: /\bupgrade\b|\bscale\b/i },
  { topic: "Payment methods", pattern: /\bpayment\b|\bcard\b|\bmobile money\b/i },
];

function capabilityPatterns(): Array<{ topic: string; pattern: RegExp }> {
  return CAPABILITY_GAPS.map((topic) => ({
    topic,
    pattern: new RegExp(topic.split(" ")[0]!, "i"),
  }));
}

export function detectKnowledgeGaps(input: {
  questionContext: QuestionContext;
  allFacts: ScoredFact[];
  sectionPlan: string[];
}): KnowledgeGapItem[] {
  const { questionContext, allFacts, sectionPlan } = input;
  const intent = questionContext.route.intent;
  const combinedText = allFacts.map((f) => f.text).join(" ");

  const gaps: KnowledgeGapItem[] = [];

  if (intent === "identity" && questionContext.route.expectedAnswerType === "audience") {
    for (const item of audienceTopicPatterns()) {
      gaps.push({
        topic: item.topic,
        category: item.category,
        covered: item.pattern.test(combinedText),
      });
    }
  } else if (intent === "capabilities") {
    for (const item of capabilityPatterns()) {
      gaps.push({
        topic: item.topic,
        category: "Features",
        covered: item.pattern.test(combinedText),
      });
    }
  } else if (intent === "pricing") {
    for (const item of PRICING_PATTERNS) {
      gaps.push({
        topic: item.topic,
        category: "Pricing",
        covered: item.pattern.test(combinedText),
      });
    }
  } else if (intent === "process") {
    for (const topic of PROCESS_GAPS) {
      const pattern = new RegExp(topic.split(" ")[0]!, "i");
      gaps.push({
        topic,
        category: "Process",
        covered: pattern.test(combinedText) || sectionPlan.includes(topic),
      });
    }
  } else {
    for (const section of sectionPlan) {
      const hasContent = allFacts.some(
        (f) => f.sectionHint?.toLowerCase().includes(section.toLowerCase()) ?? false
      );
      gaps.push({
        topic: section,
        category: "Structure",
        covered: hasContent,
      });
    }
  }

  return gaps;
}

export function gapCount(gaps: KnowledgeGapItem[]): number {
  return gaps.filter((g) => !g.covered).length;
}

export function gapsByCategory(
  gaps: KnowledgeGapItem[]
): Map<string, KnowledgeGapItem[]> {
  const map = new Map<string, KnowledgeGapItem[]>();
  for (const gap of gaps) {
    const list = map.get(gap.category) ?? [];
    list.push(gap);
    map.set(gap.category, list);
  }
  return map;
}

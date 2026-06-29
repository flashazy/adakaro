/**
 * Analyzes lesson intent, category family, and documentation needs.
 */

import { extractKnowledgeEntity } from "@/lib/ai-training/knowledge-entities";
import { inferIntentSignature } from "@/lib/ai-training/intent-signature";

export type TemplateFamily =
  | "identity"
  | "capabilities"
  | "getting_started"
  | "pricing"
  | "finance"
  | "general";

export interface LessonAnalysis {
  question: string;
  category: string;
  templateFamily: TemplateFamily;
  intentLabel: string;
  entityId: string | null;
  topicPhrase: string;
  isHowTo: boolean;
  isWhatIs: boolean;
}

const IDENTITY_CATEGORIES = new Set(["about adakaro", "general"]);
const GETTING_STARTED_CATEGORIES = new Set(["getting started"]);
const PRICING_CATEGORIES = new Set(["pricing"]);
const FINANCE_CATEGORIES = new Set(["finance", "school administration"]);

const CAPABILITY_CATEGORIES = new Set([
  "admissions",
  "student management",
  "classes & streams",
  "attendance",
  "report cards",
  "promotions",
  "student streaming",
  "curriculum & syllabus",
  "teachers & staff",
  "parent portal",
  "communication",
  "security & roles",
  "user accounts",
  "permissions",
  "ai copilot",
  "integrations",
  "analytics & reporting",
  "notifications",
]);

export function inferTemplateFamily(category: string, question: string): TemplateFamily {
  const cat = category.trim().toLowerCase();
  const q = question.trim().toLowerCase();

  if (IDENTITY_CATEGORIES.has(cat) || /\bwhat is adakaro\b/.test(q) || /\bwho is adakaro\b/.test(q)) {
    return "identity";
  }
  if (GETTING_STARTED_CATEGORIES.has(cat) || /\bget started\b/.test(q) || /\bhow do i begin\b/.test(q)) {
    return "getting_started";
  }
  if (PRICING_CATEGORIES.has(cat) || /\bpricing\b/.test(q) || /\bcost\b/.test(q) || /\bbilling\b/.test(q)) {
    return "pricing";
  }
  if (FINANCE_CATEGORIES.has(cat) || /\bfinance\b/.test(q) || /\bfee\b/.test(q) || /\bpayment\b/.test(q)) {
    return "finance";
  }
  if (CAPABILITY_CATEGORIES.has(cat)) {
    return "capabilities";
  }
  return "general";
}

export function analyzeLesson(question: string, category: string): LessonAnalysis {
  const trimmed = question.trim();
  const intent = inferIntentSignature(trimmed);
  const entity = extractKnowledgeEntity(trimmed);

  return {
    question: trimmed,
    category: category.trim(),
    templateFamily: inferTemplateFamily(category, trimmed),
    intentLabel: intent.label,
    entityId: entity?.id ?? null,
    topicPhrase: trimmed.replace(/\?+$/, "").trim(),
    isHowTo: /^how\b/i.test(trimmed),
    isWhatIs: /^what\b/i.test(trimmed),
  };
}

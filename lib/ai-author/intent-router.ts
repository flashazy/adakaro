/**
 * Intent routing — maps questions to intent, expected answer type, and section plans.
 */

import type { AuthorIntent, ExpectedAnswerType } from "./types";

export interface IntentRoute {
  intent: AuthorIntent;
  expectedAnswerType: ExpectedAnswerType;
  entity: string;
  topic: string;
  intentConfidence: number;
  sectionPlan: string[];
}

const SECTION_PLANS: Record<AuthorIntent, string[]> = {
  identity: ["Overview", "Audience", "Purpose", "Key Facts", "Related Topics"],
  capabilities: ["Overview", "Capabilities", "Modules", "Benefits", "Related Features"],
  process: ["Overview", "Requirements", "Steps", "Expected Result", "Related Tasks"],
  pricing: ["Overview", "Plans", "Limits", "Billing", "Related Topics"],
  finance: ["Overview", "How it Works", "Configuration", "Examples", "Related Features"],
  general: ["Overview", "Purpose", "Key Facts", "Important Notes", "Related Features"],
};

const AUDIENCE_PATTERNS = [
  /\bwho is .+ (built|made) for\b/i,
  /\bwho uses\b/i,
  /\bwho can use\b/i,
  /\bwho should use\b/i,
  /\baudience\b/i,
  /\bfor schools\b/i,
  /\bfor administrators\b/i,
];

const PRICING_PATTERNS = [
  /\bhow much\b/i,
  /\bpricing\b/i,
  /\bcost\b/i,
  /\bprice\b/i,
  /\bsubscription\b/i,
  /\bbilling\b/i,
  /\bfree plan\b/i,
];

const PROCESS_PATTERNS = [
  /^how do i\b/i,
  /^how can i\b/i,
  /^how to\b/i,
  /\bstep\b/i,
  /\bimport\b/i,
  /\bupload\b/i,
  /\bconfigure\b/i,
  /\bset up\b/i,
  /\bcreate\b/i,
  /\benable\b/i,
];

const CAPABILITY_PATTERNS = [
  /\bwhat can .+ do\b/i,
  /\bwhat does .+ do\b/i,
  /\bfeatures\b/i,
  /\bcapabilities\b/i,
  /\bmodules\b/i,
];

const IDENTITY_PATTERNS = [
  /^what is\b/i,
  /^who is\b/i,
  /^why choose\b/i,
  /\bwhat does .+ mean\b/i,
];

const FINANCE_PATTERNS = [/\bfinance\b/i, /\bfee\b/i, /\binvoice\b/i, /\breceipt\b/i, /\bpayment\b/i];

export function routeIntent(question: string, category: string): IntentRoute {
  const q = question.trim();
  const cat = category.trim().toLowerCase();
  const topic = q.replace(/\?+$/, "").trim();

  let intent: AuthorIntent = "general";
  let expectedAnswerType: ExpectedAnswerType = "general_facts";
  let intentConfidence = 70;

  if (AUDIENCE_PATTERNS.some((p) => p.test(q))) {
    intent = "identity";
    expectedAnswerType = "audience";
    intentConfidence = 96;
  } else if (PRICING_PATTERNS.some((p) => p.test(q)) || cat === "pricing") {
    intent = "pricing";
    expectedAnswerType = "pricing_only";
    intentConfidence = 94;
  } else if (PROCESS_PATTERNS.some((p) => p.test(q)) || cat === "getting started") {
    intent = "process";
    expectedAnswerType = "step_by_step";
    intentConfidence = 92;
  } else if (CAPABILITY_PATTERNS.some((p) => p.test(q))) {
    intent = "capabilities";
    expectedAnswerType = "capabilities";
    intentConfidence = 90;
  } else if (IDENTITY_PATTERNS.some((p) => p.test(q)) || cat === "about adakaro") {
    intent = "identity";
    expectedAnswerType = /\bwho\b/i.test(q) ? "audience" : "definition";
    intentConfidence = 91;
  } else if (FINANCE_PATTERNS.some((p) => p.test(q)) || cat === "finance") {
    intent = "finance";
    expectedAnswerType = "configuration";
    intentConfidence = 88;
  } else if (
    [
      "attendance",
      "report cards",
      "student management",
      "admissions",
      "parent portal",
      "permissions",
      "security & roles",
    ].includes(cat)
  ) {
    intent = "capabilities";
    expectedAnswerType = "capabilities";
    intentConfidence = 85;
  }

  const entity = /\badakaro\b/i.test(q) ? "Adakaro" : extractEntityFromQuestion(q);

  return {
    intent,
    expectedAnswerType,
    entity,
    topic,
    intentConfidence,
    sectionPlan: [...SECTION_PLANS[intent]],
  };
}

function extractEntityFromQuestion(question: string): string {
  const match = question.match(/\b(?:what is|who is|how does|how do i)\s+([^?]+)/i);
  return match?.[1]?.trim() || "Topic";
}

export function getSectionPlan(intent: AuthorIntent, structure?: string): string[] {
  const base = SECTION_PLANS[intent] ?? SECTION_PLANS.general;
  if (!structure?.trim()) return base;

  const headings = structure
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\*\*[^*]+\*\*$/.test(line))
    .map((line) => line.replace(/^\*\*|\*\*$/g, "").trim());

  if (headings.length === 0) return base;

  const merged = [...headings];
  for (const title of base) {
    if (!merged.some((h) => h.toLowerCase() === title.toLowerCase())) {
      merged.push(title);
    }
  }
  return merged;
}

export function intentLabel(intent: AuthorIntent): string {
  switch (intent) {
    case "identity":
      return "Identity";
    case "capabilities":
      return "Capabilities";
    case "process":
      return "Process";
    case "pricing":
      return "Pricing";
    case "finance":
      return "Finance";
    default:
      return "General";
  }
}

import { normalizeText } from "./knowledge-scoring";

export type IntentSignatureCategory =
  | "identity"
  | "capabilities"
  | "reasoning"
  | "process"
  | "comparison"
  | "permission"
  | "capability"
  | "eligibility"
  | "pricing"
  | "general";

export interface IntentSignature {
  category: IntentSignatureCategory;
  label: string;
  pattern: string | null;
  confidence: number;
  /** Primary business action when inferable (view, export, generate, …). */
  action: string | null;
}

const SIGNATURE_RULES: Array<{
  category: IntentSignatureCategory;
  label: string;
  patterns: RegExp[];
}> = [
  {
    category: "comparison",
    label: "Comparison",
    patterns: [
      /^(?:what(?:'s| is) the )?(?:difference between|compare|comparison|vs\.?|versus)\b/i,
    ],
  },
  {
    category: "pricing",
    label: "Pricing",
    patterns: [
      /^(?:how much|what(?:'s| is) the (?:cost|price)|is there a free|do i (?:have to|need to) pay|pricing)\b/i,
    ],
  },
  {
    category: "permission",
    label: "Permission / Access",
    patterns: [
      /^who can (?:view|see|access|download|open|print|manage|edit|use)\b/i,
      /^who can\b/i,
      /^can (?:parents|teachers|students|admins|users|staff|coordinators?|school\s+admins?)\s+(?:view|see|access|download|open|print|manage|edit|use|pay)\b/i,
      /^can (?:i|we|schools?)\s+(?:view|see|access|download|open|print)\b/i,
      /^are (?:parents|teachers|students|admins|users|staff)\s+(?:allowed|able)\s+to\s+(?:view|see|access|download|open|print|manage|pay)\b/i,
    ],
  },
  {
    category: "capability",
    label: "Capability",
    patterns: [
      /^can .+\s+be (?:exported|downloaded|printed|generated|shared|sent|emailed|converted|archived|deleted|published|enabled|configured)\b/i,
      /^can (?:adakaro|the system|report cards|attendance|finance)\s+(?:export|generate|support|send|email|print|download|archive|delete|publish|enable|configure)\b/i,
      /^does adakaro support\b/i,
      /^does .+\s+support\b/i,
      /^is .+\s+(?:supported|available|enabled)\b/i,
      /^can adakaro\b/i,
    ],
  },
  {
    category: "eligibility",
    label: "Eligibility",
    patterns: [
      /^can i\b/i,
      /^could i\b/i,
      /^am i allowed\b/i,
      /^is it possible\b/i,
      /^are .+ allowed\b/i,
    ],
  },
  {
    category: "capabilities",
    label: "Capabilities",
    patterns: [
      /^what can\b/i,
      /^what does .+ do\b/i,
      /^what (?:features|modules|functionality|functions)\b/i,
    ],
  },
  {
    category: "reasoning",
    label: "Reasoning",
    patterns: [
      /^why(?: should| do| is| choose| use| would)?\b/i,
      /^what(?:'s| are) the (?:benefit|reason|advantage|point)\b/i,
    ],
  },
  {
    category: "process",
    label: "Process",
    patterns: [
      /^how(?: do| does| to| can| should| would| will)?\b/i,
      /^what(?:'s| is) the (?:process|steps|way to|procedure)\b/i,
    ],
  },
  {
    category: "identity",
    label: "Identity",
    patterns: [
      /^what is\b/i,
      /^who is\b/i,
      /^what are\b/i,
      /^tell me (?:about|what)\b/i,
      /^define\b/i,
      /^explain what\b/i,
    ],
  },
];

const PERMISSION_ACTION_PATTERN =
  /\b(view|see|access|download|open|print|manage|edit|use|pay)\b/i;

const CAPABILITY_ACTION_PATTERNS = [
  /\bbe (exported|downloaded|printed|generated|shared|sent|emailed|converted|archived|deleted|published|enabled|configured)\b/i,
  /\b(?:export|generate|support|send|email|print|download|share|enable|configure|archive|delete|publish)(?:ed|ing|s)?\b/i,
];

const PROCESS_ACTION_PATTERN = /^how (?:do i|to|does) (\w+)/i;

/** Intent families that share an entity but describe different business concepts. */
const RELATED_INTENT_FAMILIES = new Set<IntentSignatureCategory>([
  "permission",
  "capability",
  "eligibility",
  "process",
]);

function extractPrimaryAction(
  question: string,
  category: IntentSignatureCategory
): string | null {
  const trimmed = question.trim();

  if (category === "permission") {
    const match = trimmed.match(PERMISSION_ACTION_PATTERN);
    return match?.[1]?.toLowerCase() ?? null;
  }

  if (category === "capability") {
    for (const pattern of CAPABILITY_ACTION_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match?.[1]) return match[1].toLowerCase();
    }
    return null;
  }

  if (category === "process") {
    const match = trimmed.match(PROCESS_ACTION_PATTERN);
    return match?.[1]?.toLowerCase() ?? null;
  }

  return null;
}

export function inferIntentSignature(question: string): IntentSignature {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      category: "general",
      label: "General",
      pattern: null,
      confidence: 0.3,
      action: null,
    };
  }

  for (const rule of SIGNATURE_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return {
          category: rule.category,
          label: rule.label,
          pattern: pattern.source,
          confidence: 0.92,
          action: extractPrimaryAction(trimmed, rule.category),
        };
      }
    }
  }

  return {
    category: "general",
    label: "General",
    pattern: null,
    confidence: 0.45,
    action: null,
  };
}

export function areDistinctButRelatedIntentFamilies(
  a: IntentSignature,
  b: IntentSignature
): boolean {
  if (a.category === b.category) return false;
  return RELATED_INTENT_FAMILIES.has(a.category) && RELATED_INTENT_FAMILIES.has(b.category);
}

export function compareIntentSignatures(
  a: IntentSignature,
  b: IntentSignature
): number {
  if (a.category === b.category) {
    if (
      a.action &&
      b.action &&
      a.action !== b.action &&
      (a.category === "permission" ||
        a.category === "capability" ||
        a.category === "process")
    ) {
      return 0.4;
    }
    return 1;
  }
  if (areDistinctButRelatedIntentFamilies(a, b)) return 0.35;
  if (a.category === "general" || b.category === "general") return 0.55;
  return 0;
}

export function extractIdentitySubject(question: string): string | null {
  const n = normalizeText(question);
  const patterns = [
    /^what is (.+?)(?:\?|$)/,
    /^who is (.+?)(?:\?|$)/,
    /^tell me what (.+?) is(?:\?|$)/,
    /^tell me about (.+?)(?:\?|$)/,
    /^explain what (.+?) is(?:\?|$)/,
  ];

  for (const pattern of patterns) {
    const match = n.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function computeQuestionStructureSimilarity(
  questionA: string,
  questionB: string,
  sigA: IntentSignature,
  sigB: IntentSignature
): number {
  if (sigA.category !== sigB.category) return 0;

  if (sigA.action && sigB.action && sigA.action !== sigB.action) {
    return 0.15;
  }

  if (sigA.category === "identity") {
    const subjectA = extractIdentitySubject(questionA);
    const subjectB = extractIdentitySubject(questionB);
    if (subjectA && subjectB && normalizeText(subjectA) === normalizeText(subjectB)) {
      return 0.95;
    }
  }

  const normA = normalizeText(questionA);
  const normB = normalizeText(questionB);
  if (normA === normB) return 1;

  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensB = normB.split(/\s+/).filter(Boolean);
  const setB = new Set(tokensB);
  let shared = 0;
  for (const token of tokensA) {
    if (setB.has(token)) shared++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  if (union === 0) return 0;

  return shared / union;
}

import { normalizeText } from "./knowledge-scoring";

export type IntentSignatureCategory =
  | "identity"
  | "capabilities"
  | "reasoning"
  | "process"
  | "comparison"
  | "eligibility"
  | "pricing"
  | "general";

export interface IntentSignature {
  category: IntentSignatureCategory;
  label: string;
  pattern: string | null;
  confidence: number;
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
    category: "eligibility",
    label: "Eligibility",
    patterns: [
      /^(?:can|could|am i allowed|is it possible|are (?:parents|teachers|students|admins) allowed)\b/i,
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

export function inferIntentSignature(question: string): IntentSignature {
  const trimmed = question.trim();
  if (!trimmed) {
    return { category: "general", label: "General", pattern: null, confidence: 0.3 };
  }

  for (const rule of SIGNATURE_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return {
          category: rule.category,
          label: rule.label,
          pattern: pattern.source,
          confidence: 0.92,
        };
      }
    }
  }

  return { category: "general", label: "General", pattern: null, confidence: 0.45 };
}

export function compareIntentSignatures(
  a: IntentSignature,
  b: IntentSignature
): number {
  if (a.category === b.category) return 1;
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

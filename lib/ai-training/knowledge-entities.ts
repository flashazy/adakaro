/**
 * Named-entity recognition for knowledge duplicate detection and related-lesson suggestions.
 * Zero-cost, rule-based — no embeddings or external APIs.
 */

import { normalizeText } from "./knowledge-scoring";
import type { IntentSignatureCategory } from "./intent-signature";

export interface KnowledgeEntityDefinition {
  id: string;
  label: string;
  /** Product or module this entity represents. */
  product: "platform" | "ai" | "module" | "concept";
  categoryHint?: string;
  patterns: RegExp[];
}

/** Longest / most specific patterns must be listed first in KNOWLEDGE_ENTITIES. */
export const KNOWLEDGE_ENTITIES: KnowledgeEntityDefinition[] = [
  {
    id: "adakaro-ai",
    label: "Adakaro AI",
    product: "ai",
    categoryHint: "AI Copilot",
    patterns: [/\badakaro'?s?\s+ai\b/i, /\badakaro ai\b/i],
  },
  {
    id: "student-streaming",
    label: "Student Streaming",
    product: "module",
    categoryHint: "Student Streaming",
    patterns: [/\bstudent streaming\b/i],
  },
  {
    id: "student-management",
    label: "Student Management",
    product: "module",
    categoryHint: "Student Management",
    patterns: [/\bstudent management\b/i],
  },
  {
    id: "security-roles",
    label: "Security & Roles",
    product: "module",
    categoryHint: "Security & Roles",
    patterns: [/\bsecurity(?:\s*&|\s+and)\s*roles\b/i, /\bsecurity roles\b/i],
  },
  {
    id: "report-cards",
    label: "Report Cards",
    product: "module",
    categoryHint: "Report Cards",
    patterns: [/\breport cards?\b/i],
  },
  {
    id: "parent-portal",
    label: "Parent Portal",
    product: "module",
    categoryHint: "Parent Portal",
    patterns: [/\bparent portal\b/i],
  },
  {
    id: "teachers-staff",
    label: "Teachers & Staff",
    product: "module",
    categoryHint: "Teachers & Staff",
    patterns: [/\bteachers?(?:\s*&|\s+and)\s*staff\b/i],
  },
  {
    id: "classes-streams",
    label: "Classes & Streams",
    product: "module",
    categoryHint: "Classes & Streams",
    patterns: [/\bclasses?(?:\s*&|\s+and)\s*streams?\b/i],
  },
  {
    id: "curriculum-syllabus",
    label: "Curriculum & Syllabus",
    product: "module",
    categoryHint: "Curriculum & Syllabus",
    patterns: [/\bcurriculum(?:\s*&|\s+and)\s*syllabus\b/i, /\bsyllabus coverage\b/i],
  },
  {
    id: "adakaro",
    label: "Adakaro",
    product: "platform",
    categoryHint: "About Adakaro",
    patterns: [/\badakaro\b/i],
  },
  {
    id: "attendance",
    label: "Attendance",
    product: "module",
    categoryHint: "Attendance",
    patterns: [/\battendance\b/i],
  },
  {
    id: "finance",
    label: "Finance",
    product: "module",
    categoryHint: "Finance",
    patterns: [/\bfinance\b/i, /\bfees?\b/i, /\bpayments?\b/i],
  },
  {
    id: "admissions",
    label: "Admissions",
    product: "module",
    categoryHint: "Admissions",
    patterns: [/\badmissions?\b/i, /\benrollment desk\b/i],
  },
  {
    id: "teachers",
    label: "Teachers",
    product: "module",
    categoryHint: "Teachers & Staff",
    patterns: [/\bteachers?\b/i],
  },
  {
    id: "classes",
    label: "Classes",
    product: "module",
    categoryHint: "Classes & Streams",
    patterns: [/\bclasses?\b/i],
  },
  {
    id: "pricing",
    label: "Pricing",
    product: "concept",
    categoryHint: "Pricing",
    patterns: [/\bpricing\b/i, /\bsubscription\b/i, /\bbilling plans?\b/i],
  },
  {
    id: "integrations",
    label: "Integrations",
    product: "concept",
    categoryHint: "Integrations",
    patterns: [/\bintegrations?\b/i, /\bapi\b/i],
  },
  {
    id: "support",
    label: "Support",
    product: "concept",
    categoryHint: "Technical Support",
    patterns: [/\btechnical support\b/i, /\bsupport team\b/i, /\bhelp desk\b/i],
  },
];

const ENTITY_BY_ID = new Map(KNOWLEDGE_ENTITIES.map((e) => [e.id, e]));

/** Related lesson templates keyed by entity id. */
const RELATED_LESSON_TEMPLATES: Record<
  string,
  Array<{ question: string; intent: IntentSignatureCategory }>
> = {
  "adakaro-ai": [
    { question: "What can Adakaro AI do?", intent: "capabilities" },
    { question: "How do I use Adakaro AI?", intent: "process" },
    { question: "What are the limitations of Adakaro AI?", intent: "reasoning" },
    { question: "Can Adakaro AI make mistakes?", intent: "eligibility" },
    { question: "Which users can access Adakaro AI?", intent: "eligibility" },
    { question: "Who is Adakaro AI?", intent: "identity" },
  ],
  adakaro: [
    { question: "What can Adakaro do?", intent: "capabilities" },
    { question: "Why choose Adakaro?", intent: "reasoning" },
    { question: "How do I get started with Adakaro?", intent: "process" },
    { question: "What is Adakaro pricing?", intent: "pricing" },
  ],
  "student-streaming": [
    { question: "How does Student Streaming work?", intent: "process" },
    { question: "Who can manage Student Streaming?", intent: "eligibility" },
  ],
  "report-cards": [
    { question: "How do I generate report cards?", intent: "process" },
    { question: "Can parents view report cards?", intent: "eligibility" },
  ],
  attendance: [
    { question: "How do I mark attendance?", intent: "process" },
    { question: "Can parents see attendance?", intent: "eligibility" },
  ],
  finance: [
    { question: "How do I record a payment?", intent: "process" },
    { question: "Can parents pay fees online?", intent: "eligibility" },
  ],
};

export interface ExtractedKnowledgeEntity {
  id: string;
  label: string;
  product: KnowledgeEntityDefinition["product"];
  confidence: number;
}

export function extractKnowledgeEntity(question: string): ExtractedKnowledgeEntity | null {
  const text = question.trim();
  if (!text) return null;

  for (const def of KNOWLEDGE_ENTITIES) {
    for (const pattern of def.patterns) {
      if (pattern.test(text)) {
        // Adakaro platform must not match when the hit is Adakaro AI
        if (def.id === "adakaro" && /\badakaro'?s?\s+ai\b/i.test(text)) {
          continue;
        }
        return {
          id: def.id,
          label: def.label,
          product: def.product,
          confidence: 0.92,
        };
      }
    }
  }
  return null;
}

export function compareKnowledgeEntities(
  a: ExtractedKnowledgeEntity | null,
  b: ExtractedKnowledgeEntity | null
): number {
  if (!a && !b) return 0.55;
  if (!a || !b) return 0.35;
  if (a.id === b.id) return 1;

  // Platform vs AI product are distinct entities
  if (
    (a.id === "adakaro" && b.id === "adakaro-ai") ||
    (a.id === "adakaro-ai" && b.id === "adakaro")
  ) {
    return 0.08;
  }

  // Same product family but different modules
  if (a.product === b.product && a.product === "module") {
    return 0.12;
  }

  return 0.05;
}

export function entityExplanation(
  current: ExtractedKnowledgeEntity | null,
  existing: ExtractedKnowledgeEntity | null
): string | null {
  if (!current || !existing) return null;
  if (current.id === existing.id) return null;
  return `This lesson discusses a different entity (${current.label} vs ${existing.label}) and should be saved as a new lesson.`;
}

export function getRelatedLessonTemplates(
  entityId: string,
  currentIntent: IntentSignatureCategory
): Array<{ question: string; intent: IntentSignatureCategory }> {
  const templates = RELATED_LESSON_TEMPLATES[entityId] ?? [];
  return templates.filter((t) => t.intent !== currentIntent);
}

export function getEntityDefinition(id: string): KnowledgeEntityDefinition | undefined {
  return ENTITY_BY_ID.get(id);
}

export function normalizeEntitySubject(question: string): string | null {
  const entity = extractKnowledgeEntity(question);
  if (entity) return entity.label.toLowerCase();

  const n = normalizeText(question);
  const match = n.match(
    /^(?:what is|who is|what are|tell me about|explain what)\s+(.+?)(?:\?|$)/
  );
  return match?.[1]?.trim() ?? null;
}

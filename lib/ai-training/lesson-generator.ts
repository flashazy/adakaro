import { randomUUID } from "node:crypto";
import { AI_CONFIG } from "@/lib/ai/config";
import { ADAKARO_PUBLIC_KNOWLEDGE } from "@/lib/ai/knowledge/public-knowledge";
import { generateKeywordsFromQuestion } from "./keyword-generator";
import { inferIntentWithConfidence } from "./intent-registry";
import { inferIntentSignature } from "./intent-signature";
import { computeQuestionSimilarity } from "./knowledge-duplicates";
import {
  CURRICULUM_MODULES,
  getModuleDefinition,
  resolveEntryModuleId,
  type CurriculumModuleId,
} from "./knowledge-curriculum";
import {
  buildLessonGenerationSystemPrompt,
  buildLessonGenerationUserPrompt,
  MODULE_QUESTION_BANK,
  modeToCount,
  type GenerationMode,
  type ModuleQuestionSeed,
} from "./lesson-generation-prompt";
import {
  shouldSkipDuplicate,
  validateGeneratedLesson,
  type DuplicateRiskLevel,
  type QualityGrade,
} from "./lesson-generation-validator";
import {
  processBatchThroughQualityEngine,
  type QualityEngineBatchResult,
} from "./knowledge-quality-engine";
import type {
  KnowledgeQualityReport,
  QualityPipelineMetrics,
  QualityPipelineStatus,
} from "./knowledge-quality-report";
import type { AIKnowledgeEntry, KnowledgePriority } from "./types";

export type GenerationStepId =
  | "analyze"
  | "scan"
  | "intents"
  | "roadmap"
  | "questions"
  | "answers"
  | "keywords"
  | "synonyms"
  | "duplicates"
  | "validation"
  | "quality"
  | "preview";

export interface GenerationStep {
  id: GenerationStepId;
  label: string;
  complete: boolean;
}

export interface CurriculumAnalysis {
  moduleId: CurriculumModuleId;
  moduleName: string;
  existingCount: number;
  targetCount: number;
  remainingCount: number;
  coveredTopics: string[];
  coveredIntents: string[];
  missingConcepts: string[];
  missingIntents: string[];
  weakCoverage: string[];
  duplicateRisks: string[];
}

export interface LessonQualityScores {
  knowledgeScore: number;
  writingScore: number;
  retrievalScore: number;
  intentScore: number;
  coverageScore: number;
  duplicateRiskPercent: number;
  overallScore: number;
}

export interface GeneratedLessonDraft {
  id: string;
  question: string;
  answer: string;
  intentKey: string | null;
  intentLabel: string;
  category: string;
  curriculumModule: CurriculumModuleId;
  priority: KnowledgePriority;
  keywords: string[];
  synonyms: string[];
  search_phrases: string[];
  alternative_wording: string[];
  related_terms: string[];
  topicTag: string;
  duplicateRisk: DuplicateRiskLevel;
  duplicateReason: string | null;
  scores: LessonQualityScores;
  overallGrade: QualityGrade;
  coverageContribution: number;
  estimatedConfidence: number;
  reviewStatus: "draft" | "approved" | "discarded";
  version: number;
  qualityReport?: KnowledgeQualityReport;
  qualityStatus?: QualityPipelineStatus;
  improvementAttempts?: number;
}

export interface GenerationSmartSuggestions {
  coverageImprovedPercent: number;
  missingIntentsBefore: number;
  missingIntentsAfter: number;
  estimatedAccuracyPercent: number;
  duplicateRiskLabel: "Low" | "Medium" | "High";
  curriculumCompletionPercent: number;
}

export interface LessonGenerationResult {
  analysis: CurriculumAnalysis;
  lessons: GeneratedLessonDraft[];
  blockedLessons: GeneratedLessonDraft[];
  rejectedLessons: GeneratedLessonDraft[];
  skippedDuplicates: number;
  suggestions: GenerationSmartSuggestions;
  qualityMetrics: QualityPipelineMetrics;
  provider: "openai" | "rule_based";
  steps: GenerationStep[];
  /** Active knowledge used during generation (for reviewer intelligence). */
  existingEntries?: AIKnowledgeEntry[];
}

export interface LessonGenerationRequest {
  moduleId: CurriculumModuleId;
  mode: GenerationMode;
  targetLessons: number;
  existingEntries: AIKnowledgeEntry[];
  regenerateQuestions?: string[];
}

export interface LessonGenerationProvider {
  id: "openai" | "rule_based";
  generateBatch(input: {
    moduleId: CurriculumModuleId;
    seeds: ModuleQuestionSeed[];
    existingEntries: AIKnowledgeEntry[];
    moduleName: string;
    defaultCategory: string;
  }): Promise<
    Array<{
      question: string;
      answer: string;
      intentLabel: string;
      priority: KnowledgePriority;
      topicTag: string;
    }>
  >;
}

export const GENERATION_STEP_LABELS: Record<GenerationStepId, string> = {
  analyze: "Analyzing existing curriculum…",
  scan: "Scanning lessons…",
  intents: "Detecting missing intents…",
  roadmap: "Building lesson roadmap…",
  questions: "Generating questions…",
  answers: "Writing answers…",
  keywords: "Generating keywords…",
  synonyms: "Generating synonyms…",
  duplicates: "Checking duplicates…",
  validation: "Running quality validation…",
  quality: "Evaluating knowledge quality…",
  preview: "Preparing preview…",
};

function buildAnswerFromSeed(
  seed: ModuleQuestionSeed,
  moduleName: string
): string {
  const k = ADAKARO_PUBLIC_KNOWLEDGE;

  const shortAnswer =
    seed.intentLabel === "Pricing"
      ? k.pricing.summary
      : seed.topicTag.includes("attendance")
        ? k.attendance
        : seed.topicTag.includes("report") || seed.topicTag.includes("grade")
          ? k.reportCards
          : seed.topicTag.includes("financ") || seed.topicTag.includes("fee")
            ? k.finance
            : seed.topicTag.includes("syllabus") || seed.topicTag.includes("curriculum")
              ? k.syllabus
              : seed.topicTag.includes("onboard") || seed.topicTag.includes("setup")
                ? k.onboarding
                : "Adakaro is a school management platform that helps administrators, teachers, and parents run enrollment, attendance, report cards, finance, and communication from one system.";

  const overview = `This lesson answers "${seed.question}" for the **${moduleName}** curriculum — written for school administrators evaluating or using Adakaro.`;

  const facts: string[] = [];
  if (seed.intentLabel === "Pricing") {
    facts.push(k.pricing.summary);
  } else {
    facts.push(
      "Adakaro supports enrollment, classes, attendance, report cards, finance, parent access, and communications."
    );
  }
  facts.push(...k.features.slice(0, 3).map((f) => f.replace(/^-\s*/, "")));

  const benefits = [
    "Reduces manual work compared to spreadsheets and disconnected tools",
    "Gives school leaders clearer visibility across students, classes, and finance",
    "Designed for day-to-day operations—not just demos",
  ];

  const bestFor =
    seed.intentLabel === "Parent"
      ? "School administrators explaining parent-facing features to families."
      : seed.intentLabel === "Pricing"
        ? "School owners and finance leads comparing Adakaro plans."
        : seed.intentLabel === "Security"
          ? "Administrators evaluating data protection and access control."
          : "School administrators, owners, and operations leads.";

  const related = [
    "Platform overview and capabilities",
    "Getting started and onboarding",
    seed.intentLabel === "Pricing" ? "Billing and subscription management" : "Pricing and plans",
  ];

  return [
    "**Short Answer**",
    "",
    shortAnswer,
    "",
    "**Overview**",
    "",
    overview,
    "",
    "**Key Facts**",
    "",
    ...facts.map((f) => `- ${f}`),
    "",
    "**Benefits**",
    "",
    ...benefits.map((b) => `- ${b}`),
    "",
    "**Best For**",
    "",
    bestFor,
    "",
    "**Example**",
    "",
    `A school administrator asks "${seed.question}" during an evaluation call. This lesson gives a direct, factual answer they can trust.`,
    "",
    "**Related Topics**",
    "",
    ...related.map((r) => `- ${r}`),
    "",
    "**Summary**",
    "",
    `${seed.question.replace(/\?$/, "")} — covered with practical, administrator-ready guidance within ${moduleName}.`,
  ].join("\n");
}

const ruleBasedProvider: LessonGenerationProvider = {
  id: "rule_based",
  async generateBatch({ moduleId, seeds, moduleName, defaultCategory }) {
    return seeds.map((seed) => ({
      question: seed.question,
      answer: buildAnswerFromSeed(seed, moduleName),
      intentLabel: seed.intentLabel,
      priority: seed.priority ?? "normal",
      topicTag: seed.topicTag,
    }));
  },
};

async function openAIProviderGenerate(
  moduleId: CurriculumModuleId,
  seeds: ModuleQuestionSeed[],
  analysis: CurriculumAnalysis
): Promise<
  Array<{
    question: string;
    answer: string;
    intentLabel: string;
    priority: KnowledgePriority;
    topicTag: string;
  }>
> {
  const apiKey = AI_CONFIG.openaiApiKey.trim();
  if (!apiKey) return ruleBasedProvider.generateBatch({
    moduleId,
    seeds,
    existingEntries: [],
    moduleName: analysis.moduleName,
    defaultCategory: getModuleDefinition(moduleId).defaultCategory,
  });

  const def = getModuleDefinition(moduleId);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildLessonGenerationSystemPrompt() },
        {
          role: "user",
          content: buildLessonGenerationUserPrompt({
            moduleName: def.name,
            moduleDescription: def.description,
            count: seeds.length,
            existingQuestions: [],
            missingTopics: analysis.missingConcepts,
            missingIntents: analysis.missingIntents,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    return ruleBasedProvider.generateBatch({
      moduleId,
      seeds,
      existingEntries: [],
      moduleName: def.name,
      defaultCategory: def.defaultCategory,
    });
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return ruleBasedProvider.generateBatch({
      moduleId,
      seeds,
      existingEntries: [],
      moduleName: def.name,
      defaultCategory: def.defaultCategory,
    });
  }

  try {
    const parsed = JSON.parse(content) as {
      lessons?: Array<{
        question: string;
        answer: string;
        intentLabel: string;
        priority?: KnowledgePriority;
        topicTag?: string;
      }>;
    };
    if (parsed.lessons?.length) {
      return parsed.lessons.map((l, i) => ({
        question: l.question,
        answer: l.answer,
        intentLabel: l.intentLabel ?? seeds[i]?.intentLabel ?? "General",
        priority: l.priority ?? seeds[i]?.priority ?? "normal",
        topicTag: l.topicTag ?? seeds[i]?.topicTag ?? "generated",
      }));
    }
  } catch {
    /* fallback */
  }

  return ruleBasedProvider.generateBatch({
    moduleId,
    seeds,
    existingEntries: [],
    moduleName: def.name,
    defaultCategory: def.defaultCategory,
  });
}

function resolveProvider(): LessonGenerationProvider {
  if (AI_CONFIG.openaiApiKey.trim()) {
    return {
      id: "openai",
      generateBatch: async ({ moduleId, seeds, moduleName, defaultCategory }) => {
        const analysis = analyzeModuleCurriculum(moduleId, [], 80);
        return openAIProviderGenerate(moduleId, seeds, analysis);
      },
    };
  }
  return ruleBasedProvider;
}

export function analyzeModuleCurriculum(
  moduleId: CurriculumModuleId,
  allEntries: AIKnowledgeEntry[],
  targetLessons: number
): CurriculumAnalysis {
  const def = getModuleDefinition(moduleId);
  const moduleEntries = allEntries.filter(
    (e) =>
      e.status === "active" &&
      resolveEntryModuleId(e) === moduleId &&
      e.is_primary !== false &&
      !e.merged_into_id
  );

  const bank = MODULE_QUESTION_BANK[moduleId] ?? [];
  const coveredTopics = new Set<string>();
  const coveredIntents = new Set<string>();
  const duplicateRisks: string[] = [];

  for (const entry of moduleEntries) {
    const sig = inferIntentSignature(entry.question);
    coveredIntents.add(entry.intent_name ?? entry.intent_key ?? sig.label);
    const match = bank.find(
      (b) =>
        computeQuestionSimilarity(entry.question, {
          ...entry,
          question: b.question,
        }).similarity >= 0.85
    );
    if (match) coveredTopics.add(match.topicTag);
    else coveredTopics.add(entry.question.slice(0, 40));
  }

  for (let i = 0; i < moduleEntries.length; i++) {
    for (let j = i + 1; j < moduleEntries.length; j++) {
      const a = moduleEntries[i]!;
      const b = moduleEntries[j]!;
      const { similarity, classification } = computeQuestionSimilarity(
        a.question,
        b
      );
      if (similarity >= 0.72 && classification !== "different_intent") {
        duplicateRisks.push(`"${a.question}" ↔ "${b.question}"`);
      }
    }
  }

  const missingConcepts = bank
    .filter((seed) => !isQuestionCovered(seed.question, moduleEntries))
    .map((s) => s.topicTag);

  const allIntentLabels = new Set(bank.map((b) => b.intentLabel));
  const missingIntents = [...allIntentLabels].filter(
    (intent) => ![...coveredIntents].some((c) => c.toLowerCase().includes(intent.toLowerCase()))
  );

  const weakCoverage = moduleEntries
    .filter(
      (e) =>
        e.keywords.length < 3 ||
        e.search_phrases.length < 1 ||
        !e.intent_key ||
        (e.health_status ?? "needs_review") === "needs_review"
    )
    .map((e) => e.question);

  return {
    moduleId,
    moduleName: def.name,
    existingCount: moduleEntries.length,
    targetCount: targetLessons,
    remainingCount: Math.max(0, targetLessons - moduleEntries.length),
    coveredTopics: [...coveredTopics],
    coveredIntents: [...coveredIntents],
    missingConcepts,
    missingIntents,
    weakCoverage: weakCoverage.slice(0, 8),
    duplicateRisks: duplicateRisks.slice(0, 5),
  };
}

function isQuestionCovered(
  question: string,
  entries: AIKnowledgeEntry[]
): boolean {
  return entries.some((entry) => {
    const { similarity, classification } = computeQuestionSimilarity(question, entry);
    return similarity >= 0.72 && classification !== "different_intent";
  });
}

function selectQuestionSeeds(
  moduleId: CurriculumModuleId,
  count: number,
  existingEntries: AIKnowledgeEntry[],
  analysis: CurriculumAnalysis,
  regenerateQuestions?: string[]
): ModuleQuestionSeed[] {
  const bank = [...(MODULE_QUESTION_BANK[moduleId] ?? [])];

  if (regenerateQuestions?.length) {
    const regen = bank.filter((b) =>
      regenerateQuestions.some(
        (q) => q.toLowerCase().trim() === b.question.toLowerCase().trim()
      )
    );
    if (regen.length) return regen.slice(0, count);
  }

  const prioritized = bank.sort((a, b) => {
    const aMissing = analysis.missingConcepts.includes(a.topicTag) ? 1 : 0;
    const bMissing = analysis.missingConcepts.includes(b.topicTag) ? 1 : 0;
    const aIntent = analysis.missingIntents.includes(a.intentLabel) ? 1 : 0;
    const bIntent = analysis.missingIntents.includes(b.intentLabel) ? 1 : 0;
    return bMissing + bIntent - (aMissing + aIntent) || 0;
  });

  const selected: ModuleQuestionSeed[] = [];
  for (const seed of prioritized) {
    if (selected.length >= count) break;
    if (isQuestionCovered(seed.question, existingEntries)) continue;
    selected.push(seed);
  }

  // Expand with variations if bank exhausted
  let variant = 1;
  while (selected.length < count && variant <= 3) {
    for (const seed of prioritized) {
      if (selected.length >= count) break;
      const variantQ = seed.question.replace(/\?$/, ` (${variant})?`);
      if (!isQuestionCovered(variantQ, existingEntries)) {
        selected.push({ ...seed, question: variantQ, topicTag: `${seed.topicTag}-v${variant}` });
      }
    }
    variant++;
  }

  return selected.slice(0, count);
}

function buildSteps(complete = true): GenerationStep[] {
  return (Object.keys(GENERATION_STEP_LABELS) as GenerationStepId[]).map((id) => ({
    id,
    label: GENERATION_STEP_LABELS[id],
    complete,
  }));
}

export async function generateModuleLessons(
  request: LessonGenerationRequest
): Promise<LessonGenerationResult> {
  const analysis = analyzeModuleCurriculum(
    request.moduleId,
    request.existingEntries,
    request.targetLessons
  );

  const count = modeToCount(request.mode, analysis.remainingCount);

  const def = getModuleDefinition(request.moduleId);

  const seeds = selectQuestionSeeds(
    request.moduleId,
    Math.max(1, count),
    request.existingEntries,
    analysis,
    request.regenerateQuestions
  );

  const provider = resolveProvider();
  const rawLessons = await provider.generateBatch({
    moduleId: request.moduleId,
    seeds,
    existingEntries: request.existingEntries,
    moduleName: def.name,
    defaultCategory: def.defaultCategory,
  });

  const rawDrafts: GeneratedLessonDraft[] = [];
  let skippedDuplicates = 0;

  for (const raw of rawLessons) {
    const keywords = generateKeywordsFromQuestion(raw.question, def.defaultCategory);
    const inference = inferIntentWithConfidence(raw.question, def.defaultCategory);

    const base = {
      id: randomUUID(),
      question: raw.question,
      answer: raw.answer,
      intentKey: inference?.key ?? null,
      intentLabel: raw.intentLabel ?? inference?.name ?? inferIntentSignature(raw.question).label,
      category: def.defaultCategory,
      curriculumModule: request.moduleId,
      priority: raw.priority,
      keywords: keywords.keywords,
      synonyms: keywords.synonyms,
      search_phrases: keywords.search_phrases,
      alternative_wording: keywords.alternative_wording,
      related_terms: keywords.related_terms,
      topicTag: raw.topicTag,
      reviewStatus: "draft" as const,
      version: 1,
    };

    const validation = validateGeneratedLesson(base, request.existingEntries, rawDrafts);

    if (shouldSkipDuplicate(validation.duplicateRisk)) {
      skippedDuplicates++;
      continue;
    }

    rawDrafts.push({
      ...base,
      duplicateRisk: validation.duplicateRisk,
      duplicateReason: validation.duplicateReason,
      scores: validation.scores,
      overallGrade: validation.overallGrade,
      coverageContribution: validation.coverageContribution,
      estimatedConfidence: validation.estimatedConfidence,
    });
  }

  const qualityResult: QualityEngineBatchResult = processBatchThroughQualityEngine(
    rawDrafts,
    analysis,
    request.existingEntries,
    def.defaultCategory
  );

  const lessons = qualityResult.readyLessons;
  const blockedLessons = qualityResult.blockedLessons;
  const rejectedLessons = qualityResult.rejectedLessons;

  const beforeMissing = analysis.missingIntents.length;
  const afterMissing = Math.max(
    0,
    beforeMissing -
      new Set(lessons.map((l) => l.intentLabel)).size
  );

  const highDup = lessons.filter((l) => l.duplicateRisk === "high" || l.duplicateRisk === "medium").length;
  const dupLabel: GenerationSmartSuggestions["duplicateRiskLabel"] =
    highDup > lessons.length / 2 ? "High" : highDup > 0 ? "Medium" : "Low";

  const suggestions: GenerationSmartSuggestions = {
    coverageImprovedPercent: Math.min(
      100,
      Math.round((lessons.length / Math.max(1, analysis.remainingCount)) * 100)
    ),
    missingIntentsBefore: beforeMissing,
    missingIntentsAfter: afterMissing,
    estimatedAccuracyPercent: lessons.length
      ? qualityResult.metrics.averageQualityScore
      : analysis.existingCount > 0
        ? 72
        : 60,
    duplicateRiskLabel: dupLabel,
    curriculumCompletionPercent: Math.min(
      100,
      Math.round(
        ((analysis.existingCount + lessons.length) / Math.max(1, analysis.targetCount)) *
          100
      )
    ),
  };

  return {
    analysis,
    lessons,
    blockedLessons,
    rejectedLessons,
    skippedDuplicates,
    suggestions,
    qualityMetrics: qualityResult.metrics,
    provider: provider.id,
    steps: buildSteps(true),
  };
}

export { CURRICULUM_MODULES };

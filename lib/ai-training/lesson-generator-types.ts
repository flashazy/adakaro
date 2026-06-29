/**
 * Client-safe types and constants for lesson generation.
 * Keep server-only logic in lesson-generator.ts.
 */

import type { CurriculumModuleId } from "./knowledge-curriculum";
import type { GenerationMode, ModuleQuestionSeed } from "./lesson-generation-prompt";
import type { DuplicateRiskLevel, QualityGrade } from "./lesson-generation-validator";
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

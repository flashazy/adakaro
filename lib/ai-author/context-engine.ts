/**
 * Context Engine — understands the authoring question and builds reasoning context.
 */

import type { DraftGenerationContext } from "./types";
import { routeIntent, type IntentRoute } from "./intent-router";
import { analyzeLesson } from "./lesson-analyzer";

export interface QuestionContext {
  question: string;
  category: string;
  priority: string;
  route: IntentRoute;
  lessonAnalysis: ReturnType<typeof analyzeLesson>;
  prerequisiteQuestions: string[];
  dependencyQuestions: string[];
  relatedQuestions: string[];
  metadataKeywords: string[];
  metadataRelatedTerms: string[];
  curriculumModule: string | null;
}

export function buildQuestionContext(context: DraftGenerationContext): QuestionContext {
  const { request } = context;
  const route = routeIntent(request.question, request.category);
  const lessonAnalysis = analyzeLesson(request.question, request.category);

  return {
    question: request.question.trim(),
    category: request.category.trim(),
    priority: String(request.priority),
    route,
    lessonAnalysis,
    prerequisiteQuestions: request.prerequisiteQuestions ?? [],
    dependencyQuestions: request.dependencyQuestions ?? [],
    relatedQuestions: request.relatedQuestions ?? [],
    metadataKeywords: request.metadata?.keywords ?? [],
    metadataRelatedTerms: request.metadata?.related_terms ?? [],
    curriculumModule: request.curriculumModule ?? null,
  };
}

export type { IntentRoute };

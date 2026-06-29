/**
 * Guided knowledge authoring workflow — step definitions and progress.
 */

import { metadataFieldsMatchSource } from "./knowledge-metadata-generator";
import { hasSemanticStructure } from "./knowledge-answer-structure";

function linesToList(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const AUTHORING_WORKFLOW_STEPS = [
  { id: "question", label: "Question", description: "Define the lesson intent" },
  { id: "knowledge-search", label: "Search KB", description: "AI searches existing knowledge" },
  { id: "related-lessons", label: "Related", description: "Related lessons in the curriculum" },
  { id: "dependencies", label: "Dependencies", description: "Prerequisite lesson chain" },
  { id: "curriculum-priority", label: "Priority", description: "Curriculum priority score" },
  { id: "answer-structure", label: "Structure", description: "Generate answer outline" },
  { id: "author-review", label: "Write", description: "Author writes and reviews" },
  { id: "generate-metadata", label: "Metadata", description: "Generate AI metadata" },
  { id: "quality-check", label: "Quality", description: "Enterprise quality check" },
  { id: "save", label: "Save", description: "Publish enterprise-ready lesson" },
] as const;

export type AuthoringWorkflowStepId = (typeof AUTHORING_WORKFLOW_STEPS)[number]["id"];

export type WorkflowStepStatus = "pending" | "active" | "complete" | "blocked";

export interface AuthoringWorkflowProgressInput {
  question: string;
  answer: string;
  category: string;
  keywordsText: string;
  synonymsText: string;
  searchPhrasesText: string;
  alternativeWordingText: string;
  relatedTermsText: string;
  duplicateCheckLoading: boolean;
  duplicateCheckReady: boolean;
  hasRelatedInsights: boolean;
  hasDependencyInsights: boolean;
  hasPriorityInsight: boolean;
  metadataBaseline: { question: string; answer: string } | null;
  enterpriseReady: boolean;
  enterpriseConfidence: number;
}

export interface AuthoringWorkflowStepState {
  id: AuthoringWorkflowStepId;
  label: string;
  description: string;
  status: WorkflowStepStatus;
}

function metadataSynced(input: AuthoringWorkflowProgressInput): boolean {
  return metadataFieldsMatchSource(input.metadataBaseline, input.question, input.answer);
}

function hasMetadata(input: AuthoringWorkflowProgressInput): boolean {
  return (
    linesToList(input.keywordsText).length >= 3 &&
    linesToList(input.synonymsText).length >= 1 &&
    linesToList(input.searchPhrasesText).length >= 1 &&
    linesToList(input.alternativeWordingText).length >= 1 &&
    linesToList(input.relatedTermsText).length >= 1
  );
}

export function computeAuthoringWorkflowSteps(
  input: AuthoringWorkflowProgressInput
): AuthoringWorkflowStepState[] {
  const questionReady = input.question.trim().length >= 8;
  const searchReady = questionReady && input.duplicateCheckReady && !input.duplicateCheckLoading;
  const relatedReady = searchReady && input.hasRelatedInsights;
  const depsReady = searchReady && input.hasDependencyInsights;
  const priorityReady = searchReady && input.hasPriorityInsight;
  const structureReady =
    questionReady &&
    (hasSemanticStructure(input.answer) || input.answer.trim().length > 0);
  const authorReady = input.answer.trim().length >= 80;
  const metadataReady = authorReady && hasMetadata(input) && metadataSynced(input);
  const qualityReady = input.enterpriseReady;
  const saveReady = qualityReady;

  const completions: Record<AuthoringWorkflowStepId, boolean> = {
    question: questionReady,
    "knowledge-search": searchReady,
    "related-lessons": relatedReady,
    dependencies: depsReady,
    "curriculum-priority": priorityReady,
    "answer-structure": structureReady,
    "author-review": authorReady,
    "generate-metadata": metadataReady,
    "quality-check": qualityReady,
    save: saveReady,
  };

  let foundActive = false;

  return AUTHORING_WORKFLOW_STEPS.map((step) => {
    const complete = completions[step.id];
    let status: WorkflowStepStatus;

    if (complete) {
      status = "complete";
    } else if (!foundActive) {
      status = "active";
      foundActive = true;
    } else {
      status = "pending";
    }

    return { ...step, status };
  });
}

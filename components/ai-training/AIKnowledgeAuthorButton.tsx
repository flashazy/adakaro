"use client";

import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  DRAFT_GENERATION_STAGES,
  type DraftGenerationResult,
  type DraftGenerationStage,
} from "@/lib/ai-author/types";
import { formatGeneratedDraft } from "@/lib/ai-author/draft-formatter";
import { AIKnowledgeAuthorStatus } from "@/components/ai-training/AIKnowledgeAuthorStatus";
import { AIKnowledgeAuthorPreview } from "@/components/ai-training/AIKnowledgeAuthorPreview";
import { cn } from "@/lib/utils";

const STAGE_DELAY_MS = 280;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export interface AIKnowledgeAuthorRequest {
  question: string;
  category: string;
  priority: string;
  structure?: string;
  curriculumModule?: string | null;
  prerequisiteQuestions?: string[];
  dependencyQuestions?: string[];
  relatedQuestions?: string[];
  excludeEntryId?: string;
}

interface AIKnowledgeAuthorButtonProps {
  question: string;
  category: string;
  priority: string;
  structure?: string;
  curriculumModule?: string | null;
  answer: string;
  prerequisiteQuestions?: string[];
  dependencyQuestions?: string[];
  relatedQuestions?: string[];
  excludeEntryId?: string;
  onDraftApplied: (draft: string, result: DraftGenerationResult) => void;
  disabled?: boolean;
  className?: string;
}

export function AIKnowledgeAuthorButton({
  question,
  category,
  priority,
  structure,
  curriculumModule,
  answer,
  prerequisiteQuestions,
  dependencyQuestions,
  relatedQuestions,
  excludeEntryId,
  onDraftApplied,
  disabled,
  className,
}: AIKnowledgeAuthorButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [activeStage, setActiveStage] = useState<DraftGenerationStage | null>(null);
  const [complete, setComplete] = useState(false);
  const [lastResult, setLastResult] = useState<DraftGenerationResult | null>(null);

  const runGeneration = useCallback(async () => {
    if (!question.trim()) return;

    const hasManualContent =
      answer.trim().length > 0 &&
      answer.trim() !== (structure?.trim() ?? "") &&
      answer.trim() !== (lastResult?.draft.trim() ?? "");

    if (hasManualContent) {
      const confirmed = window.confirm(
        "Replace your current answer with an AI-generated draft? Your edits will be lost."
      );
      if (!confirmed) return;
    }

    setGenerating(true);
    setComplete(false);
    setLastResult(null);

    try {
      let apiResult: DraftGenerationResult | null = null;

      for (let i = 0; i < DRAFT_GENERATION_STAGES.length; i++) {
        const stage = DRAFT_GENERATION_STAGES[i]!;
        setActiveStage(stage);

        if (stage === "composing_draft") {
          const res = await fetch("/api/super-admin/ai-training/knowledge/generate-draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: question.trim(),
              category,
              priority,
              structure: structure?.trim() || answer.trim(),
              curriculumModule,
              prerequisiteQuestions,
              dependencyQuestions,
              relatedQuestions,
              excludeEntryId,
            } satisfies AIKnowledgeAuthorRequest),
          });
          if (!res.ok) throw new Error("Draft generation failed");
          apiResult = (await res.json()) as DraftGenerationResult;
        } else {
          await sleep(STAGE_DELAY_MS);
        }
      }

      setActiveStage("validating_quality");
      await sleep(STAGE_DELAY_MS);

      if (!apiResult) throw new Error("No draft returned");

      setLastResult(apiResult);
      setComplete(true);
      onDraftApplied(formatGeneratedDraft(apiResult.draft), apiResult);
    } catch {
      window.alert("Could not generate AI draft. Try again.");
      setComplete(false);
      setActiveStage(null);
    } finally {
      setGenerating(false);
    }
  }, [
    answer,
    category,
    curriculumModule,
    dependencyQuestions,
    excludeEntryId,
    lastResult?.draft,
    onDraftApplied,
    prerequisiteQuestions,
    priority,
    question,
    relatedQuestions,
    structure,
  ]);

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        disabled={disabled || generating || !question.trim()}
        onClick={() => void runGeneration()}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors",
          "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {generating ? (
          <Sparkles className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
        ) : (
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        )}
        Generate AI Draft
      </button>

      {generating || complete ? (
        <AIKnowledgeAuthorStatus activeStage={activeStage} complete={complete} />
      ) : null}

      {complete && lastResult ? <AIKnowledgeAuthorPreview result={lastResult} /> : null}
    </div>
  );
}

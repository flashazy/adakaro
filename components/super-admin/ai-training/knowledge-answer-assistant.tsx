"use client";

import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import type { AnswerImproveAction } from "@/lib/ai-training/knowledge-language-improver";
import { saBtnSecondary, saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";

const IMPROVE_OPTIONS: Array<{ id: AnswerImproveAction; label: string }> = [
  { id: "improve_professional_tone", label: "Improve Professional Tone" },
  { id: "improve_structure", label: "Improve Structure" },
  { id: "make_more_concise", label: "Make More Concise" },
  { id: "expand_explanation", label: "Expand Explanation" },
  { id: "remove_marketing_language", label: "Remove Marketing Language" },
  { id: "make_timeless", label: "Make Timeless" },
  { id: "fix_grammar", label: "Fix Grammar" },
  { id: "improve_readability", label: "Improve Readability" },
];

export function KnowledgeAnswerAssistant({
  question,
  answer,
  onApply,
}: {
  question: string;
  answer: string;
  onApply: (nextAnswer: string, confidence: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<AnswerImproveAction | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  const runImprove = async (action: AnswerImproveAction) => {
    if (!question.trim() || !answer.trim()) return;
    setLoading(action);
    setSuccess(false);
    try {
      const res = await fetch("/api/super-admin/ai-training/knowledge/improve-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, action }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { answer: string; confidence: number };
      onApply(data.answer, data.confidence);
      setLastConfidence(data.confidence);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2000);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(saBtnSecondarySm, "mt-1")}
        disabled={!question.trim() || !answer.trim() || loading !== null}
        onClick={() => setOpen((v) => !v)}
      >
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        AI Improve
      </button>

      {success && lastConfidence !== null ? (
        <span className="ml-2 text-[10px] font-medium text-emerald-600 animate-in fade-in">
          Updated · {lastConfidence}% language score
        </span>
      ) : null}

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {IMPROVE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-900"
              disabled={loading !== null}
              onClick={() => void runImprove(opt.id)}
            >
              {loading === opt.id ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

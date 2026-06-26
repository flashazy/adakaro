"use client";

import { useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import {
  saBtnPrimary,
  saInput,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import { STARTER_QUESTIONS } from "@/lib/ai-training/types";

const EXAMPLE_QUESTIONS = STARTER_QUESTIONS;

interface TestResult {
  matched: boolean;
  confidence: number;
  matchedKeywords: string[];
  matchedPhrases: string[];
  answerPreview: string | null;
  category: string | null;
  entry: { question: string } | null;
  matchedIntentKey: string | null;
  matchedIntentName: string | null;
  finalScore: number;
  needsClarification: boolean;
  clarificationMessage: string | null;
  retrievalMode: string;
}

export function TestAIDrawer({
  open,
  onClose,
  onCreateEntry,
}: {
  open: boolean;
  onClose: () => void;
  onCreateEntry: (question: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/super-admin/ai-training/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.ok) setResult((await res.json()) as TestResult);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Test Adakaro AI</h2>
            <p className={saSectionSubtitle}>
              Zero-cost retrieval — intent, phrases, and knowledge graph.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="block text-sm font-medium text-slate-700">
            Test question
          </label>
          <textarea
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setResult(null);
            }}
            rows={3}
            placeholder="Can parents receive attendance notifications?"
            className={cn(saInput, "mt-2 w-full")}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLE_QUESTIONS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuestion(example);
                  setResult(null);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[11px] font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {example}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={cn(saBtnPrimary, "mt-3 w-full")}
            disabled={loading || !question.trim()}
            onClick={() => void runTest()}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run Test
          </button>

          {result ? (
            <div className="mt-6 space-y-4">
              <div
                className={cn(
                  "rounded-xl border px-4 py-3",
                  result.matched
                    ? "border-emerald-200 bg-emerald-50"
                    : result.needsClarification
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-amber-200 bg-amber-50"
                )}
              >
                <p className="text-sm font-semibold text-slate-900">
                  {result.matched
                    ? "Strong match found"
                    : result.needsClarification
                      ? "Needs clarification"
                      : "No strong match found"}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {result.confidence}% confidence
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Mode: {result.retrievalMode.replace(/_/g, " ")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ScorePill label="Final score" value={`${result.confidence}%`} highlight />
                <ScorePill
                  label="Matched intent"
                  value={result.matchedIntentKey ?? result.matchedIntentName ?? "—"}
                />
              </div>

              {result.needsClarification && result.clarificationMessage ? (
                <div className="rounded-xl bg-indigo-50/80 p-3 text-sm text-indigo-900">
                  {result.clarificationMessage}
                </div>
              ) : null}

              {result.entry ? (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Selected entry
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {result.entry.question}
                    </p>
                    {result.matchedIntentName ? (
                      <p className="mt-1 text-xs text-indigo-600">
                        Intent: {result.matchedIntentName}
                        {result.matchedIntentKey ? ` (${result.matchedIntentKey})` : ""}
                      </p>
                    ) : null}
                  </div>

                  {result.answerPreview ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Answer preview
                      </p>
                      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        {result.answerPreview}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : !result.needsClarification ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-sm text-slate-600">
                    No strong match found. Consider creating a knowledge entry.
                  </p>
                  <button
                    type="button"
                    className={cn(saBtnPrimary, "mt-3")}
                    onClick={() => {
                      onCreateEntry(question);
                      onClose();
                    }}
                  >
                    Create Knowledge Entry
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ScorePill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-2 text-center",
        highlight
          ? "border-indigo-200 bg-indigo-50"
          : "border-slate-200 bg-slate-50"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

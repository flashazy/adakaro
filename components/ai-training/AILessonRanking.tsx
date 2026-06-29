"use client";

import { BookOpen, CheckCircle2, XCircle } from "lucide-react";
import type { LessonRankingExplanation } from "@/lib/ai-author/types";
import { AuthorPanel, ScoreBadge } from "@/components/ai-training/author-panel-shared";

export function AILessonRanking({
  rankings,
  lessonsRead,
  lessonsSelected,
  lessonsDiscarded,
}: {
  rankings: LessonRankingExplanation[];
  lessonsRead: number;
  lessonsSelected: number;
  lessonsDiscarded: number;
}) {
  if (rankings.length === 0) return null;

  return (
    <AuthorPanel
      title="Lesson Ranking"
      icon={<BookOpen className="h-4 w-4 text-violet-500" />}
      badge={
        <span className="text-[10px] text-slate-500">
          {lessonsSelected} / {lessonsRead} selected
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span>Read {lessonsRead}</span>
        <span>·</span>
        <span>Selected {lessonsSelected}</span>
        <span>·</span>
        <span>Discarded {lessonsDiscarded}</span>
      </div>

      <ul className="space-y-2">
        {rankings.slice(0, 10).map((lesson) => (
          <li
            key={lesson.entryId}
            className="rounded-lg px-3 py-2.5 ring-1 ring-inset ring-slate-100 transition-colors hover:bg-slate-50/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {lesson.selected ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                )}
                <div>
                  <p className="text-xs font-medium text-slate-800">{lesson.question}</p>
                  <ul className="mt-1 space-y-0.5">
                    {lesson.reasons.slice(0, 4).map((reason) => (
                      <li key={reason} className="text-[10px] text-emerald-700">
                        ✔ {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <ScoreBadge score={lesson.score} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 pl-5 text-[10px] tabular-nums text-slate-500">
              <span>Facts {lesson.factsExtracted}</span>
              <span>Used {lesson.factsUsed}</span>
              <span>Discarded {lesson.factsDiscarded}</span>
              <span>Confidence {lesson.confidence}%</span>
            </div>
          </li>
        ))}
      </ul>
    </AuthorPanel>
  );
}

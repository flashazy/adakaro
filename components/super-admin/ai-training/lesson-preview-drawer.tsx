"use client";

import { useState } from "react";
import { Eye, Sparkles, X } from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondarySm,
} from "@/components/super-admin/super-admin-dashboard-ui";
import {
  CollapsibleSection,
  DuplicateExplanation,
  InlineQualityReport,
  LessonMarkdownContent,
} from "@/components/super-admin/ai-training/lesson-review-shared";
import type { GeneratedLessonDraft } from "@/lib/ai-training/lesson-generator";
import { cn } from "@/lib/utils";

interface LessonPreviewDrawerProps {
  lesson: GeneratedLessonDraft;
  existingLessonCount?: number;
  relatedLessons?: Array<{ question: string; intentLabel: string }>;
  onClose: () => void;
  onSaveToQueue?: () => void;
  onEdit?: () => void;
  saving?: boolean;
}

export function LessonPreviewDrawer({
  lesson,
  existingLessonCount = 0,
  relatedLessons = [],
  onClose,
  onSaveToQueue,
  onEdit,
  saving,
}: LessonPreviewDrawerProps) {
  const [reviewerNotes, setReviewerNotes] = useState("");
  const report = lesson.qualityReport;
  const quality = report?.overallQuality ?? lesson.scores.overallScore;
  const confidence = report?.reviewerConfidence ?? lesson.estimatedConfidence;
  const canSave =
    lesson.qualityStatus === "ready" &&
    quality >= 90 &&
    lesson.reviewStatus === "draft";

  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Lesson Preview
              </p>
              <h3 className="mt-1 line-clamp-2 text-lg font-bold text-slate-900">
                {lesson.question}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800">
                  {lesson.intentLabel}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 capitalize text-slate-700">
                  {lesson.priority}
                </span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-800">
                  Q {quality} · {confidence}% confidence
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6 scroll-smooth">
          <CollapsibleSection title="Lesson Content" defaultOpen>
            <div className="rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/50 p-5">
              <LessonMarkdownContent content={lesson.answer} />
            </div>
          </CollapsibleSection>

          {report ? (
            <CollapsibleSection title="Quality Analysis" defaultOpen badge={
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {report.grade}
              </span>
            }>
              <InlineQualityReport report={report} />
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection title="Duplicate Detection" defaultOpen={lesson.duplicateRisk !== "none"}>
            <DuplicateExplanation lesson={lesson} existingCount={existingLessonCount} />
          </CollapsibleSection>

          <CollapsibleSection title="Metadata">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <MetaItem label="Module" value={lesson.curriculumModule} />
              <MetaItem label="Topic" value={lesson.topicTag} />
              <MetaItem label="Category" value={lesson.category} />
              <MetaItem label="Coverage contribution" value={String(lesson.coverageContribution)} />
              <MetaItem label="Intent key" value={lesson.intentKey ?? "—"} />
              <MetaItem label="Version" value={String(lesson.version)} />
            </dl>
          </CollapsibleSection>

          <CollapsibleSection title="Keywords & Retrieval">
            <TagSection label="Keywords" items={lesson.keywords} tone="indigo" />
            <TagSection label="Synonyms" items={lesson.synonyms} tone="violet" />
            <TagSection label="Search phrases" items={lesson.search_phrases} tone="sky" />
            <TagSection label="Alternative wording" items={lesson.alternative_wording} tone="amber" />
            <TagSection label="Related terms" items={lesson.related_terms} tone="emerald" />
          </CollapsibleSection>

          {relatedLessons.length > 0 ? (
            <CollapsibleSection title="Related Lessons" defaultOpen={false}>
              <ul className="space-y-2">
                {relatedLessons.slice(0, 6).map((r) => (
                  <li
                    key={r.question}
                    className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100"
                  >
                    <span className="font-medium">{r.question}</span>
                    <span className="ml-2 text-xs text-violet-600">{r.intentLabel}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection title="Reviewer Notes" defaultOpen={false}>
            <textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={4}
              placeholder="Add notes for your review team (local only — not saved to queue yet)…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </CollapsibleSection>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <button type="button" className={saBtnSecondarySm} onClick={onClose}>
            Close
          </button>
          {onEdit ? (
            <button type="button" className={saBtnSecondarySm} onClick={onEdit}>
              Edit Draft
            </button>
          ) : null}
          {onSaveToQueue && canSave ? (
            <button
              type="button"
              disabled={saving}
              className={cn(
                "ml-auto inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              )}
              onClick={onSaveToQueue}
            >
              {saving ? (
                "Saving…"
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Save to Approval Queue
                </>
              )}
            </button>
          ) : (
            <p className="ml-auto flex items-center gap-1 text-xs text-amber-700">
              <Eye className="h-3.5 w-3.5" />
              Score below queue threshold or needs improvement
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function TagSection({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "indigo" | "violet" | "sky" | "amber" | "emerald";
}) {
  if (!items.length) return null;
  const tones = {
    indigo: "bg-indigo-50 text-indigo-800 ring-indigo-100",
    violet: "bg-violet-50 text-violet-800 ring-violet-100",
    sky: "bg-sky-50 text-sky-800 ring-sky-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  };
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone])}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

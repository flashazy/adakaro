"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saInput,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { KnowledgeWritingChecklist } from "@/components/super-admin/ai-training/knowledge-writing-guide";
import { GRADE_STYLES, DUP_STYLES } from "@/components/super-admin/ai-training/generated-lesson-card";
import { STATUS_STYLES } from "@/components/super-admin/ai-training/approval-queue-card";
import { gradeFromQualityScore } from "@/lib/ai-training/knowledge-approval-queue";
import type { AIKnowledgeApprovalQueueItem } from "@/lib/ai-training/types";
import { KnowledgeCategorySelect } from "@/components/super-admin/ai-training/knowledge-category-select";
import { migrateKnowledgeCategory } from "@/lib/ai-training/knowledge-categories";
import { cn } from "@/lib/utils";

interface DuplicateReportData {
  duplicateRisk: string;
  storedReason: unknown;
  publishOutcome: string;
  check?: {
    exactMatch?: { entry: { question: string }; reasons: string[] } | null;
    nearDuplicateMatch?: { entry: { question: string }; reasons: string[] } | null;
    similar?: Array<{ entry: { question: string }; similarity: number; classification: string }>;
  };
}

interface ApprovalReviewDrawerProps {
  open: boolean;
  item: AIKnowledgeApprovalQueueItem | null;
  moduleName?: string;
  duplicateReport?: DuplicateReportData | null;
  loading?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSaveEdit: (patch: Record<string, unknown>) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onPublish: (allowNearDuplicate?: boolean) => Promise<void>;
}

export function ApprovalReviewDrawer({
  open,
  item,
  moduleName,
  duplicateReport,
  loading,
  saving,
  onClose,
  onSaveEdit,
  onApprove,
  onReject,
  onPublish,
}: ApprovalReviewDrawerProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState(item?.proposed_priority ?? "normal");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [publishWarning, setPublishWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setQuestion(item.proposed_question);
    setAnswer(item.proposed_answer);
    setCategory(migrateKnowledgeCategory(item.proposed_category));
    setPriority(item.proposed_priority);
    setPublishWarning(null);
    setShowReject(false);
  }, [item]);

  if (!open || !item) return null;

  const grade = gradeFromQualityScore(item.quality_score);
  const coverageContribution = Number(item.source_metadata.coverageContribution ?? 0);
  const isTerminal =
    item.approval_status === "published" || item.approval_status === "rejected";

  const handlePublish = async (force = false) => {
    try {
      await onPublish(force);
      setPublishWarning(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Publish failed";
      if (msg.includes("Near duplicate")) {
        setPublishWarning(msg);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Approval Review
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Draft lesson</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset",
                    GRADE_STYLES[grade as keyof typeof GRADE_STYLES]
                  )}
                >
                  {grade}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    STATUS_STYLES[item.approval_status]
                  )}
                >
                  {item.approval_status}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    DUP_STYLES[item.duplicate_risk]
                  )}
                >
                  Dup: {item.duplicate_risk}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <MetaField label="Module" value={moduleName ?? item.proposed_curriculum_module ?? "—"} />
                <MetaField
                  label="Intent"
                  value={item.proposed_intent_name ?? item.proposed_intent_key ?? "—"}
                />
                <MetaField label="Quality score" value={String(item.quality_score)} />
                <MetaField label="Coverage contribution" value={String(coverageContribution)} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Question</label>
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isTerminal}
                  className={cn(saInput, "mt-1 w-full")}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Answer</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={isTerminal}
                  rows={10}
                  className={cn(saInput, "mt-1 w-full font-mono text-sm")}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Category</label>
                  <KnowledgeCategorySelect
                    value={category}
                    onChange={setCategory}
                    disabled={isTerminal}
                    rememberSelection
                    className="mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                    disabled={isTerminal}
                    className={cn(saInput, "mt-1 w-full")}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <TagSection label="Keywords" items={item.proposed_keywords} />
              <TagSection label="Synonyms" items={item.proposed_synonyms} />
              <TagSection label="Search phrases" items={item.proposed_search_phrases} />
              <TagSection label="Alternative wording" items={item.proposed_alternative_wording} />
              <TagSection label="Related terms" items={item.proposed_related_terms} />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Writing checklist</h4>
                <div className="mt-3">
                  <KnowledgeWritingChecklist
                    draft={{
                      category,
                      question,
                      answer,
                      keywords: item.proposed_keywords,
                      search_phrases: item.proposed_search_phrases,
                      alternative_wording: item.proposed_alternative_wording,
                      synonyms: item.proposed_synonyms,
                      related_terms: item.proposed_related_terms,
                      priority,
                      intent_key: item.proposed_intent_key,
                    }}
                  />
                </div>
              </div>

              {duplicateReport ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    Duplicate report
                  </h4>
                  <p className="mt-2 text-sm text-amber-800">
                    Publish outcome: <strong>{duplicateReport.publishOutcome}</strong>
                  </p>
                  {duplicateReport.check?.exactMatch ? (
                    <p className="mt-1 text-sm text-amber-800">
                      Exact match: {duplicateReport.check.exactMatch.entry.question}
                    </p>
                  ) : null}
                  {duplicateReport.check?.nearDuplicateMatch ? (
                    <p className="mt-1 text-sm text-amber-800">
                      Near duplicate: {duplicateReport.check.nearDuplicateMatch.entry.question}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {publishWarning ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                  {publishWarning}
                  <button
                    type="button"
                    className="mt-2 block font-semibold underline"
                    onClick={() => void handlePublish(true)}
                  >
                    Publish anyway
                  </button>
                </div>
              ) : null}

              {showReject ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <label className="text-sm font-medium text-red-900">Rejection reason</label>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className={cn(saInput, "mt-2 w-full")}
                    placeholder="Optional reason…"
                  />
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-red-700"
                    onClick={() => void onReject(rejectReason)}
                  >
                    Confirm reject
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!isTerminal ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 p-4">
            <button
              type="button"
              className={saBtnSecondary}
              disabled={saving}
              onClick={() =>
                void onSaveEdit({
                  proposed_question: question,
                  proposed_answer: answer,
                  proposed_category: category,
                  proposed_priority: priority,
                })
              }
            >
              Save edits
            </button>
            <button
              type="button"
              className={saBtnSecondary}
              disabled={saving}
              onClick={() => void onApprove()}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </button>
            <button
              type="button"
              className={saBtnPrimary}
              disabled={saving}
              onClick={() => void handlePublish()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Publish
            </button>
            <button
              type="button"
              className={saBtnSecondary}
              disabled={saving}
              onClick={() => setShowReject(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function TagSection({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { formatDateTime } from "@/components/super-admin/ai-training/shared";
import { GRADE_STYLES, DUP_STYLES } from "@/components/super-admin/ai-training/generated-lesson-card";
import { gradeFromQualityScore } from "@/lib/ai-training/knowledge-approval-queue";
import type { AIKnowledgeApprovalQueueItem } from "@/lib/ai-training/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  edited: "bg-violet-100 text-violet-800",
};

interface ApprovalQueueCardProps {
  item: AIKnowledgeApprovalQueueItem;
  moduleName?: string;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onPreview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPublish: () => void;
  onDelete: () => void;
  busy?: boolean;
}

export function ApprovalQueueCard({
  item,
  moduleName,
  selected,
  onSelect,
  onPreview,
  onApprove,
  onReject,
  onPublish,
  onDelete,
  busy,
}: ApprovalQueueCardProps) {
  const grade = gradeFromQualityScore(item.quality_score);
  const canPublish =
    item.approval_status === "approved" ||
    item.approval_status === "edited" ||
    item.approval_status === "pending";
  const isTerminal =
    item.approval_status === "published" || item.approval_status === "rejected";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm transition-all",
        selected ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200",
        isTerminal && item.approval_status === "rejected" && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        {onSelect ? (
          <input
            type="checkbox"
            checked={selected ?? false}
            disabled={item.approval_status === "published"}
            onChange={(e) => onSelect(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset",
                GRADE_STYLES[grade as keyof typeof GRADE_STYLES] ?? GRADE_STYLES.B
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
          <p className="mt-2 font-medium text-slate-900">{item.proposed_question}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
            {item.proposed_answer.replace(/\*\*/g, "").slice(0, 140)}…
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{moduleName ?? item.proposed_curriculum_module ?? "—"}</span>
            <span>{item.proposed_intent_name ?? item.proposed_intent_key ?? "No intent"}</span>
            <span>Coverage: {item.coverage_score}</span>
            <span>{formatDateTime(item.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button type="button" className={saBtnSecondarySm} onClick={onPreview} disabled={busy}>
          <Eye className="mr-1 h-3 w-3" />
          Preview
        </button>
        {!isTerminal ? (
          <>
            <button type="button" className={saBtnSecondarySm} onClick={onApprove} disabled={busy}>
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Approve
            </button>
            {canPublish ? (
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={onPublish}
                disabled={busy}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Publish
              </button>
            ) : null}
            <button type="button" className={saBtnSecondarySm} onClick={onReject} disabled={busy}>
              <XCircle className="mr-1 h-3 w-3" />
              Reject
            </button>
          </>
        ) : null}
        {item.approval_status !== "published" ? (
          <button
            type="button"
            className="ml-auto inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </button>
        ) : null}
        {item.duplicate_risk === "high" || item.duplicate_risk === "medium" ? (
          <span className="inline-flex items-center text-xs text-amber-700">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Duplicate risk
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { STATUS_STYLES };

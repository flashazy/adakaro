"use client";

import { GitMerge, Loader2, X } from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

interface KnowledgeMergeModalProps {
  open: boolean;
  entries: [AIKnowledgeEntry, AIKnowledgeEntry];
  primaryId: string;
  merging?: boolean;
  onPrimaryChange: (id: string) => void;
  onMerge: () => void;
  onClose: () => void;
}

export function KnowledgeMergeModal({
  open,
  entries,
  primaryId,
  merging = false,
  onPrimaryChange,
  onMerge,
  onClose,
}: KnowledgeMergeModalProps) {
  if (!open) return null;

  const [a, b] = entries;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Merge knowledge entries"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <GitMerge className="h-5 w-5 text-indigo-600" />
              Merge Duplicate Entries
            </h2>
            <p className={saSectionSubtitle}>
              Combine keywords, synonyms, and search phrases. The duplicate will be
              archived and its intent redirected to the primary entry.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={merging}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {[a, b].map((entry) => (
            <label
              key={entry.id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                primaryId === entry.id
                  ? "border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-200"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="merge-primary"
                checked={primaryId === entry.id}
                onChange={() => onPrimaryChange(entry.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{entry.question}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{entry.answer}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {entry.category} · v{entry.version_number ?? 1}
                  {primaryId === entry.id ? (
                    <span className="ml-2 font-semibold text-indigo-700">Primary</span>
                  ) : (
                    <span className="ml-2 text-amber-700">Will be archived</span>
                  )}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={saBtnSecondary} onClick={onClose} disabled={merging}>
            Cancel
          </button>
          <button type="button" className={saBtnPrimary} onClick={onMerge} disabled={merging}>
            {merging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GitMerge className="mr-2 h-4 w-4" />
            )}
            Merge Entries
          </button>
        </div>
      </div>
    </div>
  );
}

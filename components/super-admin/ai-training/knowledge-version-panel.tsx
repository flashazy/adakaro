"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { formatDate, formatDateTime } from "@/components/super-admin/ai-training/shared";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";

interface VersionRow {
  id: string;
  version_number: number;
  question: string;
  answer: string;
  created_at: string;
  created_by: string | null;
}

interface KnowledgeVersionPanelProps {
  entryId: string;
  currentVersion?: number;
  updatedAt?: string;
  onRestored: (row: AIKnowledgeEntry) => void;
}

export function KnowledgeVersionPanel({
  entryId,
  currentVersion = 1,
  updatedAt,
  onRestored,
}: KnowledgeVersionPanelProps) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/super-admin/ai-training/knowledge/${entryId}/versions`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { versions: VersionRow[] };
      setVersions(data.versions ?? []);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const restoreVersion = async (versionId: string) => {
    if (
      !window.confirm(
        "Restore this version? The current content will be saved to history first."
      )
    ) {
      return;
    }
    setRestoringId(versionId);
    try {
      const res = await fetch(
        `/api/super-admin/ai-training/knowledge/${entryId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { row: AIKnowledgeEntry };
      onRestored(data.row);
      void loadVersions();
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Version History</h3>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current version
          </dt>
          <dd className="font-medium text-slate-800">Version {currentVersion}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last updated
          </dt>
          <dd className="text-slate-700">{formatDateTime(updatedAt ?? null)}</dd>
        </div>
      </dl>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading history…
        </div>
      ) : versions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No previous versions yet. Snapshots are created when you save changes.
        </p>
      ) : (
        <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  Version {v.version_number}
                </p>
                <p className="truncate text-xs text-slate-500">{v.question}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Saved {formatDate(v.created_at)}
                </p>
              </div>
              <button
                type="button"
                className={saBtnSecondarySm}
                disabled={restoringId === v.id}
                onClick={() => void restoreVersion(v.id)}
              >
                {restoringId === v.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                )}
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

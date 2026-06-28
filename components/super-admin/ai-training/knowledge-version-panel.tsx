"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { saBtnSecondarySm } from "@/components/super-admin/super-admin-dashboard-ui";
import { formatDate, formatDateTime } from "@/components/super-admin/ai-training/shared";
import { evolutionTypeLabel } from "@/lib/ai-training/knowledge-evolution";
import type { EvolutionEventType } from "@/lib/ai-training/knowledge-intelligence-types";
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
  createdAt?: string;
  onRestored: (row: AIKnowledgeEntry) => void;
}

export function KnowledgeVersionPanel({
  entryId,
  currentVersion = 1,
  updatedAt,
  createdAt,
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

      <EvolutionTimeline
        createdAt={createdAt}
        updatedAt={updatedAt}
        currentVersion={currentVersion}
        versions={versions}
      />

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

function EvolutionTimeline({
  createdAt,
  updatedAt,
  currentVersion,
  versions,
}: {
  createdAt?: string;
  updatedAt?: string;
  currentVersion: number;
  versions: VersionRow[];
}) {
  const events: Array<{ type: EvolutionEventType; label: string; timestamp: string; summary?: string }> = [];

  if (createdAt) {
    events.push({
      type: "created",
      label: evolutionTypeLabel("created"),
      timestamp: createdAt,
      summary: "Initial knowledge entry",
    });
  }

  for (const version of versions) {
    events.push({
      type: version.version_number >= currentVersion ? "improved" : "modified",
      label: `Version ${version.version_number}`,
      timestamp: version.created_at,
      summary: version.question,
    });
  }

  if (updatedAt && createdAt && updatedAt !== createdAt) {
    events.push({
      type: "modified",
      label: evolutionTypeLabel("modified"),
      timestamp: updatedAt,
    });
  }

  const sorted = events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sorted.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Knowledge Evolution Timeline
      </p>
      <ol className="mt-3 space-y-2">
        {sorted.slice(0, 8).map((event, idx) => (
          <li key={`${event.type}-${event.timestamp}-${idx}`} className="flex gap-3 text-sm">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
            <div className="min-w-0">
              <p className="font-medium text-slate-800">{event.label}</p>
              {event.summary ? (
                <p className="truncate text-xs text-slate-500">{event.summary}</p>
              ) : null}
              <p className="text-xs text-slate-400">{formatDateTime(event.timestamp)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

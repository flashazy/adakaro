"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Loader2, RefreshCw } from "lucide-react";
import {
  saBtnSecondarySm,
  saSectionSubtitle,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/super-admin/ai-training/shared";

interface EmbeddingStatus {
  activeEntries: number;
  embeddedEntries: number;
  missingEntries: number;
  lastEmbeddingUpdate: string | null;
  embeddingModel: string;
  embeddingsAvailable: boolean;
  missingEntryQuestions: Array<{ id: string; question: string }>;
}

export function EmbeddingsPanel() {
  const [status, setStatus] = useState<EmbeddingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/embeddings/status");
      if (res.ok) {
        setStatus((await res.json()) as EmbeddingStatus);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const regenerate = async () => {
    setRegenerating(true);
    setMessage(null);
    try {
      const res = await fetch(
        "/api/super-admin/ai-training/embeddings/regenerate",
        { method: "POST" }
      );
      const payload = (await res.json()) as {
        ok?: boolean;
        success?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok) {
        setMessage(payload.error ?? "Failed to regenerate embeddings.");
      } else {
        setMessage(
          `Regenerated ${payload.success ?? 0} embeddings` +
            (payload.failed ? ` (${payload.failed} failed)` : "") +
            "."
        );
        await loadStatus();
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Semantic embeddings
            </h3>
            <p className={cn(saSectionSubtitle, "mt-0.5 max-w-prose")}>
              Vector embeddings power meaning-based re-ranking after keyword
              retrieval.
            </p>
          </div>
        </div>
        <button
          type="button"
          className={saBtnSecondarySm}
          disabled={loading || regenerating || !status?.embeddingsAvailable}
          onClick={() => void regenerate()}
        >
          {regenerating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Regenerate all
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading embedding status…</p>
      ) : status ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusTile label="Active entries" value={String(status.activeEntries)} />
          <StatusTile
            label="With embeddings"
            value={String(status.embeddedEntries)}
            tone={status.missingEntries > 0 ? "warn" : "ok"}
          />
          <StatusTile
            label="Missing embeddings"
            value={String(status.missingEntries)}
            tone={status.missingEntries > 0 ? "warn" : "ok"}
          />
          <StatusTile
            label="Last update"
            value={
              status.lastEmbeddingUpdate
                ? formatDateTime(status.lastEmbeddingUpdate)
                : "Never"
            }
          />
        </div>
      ) : null}

      {status ? (
        <p className="mt-3 text-xs text-slate-500">
          Model: {status.embeddingModel}
          {!status.embeddingsAvailable
            ? " · OpenAI API key not configured"
            : null}
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm text-slate-700">{message}</p>
      ) : null}

      {status && status.missingEntryQuestions.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Entries missing embeddings
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {status.missingEntryQuestions.map((entry) => (
              <li key={entry.id} className="truncate">
                {entry.question}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "ok" && "border-emerald-100 bg-emerald-50/50",
        tone === "warn" && "border-amber-100 bg-amber-50/50",
        tone === "neutral" && "border-slate-100 bg-slate-50/80"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import {
  saBtnPrimary,
  saBtnSecondary,
  saInput,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";

export function BulkImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [text, setText] = useState("");
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-training/knowledge/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: mode === "paste" ? text : undefined,
          csv: mode === "csv" ? csv : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      onImported(data.count ?? 0);
      setText("");
      setCsv("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    const content = await file.text();
    setCsv(content);
    setMode("csv");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bulk Training Import</h2>
            <p className="mt-1 text-sm text-slate-500">
              Import CSV, Excel-exported CSV, or paste multiple Q&A pairs.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              mode === "paste" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
            )}
            onClick={() => setMode("paste")}
          >
            Paste Q&A
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              mode === "csv" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
            )}
            onClick={() => setMode("csv")}
          >
            CSV / Excel
          </button>
        </div>

        {mode === "paste" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={`Q: Can parents see attendance?\nA: Yes. Parents can view attendance in the Parent Portal.\n\nQ: How does pricing work?\nA: Start free with up to 50 students...`}
            className={cn(saInput, "mt-4 w-full font-mono text-xs")}
          />
        ) : (
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-600 hover:bg-slate-100">
              <FileUp className="h-5 w-5" />
              Upload CSV (Excel: Save As → CSV)
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </label>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              placeholder="question,category,answer"
              className={cn(saInput, "w-full font-mono text-xs")}
            />
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={saBtnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={saBtnPrimary}
            disabled={loading || (mode === "paste" ? !text.trim() : !csv.trim())}
            onClick={() => void importData()}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import Entries
          </button>
        </div>
      </div>
    </div>
  );
}

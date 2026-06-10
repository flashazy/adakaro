"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Loader2, X } from "lucide-react";
import { getBulkSyllabusPlaceholder } from "@/lib/syllabus-coverage/bulk-syllabus-placeholders";
import {
  countBulkImportPreview,
  parseBulkSyllabusText,
} from "@/lib/syllabus-coverage/parse-bulk-syllabus";

interface BulkSyllabusImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (text: string) => Promise<{ ok: boolean; message: string }>;
  importing?: boolean;
  /** Selected subject — drives placeholder examples (Mathematics fallback). */
  subjectName?: string | null;
}

export function BulkSyllabusImportModal({
  open,
  onClose,
  onImport,
  importing = false,
  subjectName = null,
}: BulkSyllabusImportModalProps) {
  const [text, setText] = useState("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  useEffect(() => {
    if (!open || !rendered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !importing) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rendered, importing, onClose]);

  const placeholder = useMemo(
    () => getBulkSyllabusPlaceholder(subjectName),
    [subjectName]
  );

  const parsed = useMemo(() => parseBulkSyllabusText(text), [text]);
  const counts = useMemo(
    () => countBulkImportPreview(parsed.topics),
    [parsed.topics]
  );

  if (!rendered || !mounted) return null;

  const canImport = counts.topicCount > 0 && !importing;

  const node = (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 dark:bg-black/70 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close"
        onClick={() => !importing && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-syllabus-title"
        className={`relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl transition-all duration-200 dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-school-primary dark:bg-violet-950/50">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2
                id="bulk-syllabus-title"
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                Bulk add syllabus
              </h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-zinc-400">
                Paste topics and subtopics. Use{" "}
                <code className="text-xs">Topic: Title</code> or a plain topic
                line, with <code className="text-xs">-</code> subtopic bullets.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={14}
            disabled={importing}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />

          {text.trim().length > 0 ? (
            <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
              {counts.topicCount === 0 ? (
                <p className="text-slate-600 dark:text-zinc-400">
                  No topics detected yet. Check your format.
                </p>
              ) : (
                <p className="font-medium text-slate-800 dark:text-zinc-200">
                  {counts.topicCount} topic{counts.topicCount === 1 ? "" : "s"},{" "}
                  {counts.subtopicCount} subtopic
                  {counts.subtopicCount === 1 ? "" : "s"} will be created
                </p>
              )}
              {parsed.warnings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800 dark:text-amber-300/90">
                  {parsed.warnings.slice(0, 5).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                  {parsed.warnings.length > 5 ? (
                    <li>…and {parsed.warnings.length - 5} more warnings</li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canImport}
            onClick={() =>
              void onImport(text).then((res) => {
                if (res.ok) onClose();
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Import syllabus
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

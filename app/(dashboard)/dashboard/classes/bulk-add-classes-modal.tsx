"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { bulkAddClasses, type BulkAddClassesResult } from "./actions";
import { toUppercase } from "@/lib/utils";

interface BulkAddClassesModalProps {
  open: boolean;
  onClose: () => void;
  /** Top-level classes admins can pick as a parent for every created stream. */
  parentOptions?: { id: string; name: string }[];
}

interface PreviewBucket {
  /** Trim+uppercase names that survived dedupe — what would be inserted. */
  uniqueNames: string[];
  /** Count of duplicate lines that were collapsed (informational only). */
  duplicateCount: number;
}

/**
 * Parse the textarea value into an ordered list of unique uppercase names so
 * the live preview matches exactly what the server action will attempt to
 * insert. Dedupe happens here too so the user can see we'll skip repeats
 * before they hit submit.
 */
function buildPreview(raw: string): PreviewBucket {
  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  let duplicateCount = 0;
  for (const line of raw.split(/\r?\n/)) {
    const cleaned = toUppercase(line);
    if (!cleaned) continue;
    if (seen.has(cleaned)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(cleaned);
    uniqueNames.push(cleaned);
  }
  return { uniqueNames, duplicateCount };
}

export function BulkAddClassesModal({
  open,
  onClose,
  parentOptions = [],
}: BulkAddClassesModalProps) {
  const titleId = useId();
  const namesId = useId();
  const descId = useId();
  const parentId = useId();
  const [namesInput, setNamesInput] = useState("");
  const [description, setDescription] = useState("");
  const [parentClassId, setParentClassId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BulkAddClassesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => buildPreview(namesInput), [namesInput]);
  const hasPreview = preview.uniqueNames.length > 0;

  const reset = useCallback(() => {
    setNamesInput("");
    setDescription("");
    setParentClassId("");
    setResult(null);
    setError(null);
  }, []);

  const close = useCallback(() => {
    if (pending) return;
    reset();
    onClose();
  }, [pending, reset, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!hasPreview) {
      setError("Add at least one class name (one per line).");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await bulkAddClasses({
        names: preview.uniqueNames,
        description,
        parentClassId: parentClassId || null,
      });
      setResult(res);
      if (res.ok) {
        // Clear the textarea on success so a follow-up batch starts fresh,
        // but keep the modal open so the admin can read the summary.
        setNamesInput("");
        setDescription("");
        setParentClassId("");
      } else if (res.error) {
        setError(res.error);
      }
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 dark:bg-black/60"
        aria-label="Close dialog"
        onClick={close}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
          <h2
            id={titleId}
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Bulk Add Classes
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor={namesId}
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Class names{" "}
                <span className="font-normal text-slate-400 dark:text-zinc-500">
                  (one per line)
                </span>
              </label>
              <textarea
                id={namesId}
                value={namesInput}
                onChange={(e) => {
                  setNamesInput(e.target.value);
                  if (result || error) {
                    setResult(null);
                    setError(null);
                  }
                }}
                rows={8}
                spellCheck={false}
                className="mt-1.5 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 shadow-sm placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder={"FORM 1A\nFORM 1B\nFORM 1C\nFORM 1D"}
              />
              {(hasPreview || preview.duplicateCount > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                  <span>
                    <span className="font-semibold text-slate-700 dark:text-zinc-200">
                      {preview.uniqueNames.length}
                    </span>{" "}
                    unique name{preview.uniqueNames.length === 1 ? "" : "s"}
                  </span>
                  {preview.duplicateCount > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {preview.duplicateCount} duplicate
                      {preview.duplicateCount === 1 ? "" : "s"} skipped
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {parentOptions.length > 0 && (
              <div>
                <label
                  htmlFor={parentId}
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Parent class{" "}
                  <span className="font-normal text-slate-400 dark:text-zinc-500">
                    (optional)
                  </span>
                </label>
                <select
                  id={parentId}
                  value={parentClassId}
                  onChange={(e) => setParentClassId(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">None</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor={descId}
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Description{" "}
                <span className="font-normal text-slate-400 dark:text-zinc-500">
                  (optional) — applies to all
                </span>
              </label>
              <input
                id={descId}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="mt-4 space-y-2">
              {result.inserted.length > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Added {result.inserted.length} class
                  {result.inserted.length === 1 ? "" : "es"} successfully.
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                  No new classes were added — every name in your list already
                  exists at this school.
                </div>
              )}
              {result.skippedExisting.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-medium">
                    Skipped {result.skippedExisting.length} class
                    {result.skippedExisting.length === 1 ? "" : "es"} that
                    already existed:
                  </p>
                  <p className="mt-1 font-mono text-xs">
                    {result.skippedExisting.join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {result?.ok && result.inserted.length > 0 ? "Done" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={pending || !hasPreview}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? "Adding…"
                : hasPreview
                  ? `Create ${preview.uniqueNames.length} class${preview.uniqueNames.length === 1 ? "" : "es"}`
                  : "Create classes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  bulkAddTeachersAction,
  type BulkAddTeachersResult,
} from "../actions";

interface BulkAddTeachersModalProps {
  open: boolean;
  onClose: () => void;
}

interface PreviewBucket {
  /** De-duped, trimmed display names — exactly what the action will attempt. */
  uniqueNames: string[];
  /** How many lines were collapsed by dedupe / accepted as duplicates. */
  duplicateCount: number;
  /** Lines that were too short / empty (informational only). */
  invalidCount: number;
}

/**
 * Title-case each whitespace-delimited segment, mirroring the helper used by
 * the single-teacher input so previews match the eventual saved display name.
 */
function titleCaseSegment(segment: string): string {
  if (segment.length === 0) return segment;
  return (
    segment.charAt(0).toLocaleUpperCase() +
    segment.slice(1).toLocaleLowerCase()
  );
}

function formatTeacherName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(titleCaseSegment)
    .join(" ");
}

/**
 * Split the textarea on newlines OR commas (per spec: "one per line or
 * comma-separated"), trim, format casing, drop entries shorter than 2 chars,
 * and dedupe by normalized name.
 */
function buildPreview(raw: string): PreviewBucket {
  const tokens = raw
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;
  for (const token of tokens) {
    const display = formatTeacherName(token);
    if (display.length < 2) {
      invalidCount += 1;
      continue;
    }
    const norm = display.toLocaleLowerCase();
    if (seen.has(norm)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(norm);
    uniqueNames.push(display);
  }
  return { uniqueNames, duplicateCount, invalidCount };
}

export function BulkAddTeachersModal({
  open,
  onClose,
}: BulkAddTeachersModalProps) {
  const router = useRouter();
  const titleId = useId();
  const namesId = useId();
  const passwordId = useId();
  const [namesInput, setNamesInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BulkAddTeachersResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => buildPreview(namesInput), [namesInput]);
  const hasPreview = preview.uniqueNames.length > 0;
  const passwordValid = password.length >= 8;

  const reset = useCallback(() => {
    setNamesInput("");
    setPassword("");
    setShowPassword(false);
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
      setError("Add at least one teacher name (one per line).");
      return;
    }
    if (!passwordValid) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await bulkAddTeachersAction({
        names: preview.uniqueNames,
        password,
      });
      setResult(res);
      if (res.error) {
        setError(res.error);
      }
      if (res.created.length > 0) {
        // Refresh the teachers list so the new accounts show up beneath.
        router.refresh();
        // Clear the textarea on partial/full success so a follow-up batch
        // starts fresh; keep the password so the admin can keep going.
        setNamesInput("");
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
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
          <h2
            id={titleId}
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Bulk Add Teachers
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Paste one full name per line (or comma-separated). Every teacher
            in this batch is created with the same temporary password and must
            change it on first sign-in.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col">
              <label
                htmlFor={namesId}
                className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
              >
                Teacher names <span className="text-red-500">*</span>
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
                rows={10}
                spellCheck={false}
                className="mt-1.5 block w-full flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm placeholder:font-sans placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder={
                  "Halima Mdee\nFatmah Shemweta Jadu\nJohn Doe\nJane Okello"
                }
              />
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                <span>
                  <span className="font-semibold text-slate-700 dark:text-zinc-200">
                    {preview.uniqueNames.length}
                  </span>{" "}
                  teacher{preview.uniqueNames.length === 1 ? "" : "s"} ready
                </span>
                {preview.duplicateCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {preview.duplicateCount} duplicate
                    {preview.duplicateCount === 1 ? "" : "s"} skipped
                  </span>
                ) : null}
                {preview.invalidCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {preview.invalidCount} too short / ignored
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="flex items-baseline justify-between">
                <span className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
                  Preview
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Will be created
                </span>
              </div>
              <div className="mt-1.5 min-h-[10rem] flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                {hasPreview ? (
                  <ul className="space-y-1">
                    {preview.uniqueNames.map((name, i) => (
                      <li
                        key={`${name}-${i}`}
                        className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-slate-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--school-primary-rgb)/0.16)] text-[11px] font-semibold text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.18)] dark:text-school-primary">
                          {i + 1}
                        </span>
                        <span className="truncate">{name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Names you type on the left appear here, deduplicated and
                    title-cased, exactly as they will be saved.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor={passwordId}
              className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
            >
              Temporary password <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-11 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
                placeholder="At least 8 characters — applied to every teacher in this batch"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Each teacher signs in with their full name and this password,
              then is forced to choose a new one. No emails are sent.
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-2">
              {result.created.length > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Added {result.created.length} teacher
                  {result.created.length === 1 ? "" : "s"} successfully.
                </div>
              ) : result.attempted > 0 && !result.error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                  No new teachers were added — every name in your list already
                  exists at this school.
                </div>
              ) : null}
              {result.skippedExisting.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-medium">
                    Skipped {result.skippedExisting.length} teacher
                    {result.skippedExisting.length === 1 ? "" : "s"} that
                    already exist
                    {result.skippedExisting.length === 1 ? "s" : ""}:
                  </p>
                  <p className="mt-1">{result.skippedExisting.join(", ")}</p>
                </div>
              ) : null}
              {result.failed.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  <p className="font-medium">
                    {result.failed.length} teacher
                    {result.failed.length === 1 ? "" : "s"} could not be
                    created:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {result.failed.map((f, i) => (
                      <li key={`${f.name}-${i}`}>
                        <span className="font-medium">{f.name}</span> —{" "}
                        {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {result && result.created.length > 0 ? "Done" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={pending || !hasPreview || !passwordValid}
              className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? "Creating…"
                : hasPreview
                  ? `Create ${preview.uniqueNames.length} teacher${preview.uniqueNames.length === 1 ? "" : "s"}`
                  : "Create teachers"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

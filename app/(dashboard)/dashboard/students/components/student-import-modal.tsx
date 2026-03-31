"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "@/components/upgrade-modal";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

interface ValidatedRow {
  line: number;
  full_name: string;
  admission_number: string | null;
  class_name: string | null;
  parent_email: string | null;
  status: "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  resolved_class_id: string | null;
}

interface Summary {
  valid: number;
  warnings: number;
  errors: number;
}

interface ImportResult {
  imported: number;
  importedWithWarnings: { line: number; warnings: string[] }[];
  skipped: number;
  skippedDetails: { line: number; reasons: string[] }[];
}

interface Props {
  classes: { id: string; name: string }[];
  /** Pro / Enterprise only; others see an upgrade prompt. */
  canBulkImport?: boolean;
}

function downloadTemplate() {
  const csv = `full_name,admission_number,class_name,parent_email
John Doe,,Grade 1,john@example.com
Jane Smith,,Grade 2,
Ali Hamza,,Grade 1,
`;
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_import_template.csv";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadErrorReport(details: { line: number; reasons: string[] }[]) {
  const header = "line,reasons\n";
  const body = details
    .map(
      (d) =>
        `${d.line},"${d.reasons.map((r) => r.replace(/"/g, '""')).join("; ")}"`
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_import_errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function statusBadge(status: ValidatedRow["status"]) {
  if (status === "valid") {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        Valid
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-300">
      Error
    </span>
  );
}

export default function StudentImportModal({
  classes,
  canBulkImport = true,
}: Props) {
  const router = useRouter();
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"pick" | "preview" | "done">("pick");
  const [progress, setProgress] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rows, setRows] = useState<ValidatedRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState(false);

  const reset = useCallback(() => {
    setPhase("pick");
    setProgress(0);
    setFetchError(null);
    setRows(null);
    setSummary(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const close = useCallback(() => {
    if (pending) return;
    setOpen(false);
    reset();
  }, [pending, reset]);

  const runProgress = useCallback(() => {
    setProgress(0);
    const t = window.setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + 12));
    }, 120);
    return () => window.clearInterval(t);
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFetchError(null);
    setImportResult(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFetchError("Please choose a .csv file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFetchError(`File is too large. Maximum size is ${MAX_BYTES / (1024 * 1024)}MB.`);
      return;
    }

    setPending(true);
    const clearTimer = runProgress();
    try {
      const text = await file.text();
      const nonEmptyLines = text.split(/\r\n|\n|\r/).filter((ln) => ln.trim() !== "");
      if (nonEmptyLines.length <= 1) {
        setFetchError("CSV must include a header row and at least one data row.");
        return;
      }
      const dataRowCount = nonEmptyLines.length - 1;
      if (dataRowCount > MAX_ROWS) {
        setFetchError(`Too many rows. Maximum is ${MAX_ROWS} data rows.`);
        return;
      }

      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", csv: text }),
      });
      const data = (await res.json()) as {
        error?: string;
        rows?: ValidatedRow[];
        preview?: ValidatedRow[];
        summary?: Summary;
      };

      if (res.status === 403) {
        setUpgradeOpen(true);
        setFetchError(null);
        return;
      }

      if (!res.ok || data.error) {
        setFetchError(data.error ?? "Validation failed.");
        return;
      }

      setRows(data.rows ?? []);
      setSummary(data.summary ?? { valid: 0, warnings: 0, errors: 0 });
      setPhase("preview");
    } catch {
      setFetchError("Could not read or validate the file.");
    } finally {
      clearTimer();
      setProgress(100);
      setPending(false);
      window.setTimeout(() => setProgress(0), 400);
    }
  }

  async function handleConfirmImport() {
    if (!rows?.length) return;
    const payload = rows
      .filter((r) => r.status !== "error")
      .map((r) => ({
        line: r.line,
        full_name: r.full_name,
        admission_number: r.admission_number,
        class_name: r.class_name,
        parent_email: r.parent_email,
      }));

    if (payload.length === 0) {
      setFetchError("No valid rows to import. Fix errors and try again.");
      return;
    }

    setPending(true);
    setFetchError(null);
    const clearTimer = runProgress();
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", rows: payload }),
      });
      const data = (await res.json()) as ImportResult & { error?: string };

      if (res.status === 403) {
        setUpgradeOpen(true);
        setFetchError(null);
        return;
      }

      if (!res.ok || data.error) {
        setFetchError(data.error ?? "Import failed.");
        return;
      }

      setImportResult({
        imported: data.imported,
        importedWithWarnings: data.importedWithWarnings ?? [],
        skipped: data.skipped,
        skippedDetails: data.skippedDetails ?? [],
      });
      setPhase("done");
      router.refresh();
    } catch {
      setFetchError("Import request failed.");
    } finally {
      clearTimer();
      setProgress(100);
      setPending(false);
      window.setTimeout(() => setProgress(0), 400);
    }
  }

  const previewSlice = rows?.slice(0, 10) ?? [];

  return (
    <>
      {canBulkImport ? (
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-800 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/60"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          Import Students (CSV)
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Import Students (CSV) — Pro
        </button>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        requiredPlan="pro"
        featureName="Bulk student CSV import"
      />

      {canBulkImport && open ? (
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
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
              <div>
                <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
                  Import students from CSV
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Up to {MAX_ROWS} rows · max {MAX_BYTES / (1024 * 1024)}MB · class names must match exactly
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {classes.length > 0 ? (
                <p className="mb-3 text-xs text-slate-600 dark:text-zinc-400">
                  <span className="font-medium text-slate-800 dark:text-zinc-200">Classes in your school:</span>{" "}
                  {classes.map((c) => c.name).join(", ")}
                </p>
              ) : (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Add at least one class before importing — students require a class.
                </p>
              )}

              {phase === "pick" || phase === "preview" ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Download template
                    </button>
                    <label className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        disabled={pending}
                        onChange={handleFileChange}
                      />
                      Choose CSV file
                    </label>
                  </div>
                  <p
                    className="flex gap-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-400"
                    title="Admission numbers auto-generate (e.g., MOU-001). Leave the admission_number column blank to use auto-generated numbers, or add your own values (format: PREFIX-###)."
                  >
                    <Info
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-zinc-500"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>
                      Admission numbers auto-generate (e.g., MOU-001). Leave the{" "}
                      <span className="font-mono text-[0.7rem] text-slate-600 dark:text-zinc-300">
                        admission_number
                      </span>{" "}
                      column blank to use auto-generated numbers, or add your own
                      values (format: PREFIX-###).
                    </span>
                  </p>
                </div>
              ) : null}

              {(pending || progress > 0) && (
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {pending ? "Working…" : ""}
                  </p>
                </div>
              )}

              {fetchError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {fetchError}
                </div>
              ) : null}

              {phase === "preview" && rows && summary ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
                    <p className="font-medium text-slate-900 dark:text-white">Import summary</p>
                    <ul className="mt-2 space-y-1 text-slate-700 dark:text-zinc-300">
                      <li className="flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                        Valid rows ready to import: <strong>{summary.valid}</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-amber-600 dark:text-amber-400">⚠</span>
                        Rows with warnings (will import): <strong>{summary.warnings}</strong>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-red-600 dark:text-red-400">✗</span>
                        Rows with errors (skipped): <strong>{summary.errors}</strong>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      Preview (first {Math.min(10, rows.length)} of {rows.length} rows)
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">#</th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">Status</th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">Name</th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">Admission</th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">Class</th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">Parent email</th>
                            <th className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewSlice.map((r) => (
                            <tr key={r.line} className="border-b border-slate-100 dark:border-zinc-800/80">
                              <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">{r.line}</td>
                              <td className="px-3 py-2">{statusBadge(r.status)}</td>
                              <td className="px-3 py-2 text-slate-900 dark:text-white">{r.full_name || "—"}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">{r.admission_number ?? "—"}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">{r.class_name ?? "—"}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">{r.parent_email ?? "—"}</td>
                              <td className="px-3 py-2 text-xs text-slate-600 dark:text-zinc-400">
                                {[...r.errors, ...r.warnings].join(" · ") || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {phase === "done" && importResult ? (
                <div className="mt-2 space-y-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <p>
                      <strong>{importResult.imported}</strong> student
                      {importResult.imported === 1 ? "" : "s"} imported successfully.
                    </p>
                  </div>

                  {importResult.importedWithWarnings.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                      <p className="font-medium text-amber-900 dark:text-amber-200">
                        Imported with warnings ({importResult.importedWithWarnings.length})
                      </p>
                      <ul className="mt-2 list-inside list-disc text-xs text-amber-900/90 dark:text-amber-100/90">
                        {importResult.importedWithWarnings.map((w) => (
                          <li key={w.line}>
                            Row {w.line}: {w.warnings.join("; ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {importResult.skipped > 0 ? (
                    <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm dark:border-red-900/40 dark:bg-red-950/25">
                      <p className="font-medium text-red-900 dark:text-red-200">
                        Skipped ({importResult.skipped})
                      </p>
                      <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-red-800 dark:text-red-300/90">
                        {importResult.skippedDetails.map((s) => (
                          <li key={s.line}>
                            Row {s.line}: {s.reasons.join("; ")}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => downloadErrorReport(importResult.skippedDetails)}
                        className="mt-3 text-xs font-medium text-red-800 underline hover:no-underline dark:text-red-300"
                      >
                        Download error report (CSV)
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-zinc-800">
              <div>
                {phase !== "done" ? (
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {phase === "preview" && rows && summary ? (
                  <>
                    <button
                      type="button"
                      onClick={reset}
                      disabled={pending}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Choose another file
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={pending || summary.valid + summary.warnings === 0}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? "Importing…" : "Confirm import"}
                    </button>
                  </>
                ) : null}
                {phase === "done" ? (
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Close
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


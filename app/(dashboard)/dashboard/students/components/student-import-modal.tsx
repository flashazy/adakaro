"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { UpgradeModal } from "@/components/upgrade-modal";
import { showAdminSuccessToast } from "@/components/dashboard/dashboard-feedback-provider";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

interface ValidatedRow {
  line: number;
  full_name: string;
  admission_number: string | null;
  class_name: string | null;
  gender: "male" | "female" | null;
  enrollment_date: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  subjects_cell: string;
  status: "valid" | "warning" | "error";
  errors: string[];
  subject_errors?: string[];
  warnings: string[];
  resolved_class_id: string | null;
  enroll_all_class_subjects: boolean;
  resolved_subject_ids: string[];
  duplicate_row?: boolean;
}

interface Summary {
  valid: number;
  warnings: number;
  errors: number;
  ready_to_import?: number;
  rows_with_subject_errors?: number;
  all_rows_duplicate_only?: boolean;
}

interface SkippedDetailRow {
  line: number;
  full_name?: string;
  reasons: string[];
}

interface ImportResult {
  imported: number;
  importedWithWarnings: { line: number; warnings: string[] }[];
  skipped: number;
  skippedDetails: SkippedDetailRow[];
  duplicate_skipped?: { line: number; full_name: string; reason: string }[];
  other_skipped_details?: SkippedDetailRow[];
  warning_possible_duplicates?: {
    line: number;
    full_name: string;
    messages: string[];
  }[];
  no_new_students_all_duplicates?: boolean;
}

interface Props {
  /** Used only to detect whether the school has at least one class. */
  classes: { id: string; name: string; parent_class_id?: string | null }[];
  /** Pro / Enterprise only; others see an upgrade prompt. */
  canBulkImport?: boolean;
}

function downloadTemplate() {
  const csv = `full_name,admission_number,class_name,gender,parent_name,parent_email,parent_phone,enrollment_date,subjects
John Doe,,Grade 1,male,Jane Doe,john@example.com,+255700000000,,"English, Kiswahili, Math"
Jane Smith,,Grade 2,female,,,,,
Ali Hamza,,Grade 1,male,,,,2024-01-15,
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

function csvEscapeCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadSkippedRowsReport(details: SkippedDetailRow[]) {
  const header = "line,full_name,reasons\n";
  const body = details
    .map(
      (d) =>
        `${d.line},${csvEscapeCell((d.full_name ?? "").trim())},${csvEscapeCell(
          d.reasons.map((r) => r.replace(/"/g, '""')).join("; ")
        )}`
    )
    .join("\n");
  const blob = new Blob(["\uFEFF", header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_import_skipped.csv";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadWarningsReport(
  rows: { line: number; full_name: string; messages: string[] }[]
) {
  const header = "line,full_name,warnings\n";
  const body = rows
    .map(
      (d) =>
        `${d.line},${csvEscapeCell(d.full_name.trim())},${csvEscapeCell(
          d.messages.map((m) => m.replace(/"/g, '""')).join("; ")
        )}`
    )
    .join("\n");
  const blob = new Blob(["\uFEFF", header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students_import_duplicate_warnings.csv";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function subjectErrorsList(r: ValidatedRow): string[] {
  return r.subject_errors ?? [];
}

function subjectsSummaryLabel(r: ValidatedRow): string {
  if (r.errors.length > 0) return "—";
  const sErr = subjectErrorsList(r);
  if (sErr.length > 0) {
    if (r.enroll_all_class_subjects) return "—";
    return r.resolved_subject_ids.length > 0
      ? `Invalid subject name(s) (${sErr.length})`
      : "Invalid subject name(s)";
  }
  if (r.enroll_all_class_subjects) {
    return "All class subjects (default)";
  }
  const raw = r.subjects_cell.trim();
  if (raw === "") return "—";
  if (r.resolved_subject_ids.length === 0) {
    return "No subjects enrolled (no valid matches)";
  }
  if (raw.length > 48) return `${raw.slice(0, 45)}…`;
  return raw;
}

/** Step card with optional hint and active emphasis (ring + tint). */
function FlowCard({
  title,
  hint,
  active,
  children,
}: {
  title: string;
  hint?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm shadow-sm transition-shadow dark:border-zinc-700 ${
        active
          ? "border-indigo-200 bg-indigo-50 ring-2 ring-indigo-500 dark:border-indigo-500/40 dark:bg-indigo-950/35 dark:ring-indigo-400"
          : "border-slate-200 bg-white ring-0 ring-transparent dark:bg-zinc-950/60"
      }`}
    >
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{hint}</p>
      ) : null}
      <div className={`space-y-1.5 ${hint ? "mt-2" : "mt-2.5"}`}>{children}</div>
    </div>
  );
}

function ColumnGuideTable() {
  const rows: { column: string; required: string; notes: string }[] = [
    { column: "full_name", required: "Required", notes: "Student full name" },
    { column: "admission_number", required: "Optional", notes: "Student admission number" },
    { column: "class_name", required: "Optional", notes: "Must match an existing class" },
    { column: "gender", required: "Required", notes: "Must be male or female" },
    {
      column: "parent_name / parent_email / parent_phone",
      required: "Optional",
      notes: "Parent contact details",
    },
    {
      column: "enrollment_date",
      required: "Optional",
      notes:
        "2026-04-24, 24/04/2026, or 24-04-2026. Leave blank for today's date.",
    },
    {
      column: "subjects",
      required: "Optional",
      notes:
        'Comma-separated names; must exist and be linked to the class (or use "Skip invalid subjects" on import).',
    },
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
      <table className="w-full min-w-[280px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/80">
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold text-slate-700 dark:text-zinc-200">
              Column
            </th>
            <th className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-700 dark:text-zinc-200">
              Required?
            </th>
            <th className="px-2 py-1.5 font-semibold text-slate-700 dark:text-zinc-200">Notes</th>
          </tr>
        </thead>
        <tbody className="text-slate-600 dark:text-zinc-300">
          {rows.map((r) => (
            <tr key={r.column} className="border-b border-slate-100 last:border-0 dark:border-zinc-800/80">
              <td className="px-2 py-1.5 align-top font-mono text-[11px] font-medium text-slate-800 dark:text-zinc-100">
                {r.column}
              </td>
              <td className="align-top whitespace-nowrap px-2 py-1.5">{r.required}</td>
              <td className="px-2 py-1.5 leading-snug">{r.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  /** Column guide starts collapsed so the three steps stay visible on laptop screens. */
  const [columnGuideOpen, setColumnGuideOpen] = useState(false);
  const [skipInvalidSubjects, setSkipInvalidSubjects] = useState(false);

  const reset = useCallback(() => {
    setPhase("pick");
    setProgress(0);
    setFetchError(null);
    setRows(null);
    setSummary(null);
    setImportResult(null);
    setSelectedFileName(null);
    setColumnGuideOpen(false);
    setSkipInvalidSubjects(false);
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
    setSelectedFileName(file.name);

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
        setFetchError("Add a header row and at least one data row.");
        return;
      }
      const dataRowCount = nonEmptyLines.length - 1;
      if (dataRowCount > MAX_ROWS) {
        setFetchError(`Too many rows (max ${MAX_ROWS}).`);
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
      setSkipInvalidSubjects(false);
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
      .filter(
        (r) =>
          r.errors.length === 0 &&
          (skipInvalidSubjects || subjectErrorsList(r).length === 0) &&
          (r.gender === "male" || r.gender === "female")
      )
      .map((r) => ({
        line: r.line,
        full_name: r.full_name,
        admission_number: r.admission_number,
        class_name: r.class_name,
        gender: r.gender === "female" ? "female" : "male",
        enrollment_date: r.enrollment_date,
        parent_name: r.parent_name,
        parent_email: r.parent_email,
        parent_phone: r.parent_phone,
        subjects_cell: r.subjects_cell ?? "",
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
        body: JSON.stringify({
          action: "import",
          skip_invalid_subjects: skipInvalidSubjects,
          rows: payload,
        }),
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
        duplicate_skipped: data.duplicate_skipped,
        other_skipped_details: data.other_skipped_details,
        warning_possible_duplicates: data.warning_possible_duplicates,
        no_new_students_all_duplicates: data.no_new_students_all_duplicates,
      });
      setPhase("done");
      if (data.imported > 0) {
        showAdminSuccessToast(
          `${data.imported} student${data.imported === 1 ? "" : "s"} imported successfully`
        );
      }
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

  const importableRows =
    rows?.filter(
      (r) =>
        r.errors.length === 0 &&
        (skipInvalidSubjects || subjectErrorsList(r).length === 0) &&
        (r.gender === "male" || r.gender === "female")
    ) ?? [];

  const importableIfSubjectsSkipped =
    rows?.filter(
      (r) =>
        r.errors.length === 0 &&
        (r.gender === "male" || r.gender === "female")
    ) ?? [];

  const showSubjectImportBlockedMessage =
    phase === "preview" &&
    Boolean(rows) &&
    !skipInvalidSubjects &&
    importableRows.length === 0 &&
    importableIfSubjectsSkipped.length > 0;

  const duplicateBlockedRows =
    rows?.filter((r) => r.duplicate_row && r.status === "error").length ?? 0;

  const importBlockedAllDuplicatesPreview = Boolean(
    summary?.all_rows_duplicate_only
  );

  const canImportFromPreview =
    importableRows.length > 0 && !importBlockedAllDuplicatesPreview;

  /** Step 2 until a file is in play; step 3 once a file is chosen or results exist. */
  const guidedStep =
    selectedFileName || pending || phase === "preview" || phase === "done" ? 3 : 2;

  return (
    <>
      {canBulkImport ? (
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--school-primary-rgb)/0.25)] bg-[rgb(var(--school-primary-rgb)/0.10)] px-4 py-2 text-sm font-medium text-school-primary transition-colors hover:bg-[rgb(var(--school-primary-rgb)/0.16)] dark:border-[rgb(var(--school-primary-rgb)/0.45)] dark:bg-[rgb(var(--school-primary-rgb)/0.18)] dark:text-school-primary dark:hover:bg-[rgb(var(--school-primary-rgb)/0.2)]"
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
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-zinc-800">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                  Import Students from CSV
                </h2>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                  Step {guidedStep} of 3
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {classes.length === 0 ? (
                <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
                  Add at least one class before importing — students need a class.
                </p>
              ) : null}

              <div className="space-y-3 text-sm">
                <FlowCard
                  title="1. Download template"
                  hint="Download and fill in student details using this template. Accepted formats: 2026-04-24, 24/04/2026, or 24-04-2026. Leave blank for today's date."
                >
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Download template
                  </button>
                </FlowCard>

                <FlowCard
                  title="2. Upload completed file"
                  hint="Upload your completed CSV file."
                  active={guidedStep === 2}
                >
                  <label
                    className={`flex w-full cursor-pointer items-center justify-center rounded-lg px-3 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-colors sm:inline-flex sm:w-auto ${
                      classes.length === 0 || pending
                        ? "cursor-not-allowed bg-slate-400 opacity-70 dark:bg-zinc-600"
                        : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      disabled={pending || classes.length === 0}
                      onChange={handleFileChange}
                    />
                    Upload CSV file
                  </label>
                  <p className="truncate text-slate-800 dark:text-zinc-100" title={selectedFileName || undefined}>
                    {selectedFileName ? (
                      <span className="font-medium">{selectedFileName}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-zinc-500">No file selected</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">CSV only, max 5MB.</p>
                  {phase === "preview" && !pending ? (
                    <button
                      type="button"
                      onClick={reset}
                      className="text-xs font-medium text-school-primary underline decoration-from-font underline-offset-2 hover:no-underline dark:text-school-primary"
                    >
                      Upload a different file
                    </button>
                  ) : null}
                </FlowCard>

                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950/60">
                  <button
                    type="button"
                    onClick={() => setColumnGuideOpen((o) => !o)}
                    className="flex w-full items-center gap-1.5 rounded-lg py-0.5 text-left text-sm font-medium text-school-primary hover:bg-slate-50 dark:text-school-primary dark:hover:bg-zinc-800/60"
                    aria-expanded={columnGuideOpen}
                  >
                    {columnGuideOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    )}
                    {columnGuideOpen ? "Hide column guide" : "Need help? See column guide"}
                  </button>
                  {columnGuideOpen ? (
                    <div className="mt-1.5 max-h-[180px] overflow-y-auto overflow-x-auto overscroll-contain pr-0.5">
                      <ColumnGuideTable />
                    </div>
                  ) : null}
                </div>

                <FlowCard
                  title="3. Review and import"
                  hint="Review results and confirm import."
                  active={guidedStep === 3}
                >
                  {(pending || progress > 0) && (
                    <div>
                      <div className="flex items-center gap-2">
                        {pending ? (
                          <Loader2
                            className="h-4 w-4 shrink-0 animate-spin text-school-primary"
                            aria-hidden
                          />
                        ) : null}
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-school-primary transition-[width] duration-200"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        {pending && phase === "pick"
                          ? "Checking your file and comparing against existing students…"
                          : pending && phase === "preview"
                            ? "Importing…"
                            : ""}
                      </p>
                    </div>
                  )}

                  {fetchError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                      {fetchError}
                    </div>
                  ) : null}

                  {phase === "pick" && !pending && !fetchError && !rows ? (
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Upload a CSV file above to preview and import students.
                    </p>
                  ) : null}

                  {phase === "preview" && rows && summary ? (
                    <div className="space-y-2.5">
                      <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/50">
                        <p className="border-b border-slate-200 pb-1.5 text-xs font-semibold text-slate-900 dark:border-zinc-700 dark:text-white">
                          Check results
                        </p>
                        <div className="space-y-0.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300">
                          <p>
                            <span className="text-emerald-600 dark:text-emerald-400">✓</span> Ready to import:{" "}
                            <strong>{importableRows.length}</strong>
                          </p>
                          <p>
                            <span className="text-amber-600 dark:text-amber-400">⚠</span> With warnings:{" "}
                            <strong>
                              {importableRows.filter((r) => r.warnings.length > 0).length}
                            </strong>
                          </p>
                          <p>
                            <span className="text-red-600 dark:text-red-400">✗</span> Blocked:{" "}
                            <strong>{summary.errors}</strong>
                          </p>
                          {(summary.rows_with_subject_errors ?? 0) > 0 ? (
                            <p>
                              <span className="text-red-600 dark:text-red-400">✗</span> Subject issues:{" "}
                              <strong>{summary.rows_with_subject_errors}</strong> row
                              {(summary.rows_with_subject_errors ?? 0) === 1 ? "" : "s"}
                            </p>
                          ) : null}
                          {duplicateBlockedRows > 0 ? (
                            <p>
                              <span className="text-red-600 dark:text-red-400">✗</span> Duplicate (already in
                              school or file): <strong>{duplicateBlockedRows}</strong> row
                              {duplicateBlockedRows === 1 ? "" : "s"}
                            </p>
                          ) : null}
                        </div>
                        <div className="max-h-40 overflow-y-auto border-t border-slate-200 pt-1.5 text-[11px] leading-snug dark:border-zinc-700">
                          {rows.some(
                            (r) =>
                              r.errors.length > 0 ||
                              r.warnings.length > 0 ||
                              subjectErrorsList(r).length > 0
                          ) ? (
                            <ul className="space-y-2 text-slate-700 dark:text-zinc-300">
                              {rows.map((r) => {
                                const sErr = subjectErrorsList(r);
                                if (
                                  r.errors.length === 0 &&
                                  r.warnings.length === 0 &&
                                  sErr.length === 0
                                ) {
                                  return null;
                                }
                                const label = r.full_name.trim() || "(no name)";
                                if (sErr.length > 0 && r.errors.length === 0) {
                                  return (
                                    <li key={r.line} className="list-none">
                                      <div>
                                        <span className="text-red-700 dark:text-red-300" aria-hidden>
                                          ❌
                                        </span>{" "}
                                        Row {r.line} ({label}):
                                      </div>
                                      <ul className="ml-3 mt-1 list-disc space-y-0.5 pl-3">
                                        {sErr.map((msg, i) => (
                                          <li key={i}>{msg}</li>
                                        ))}
                                      </ul>
                                      <p className="ml-3 mt-1 text-slate-600 dark:text-zinc-500">
                                        Fix CSV or check &quot;Skip invalid subjects&quot; to import anyway.
                                      </p>
                                    </li>
                                  );
                                }
                                return (
                                  <li key={r.line}>
                                    {r.errors.length > 0 ? (
                                      <span className="text-red-700 dark:text-red-300">✗</span>
                                    ) : (
                                      <span className="text-amber-700 dark:text-amber-300">⚠</span>
                                    )}{" "}
                                    Row {r.line} ({label}): {[...r.errors, ...r.warnings].join(" ")}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-slate-600 dark:text-zinc-400">No issues on any row.</p>
                          )}
                        </div>
                      </div>

                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-school-primary focus:ring-school-primary dark:border-zinc-600"
                          checked={skipInvalidSubjects}
                          onChange={(e) => setSkipInvalidSubjects(e.target.checked)}
                        />
                        <span>
                          Skip invalid subjects and import anyway (students will be enrolled only in valid
                          subjects)
                        </span>
                      </label>

                      {showSubjectImportBlockedMessage ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
                          Cannot import: Some rows have invalid subjects. Check the box above to skip invalid
                          subjects and import valid rows only.
                        </div>
                      ) : null}

                      {importBlockedAllDuplicatesPreview ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-800 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200">
                          No new students to import. All records already exist in the system.
                        </div>
                      ) : null}

                      <div>
                        <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                          Preview · first {Math.min(10, rows.length)} of {rows.length} rows
                        </p>
                        <div className="max-h-[min(240px,40vh)] overflow-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                          <table className="w-full min-w-[1180px] text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">#</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Status</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Name</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Admission</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Class</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Gender</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Enrolled</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Parent name</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Parent email</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Parent phone</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Subjects</th>
                                <th className="px-2 py-1.5 font-semibold text-slate-600 dark:text-zinc-400">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewSlice.map((r) => (
                                <tr key={r.line} className="border-b border-slate-100 dark:border-zinc-800/80">
                                  <td className="px-2 py-1.5 text-slate-600 dark:text-zinc-400">{r.line}</td>
                                  <td className="px-2 py-1.5">{statusBadge(r.status)}</td>
                                  <td className="px-2 py-1.5 text-slate-900 dark:text-white">{r.full_name || "—"}</td>
                                  <td className="px-2 py-1.5 text-slate-700 dark:text-zinc-300">
                                    {r.admission_number ?? "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-slate-700 dark:text-zinc-300">{r.class_name ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-slate-700 dark:text-zinc-300">
                                    {r.gender === "male" || r.gender === "female" ? r.gender : "—"}
                                  </td>
                                  <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-zinc-300">
                                    {r.enrollment_date ?? "—"}
                                  </td>
                                  <td className="px-2 py-1.5 text-slate-700 dark:text-zinc-300">{r.parent_name ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-slate-700 dark:text-zinc-300">{r.parent_email ?? "—"}</td>
                                  <td className="px-2 py-1.5 text-slate-700 dark:text-zinc-300">{r.parent_phone ?? "—"}</td>
                                  <td className="max-w-[160px] truncate px-2 py-1.5 text-slate-700 dark:text-zinc-300">
                                    {subjectsSummaryLabel(r)}
                                  </td>
                                  <td className="px-2 py-1.5 text-slate-600 dark:text-zinc-400">
                                    {[
                                      ...r.errors,
                                      ...subjectErrorsList(r),
                                      ...r.warnings,
                                    ].join(" · ") || "—"}
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
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-zinc-600 dark:bg-zinc-800/60">
                        <p className="border-b border-slate-200 pb-1.5 text-xs font-semibold text-slate-900 dark:border-zinc-600 dark:text-white">
                          Import results
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-slate-800 dark:text-zinc-200">
                          <li>
                            <span className="text-emerald-600 dark:text-emerald-400">✅</span> Imported:{" "}
                            <strong>{importResult.imported}</strong> new student
                            {importResult.imported === 1 ? "" : "s"}
                          </li>
                          <li>
                            <span className="text-amber-600 dark:text-amber-400">⚠️</span> Skipped (duplicates):{" "}
                            <strong>{importResult.duplicate_skipped?.length ?? 0}</strong> student
                            {(importResult.duplicate_skipped?.length ?? 0) === 1 ? "" : "s"}
                          </li>
                          <li>
                            <span className="text-amber-600 dark:text-amber-400">⚠️</span> Warnings (possible
                            duplicates):{" "}
                            <strong>{importResult.warning_possible_duplicates?.length ?? 0}</strong> student
                            {(importResult.warning_possible_duplicates?.length ?? 0) === 1 ? "" : "s"}
                          </li>
                          {(importResult.other_skipped_details?.length ?? 0) > 0 ? (
                            <li>
                              <span className="text-red-600 dark:text-red-400">✗</span> Other skipped:{" "}
                              <strong>{importResult.other_skipped_details?.length}</strong>
                            </li>
                          ) : null}
                        </ul>
                      </div>

                      {importResult.no_new_students_all_duplicates ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200">
                          No new students to import. All records already exist in the system.
                        </div>
                      ) : importResult.imported > 0 ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                          <p>
                            <strong>{importResult.imported}</strong> student
                            {importResult.imported === 1 ? "" : "s"} imported successfully.
                          </p>
                        </div>
                      ) : null}

                      {importResult.importedWithWarnings.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                          <p className="font-medium text-amber-900 dark:text-amber-200">
                            Imported with warnings ({importResult.importedWithWarnings.length})
                          </p>
                          <ul className="mt-1.5 max-h-28 list-inside list-disc overflow-y-auto text-xs text-amber-900/90 dark:text-amber-100/90">
                            {importResult.importedWithWarnings.map((w) => (
                              <li key={w.line}>
                                Row {w.line}: {w.warnings.join("; ")}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {(importResult.duplicate_skipped?.length ?? 0) > 0 ||
                      (importResult.other_skipped_details?.length ?? 0) > 0 ? (
                        <div className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm dark:border-red-900/40 dark:bg-red-950/25">
                          <p className="font-medium text-red-900 dark:text-red-200">Skipped rows</p>
                          <ul className="mt-1.5 max-h-36 list-inside list-disc space-y-1 overflow-y-auto text-xs text-red-800 dark:text-red-300/90">
                            {(importResult.duplicate_skipped ?? []).map((d) => (
                              <li key={`d-${d.line}`}>
                                Row {d.line} ({d.full_name.trim() || "(no name)"}) – {d.reason}
                              </li>
                            ))}
                            {(importResult.other_skipped_details ?? []).map((s) => (
                              <li key={`o-${s.line}`}>
                                Row {s.line} ({(s.full_name ?? "").trim() || "(no name)"}):{" "}
                                {s.reasons.join("; ")}
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                downloadSkippedRowsReport(importResult.skippedDetails)
                              }
                              className="text-xs font-medium text-red-800 underline hover:no-underline dark:text-red-300"
                            >
                              Download skipped rows report
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {(importResult.warning_possible_duplicates?.length ?? 0) > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                          <p className="font-medium text-amber-900 dark:text-amber-200">
                            Possible duplicate warnings (imported)
                          </p>
                          <ul className="mt-1.5 max-h-28 list-inside list-disc overflow-y-auto text-xs text-amber-900/90 dark:text-amber-100/90">
                            {(importResult.warning_possible_duplicates ?? []).map((w) => (
                              <li key={w.line}>
                                Row {w.line} ({w.full_name.trim() || "(no name)"}): {w.messages.join(" ")}
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            onClick={() =>
                              downloadWarningsReport(
                                importResult.warning_possible_duplicates ?? []
                              )
                            }
                            className="mt-2 text-xs font-medium text-amber-900 underline hover:no-underline dark:text-amber-200"
                          >
                            Download warnings report
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </FlowCard>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
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
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={pending || !canImportFromPreview}
                    className="rounded-lg bg-school-primary px-4 py-2 text-sm font-medium text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? "Importing…" : "Import valid students"}
                  </button>
                ) : null}
                {phase === "done" ? (
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg bg-school-primary px-4 py-2 text-sm font-medium text-white hover:brightness-90"
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


"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  SaKpiCard,
  saBtnPrimary,
  saBtnPrimarySm,
  saBtnSecondary,
  saBtnSecondarySm,
  saInput,
  saSection,
  saSectionSubtitle,
  saSectionTitle,
  saTableHeadCell,
  saTableHeadRow,
  saTableRowHover,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { ApprovalQueueCard } from "@/components/super-admin/ai-training/approval-queue-card";
import { ApprovalReviewDrawer } from "@/components/super-admin/ai-training/approval-review-drawer";
import { GRADE_STYLES, DUP_STYLES } from "@/components/super-admin/ai-training/generated-lesson-card";
import { STATUS_STYLES } from "@/components/super-admin/ai-training/approval-queue-card";
import { formatDateTime } from "@/components/super-admin/ai-training/shared";
import { CURRICULUM_MODULES } from "@/lib/ai-training/knowledge-curriculum";
import { gradeFromQualityScore } from "@/lib/ai-training/knowledge-approval-queue";
import type {
  AIKnowledgeApprovalQueueItem,
  ApprovalQueueSummary,
  BulkPublishPreview,
} from "@/lib/ai-training/types";
import { cn } from "@/lib/utils";

interface KnowledgeApprovalQueueProps {
  initialModule?: string | null;
  initialStatus?: string;
}

export function KnowledgeApprovalQueue({
  initialModule,
  initialStatus,
}: KnowledgeApprovalQueueProps) {
  const [rows, setRows] = useState<AIKnowledgeApprovalQueueItem[]>([]);
  const [summary, setSummary] = useState<ApprovalQueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"table" | "cards">("table");

  const [status, setStatus] = useState(initialStatus ?? "all");
  const [module, setModule] = useState(initialModule ?? "");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [intent, setIntent] = useState("");
  const [qualityGrade, setQualityGrade] = useState("");
  const [duplicateRisk, setDuplicateRisk] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [search, setSearch] = useState("");

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<AIKnowledgeApprovalQueueItem | null>(null);
  const [duplicateReport, setDuplicateReport] = useState<Record<string, unknown> | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<BulkPublishPreview | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const moduleName = useCallback(
    (id: string | null) =>
      CURRICULUM_MODULES.find((m) => m.id === id)?.name ?? id ?? "—",
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (module) params.set("module", module);
      if (category) params.set("category", category);
      if (priority) params.set("priority", priority);
      if (intent) params.set("intent", intent);
      if (qualityGrade) params.set("qualityGrade", qualityGrade);
      if (duplicateRisk) params.set("duplicateRisk", duplicateRisk);
      if (sourceType) params.set("sourceType", sourceType);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(
        `/api/super-admin/ai-training/approval-queue?${params.toString()}`
      );
      const data = (await res.json()) as {
        error?: string;
        rows?: AIKnowledgeApprovalQueueItem[];
        summary?: ApprovalQueueSummary;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load queue");
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [status, module, category, priority, intent, qualityGrade, duplicateRisk, sourceType, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialModule) setModule(initialModule);
    if (initialStatus) setStatus(initialStatus);
  }, [initialModule, initialStatus]);

  const openReview = async (id: string) => {
    setReviewId(id);
    setReviewLoading(true);
    setDuplicateReport(null);
    try {
      const res = await fetch(`/api/super-admin/ai-training/approval-queue/${id}`);
      const data = (await res.json()) as {
        item?: AIKnowledgeApprovalQueueItem;
        duplicateReport?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load item");
      setReviewItem(data.item ?? null);
      setDuplicateReport(data.duplicateReport ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open review");
      setReviewId(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReview = () => {
    setReviewId(null);
    setReviewItem(null);
    setDuplicateReport(null);
  };

  const runAction = async (
    id: string,
    action: "approve" | "reject" | "publish",
    extra?: Record<string, unknown>
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/ai-training/approval-queue/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json()) as { error?: string; preview?: { outcome?: string } };
      if (!res.ok) {
        if (res.status === 409 && action === "publish") {
          throw new Error(data.error ?? "Near duplicate — confirm to publish");
        }
        throw new Error(data.error ?? "Action failed");
      }
      await load();
      if (reviewId === id) {
        const refreshed = await fetch(`/api/super-admin/ai-training/approval-queue/${id}`);
        const json = (await refreshed.json()) as { item?: AIKnowledgeApprovalQueueItem };
        setReviewItem(json.item ?? null);
      }
    } catch (err) {
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (
    action: "bulk_approve" | "bulk_reject" | "bulk_publish" | "bulk_delete",
    extra?: Record<string, unknown>
  ) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-training/approval-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids, ...extra }),
      });
      const data = (await res.json()) as { error?: string; published?: number; count?: number };
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed");
      setSelectedIds(new Set());
      setBulkPreview(null);
      setSuccessMessage(
        action === "bulk_publish"
          ? `Published ${data.published ?? 0} lesson(s).`
          : `Updated ${data.count ?? 0} item(s).`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBusy(false);
    }
  };

  const previewBulkPublish = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/approval-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview_publish", ids }),
      });
      const data = (await res.json()) as BulkPublishPreview & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setBulkPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const selectableRows = useMemo(
    () => rows.filter((r) => r.approval_status !== "published"),
    [rows]
  );

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Approval Queue</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review AI-generated drafts before they become active knowledge entries.
          </p>
        </div>
        <button type="button" className={saBtnSecondary} onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
          <button
            type="button"
            className="ml-3 font-semibold underline"
            onClick={() => setSuccessMessage(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <SaKpiCard label="Pending" value={String(summary.pending)} />
          <SaKpiCard label="Approved" value={String(summary.approved)} />
          <SaKpiCard label="Published" value={String(summary.published)} />
          <SaKpiCard label="Rejected" value={String(summary.rejected)} />
          <SaKpiCard label="Needs Review" value={String(summary.needsReview)} />
          <SaKpiCard label="Duplicate Risk" value={String(summary.duplicateRisk)} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question, answer, keywords…"
            className={cn(saInput, "w-full pl-9")}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={saInput}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="edited">Edited</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={module} onChange={(e) => setModule(e.target.value)} className={saInput}>
          <option value="">All modules</option>
          {CURRICULUM_MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={saInput}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={duplicateRisk}
          onChange={(e) => setDuplicateRisk(e.target.value)}
          className={saInput}
        >
          <option value="">All duplicate risk</option>
          <option value="none">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select
          value={qualityGrade}
          onChange={(e) => setQualityGrade(e.target.value)}
          className={saInput}
        >
          <option value="">All grades</option>
          <option value="A+">A+</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="Needs Review">Needs Review</option>
        </select>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className={saInput}
        >
          <option value="">All sources</option>
          <option value="ai_lesson_generator">AI Generator</option>
          <option value="manual">Manual</option>
          <option value="import">Import</option>
        </select>
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Intent filter"
          className={saInput}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <button
          type="button"
          className={saBtnPrimarySm}
          disabled={!selectedIds.size || busy}
          onClick={() => void runBulk("bulk_approve")}
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Approve Selected ({selectedIds.size})
        </button>
        <button
          type="button"
          className={saBtnSecondarySm}
          disabled={!selectedIds.size || busy}
          onClick={() => void runBulk("bulk_reject")}
        >
          <XCircle className="mr-1 h-3 w-3" />
          Reject Selected
        </button>
        <button
          type="button"
          className={saBtnSecondarySm}
          disabled={!selectedIds.size || busy}
          onClick={() => void previewBulkPublish()}
        >
          Preview Publish
        </button>
        <button
          type="button"
          className={saBtnPrimarySm}
          disabled={!selectedIds.size || busy}
          onClick={() => void runBulk("bulk_publish", { allowNearDuplicate: true, skipBlocked: true })}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          Publish Selected
        </button>
        <button
          type="button"
          className={saBtnSecondarySm}
          disabled={!selectedIds.size || busy}
          onClick={() => void runBulk("bulk_delete")}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Delete Selected
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              view === "table" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            )}
            onClick={() => setView("table")}
          >
            Table
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              view === "cards" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            )}
            onClick={() => setView("cards")}
          >
            Cards
          </button>
        </div>
      </div>

      {bulkPreview ? (
        <div className={cn(saSection, "border-indigo-200 bg-indigo-50/40")}>
          <h3 className={saSectionTitle}>Bulk publish summary</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-4 text-sm">
            <p>Total selected: <strong>{bulkPreview.totalSelected}</strong></p>
            <p>Safe to publish: <strong>{bulkPreview.safeToPublish}</strong></p>
            <p>Duplicate warnings: <strong>{bulkPreview.duplicateWarnings}</strong></p>
            <p>Blocked duplicates: <strong>{bulkPreview.blockedDuplicates}</strong></p>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Estimated new active entries: {bulkPreview.estimatedNewEntries}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading approval queue…
        </div>
      ) : view === "table" ? (
        <div className={cn(saSection, "overflow-x-auto p-0")}>
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className={saSectionTitle}>Draft lessons</h3>
            <p className={saSectionSubtitle}>{rows.length} item(s) on this page</p>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className={saTableHeadRow}>
                <th className={saTableHeadCell}>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === selectableRows.length && selectableRows.length > 0
                    }
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? new Set(selectableRows.map((r) => r.id))
                          : new Set()
                      )
                    }
                  />
                </th>
                <th className={saTableHeadCell}>Question</th>
                <th className={saTableHeadCell}>Module</th>
                <th className={saTableHeadCell}>Intent</th>
                <th className={saTableHeadCell}>Quality</th>
                <th className={saTableHeadCell}>Dup risk</th>
                <th className={saTableHeadCell}>Coverage</th>
                <th className={saTableHeadCell}>Status</th>
                <th className={saTableHeadCell}>Created</th>
                <th className={saTableHeadCell} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const grade = gradeFromQualityScore(row.quality_score);
                return (
                  <tr key={row.id} className={saTableRowHover}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        disabled={row.approval_status === "published"}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="max-w-xs px-4 py-3 font-medium">{row.proposed_question}</td>
                    <td className="px-4 py-3 text-xs">
                      {moduleName(row.proposed_curriculum_module)}
                    </td>
                    <td className="px-4 py-3 text-xs text-violet-700">
                      {row.proposed_intent_name ?? row.proposed_intent_key ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                          GRADE_STYLES[grade as keyof typeof GRADE_STYLES]
                        )}
                      >
                        {grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          DUP_STYLES[row.duplicate_risk]
                        )}
                      >
                        {row.duplicate_risk}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.coverage_score}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          STATUS_STYLES[row.approval_status]
                        )}
                      >
                        {row.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={saBtnSecondarySm}
                        onClick={() => void openReview(row.id)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <ApprovalQueueCard
              key={row.id}
              item={row}
              moduleName={moduleName(row.proposed_curriculum_module)}
              selected={selectedIds.has(row.id)}
              onSelect={(sel) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (sel) next.add(row.id);
                  else next.delete(row.id);
                  return next;
                });
              }}
              onPreview={() => void openReview(row.id)}
              onApprove={() => void runAction(row.id, "approve")}
              onReject={() => void runAction(row.id, "reject")}
              onPublish={() => void runAction(row.id, "publish")}
              onDelete={async () => {
                await fetch(`/api/super-admin/ai-training/approval-queue/${row.id}`, {
                  method: "DELETE",
                });
                await load();
              }}
              busy={busy}
            />
          ))}
        </div>
      )}

      <ApprovalReviewDrawer
        open={Boolean(reviewId)}
        item={reviewItem}
        moduleName={moduleName(reviewItem?.proposed_curriculum_module ?? null)}
        duplicateReport={duplicateReport as never}
        loading={reviewLoading}
        saving={busy}
        onClose={closeReview}
        onSaveEdit={async (patch) => {
          if (!reviewId) return;
          setBusy(true);
          try {
            const res = await fetch(`/api/super-admin/ai-training/approval-queue/${reviewId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "edit", patch }),
            });
            const data = (await res.json()) as { error?: string; item?: AIKnowledgeApprovalQueueItem };
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            setReviewItem(data.item ?? null);
            await load();
          } finally {
            setBusy(false);
          }
        }}
        onApprove={async () => {
          if (!reviewId) return;
          await runAction(reviewId, "approve");
        }}
        onReject={async (reason) => {
          if (!reviewId) return;
          await runAction(reviewId, "reject", { reason });
        }}
        onPublish={async (allowNearDuplicate) => {
          if (!reviewId) return;
          await runAction(reviewId, "publish", { allowNearDuplicate });
        }}
      />
    </div>
  );
}

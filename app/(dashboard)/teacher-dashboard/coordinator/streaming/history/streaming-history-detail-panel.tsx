"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  STREAMING_PERFORMANCE_MEASURE_LABELS,
  type StreamingHistoryRow,
} from "@/lib/student-streaming/types";
import { cn } from "@/lib/utils";
import { MovementCell, PlacementTypeBadge, type PlacementType } from "./history-ui";

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {title}
      </h3>
      <dl className="mt-2.5 space-y-2.5">{children}</dl>
    </section>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-slate-500 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-zinc-100">
        {value}
      </dd>
    </div>
  );
}

function placementTypeExplanation(type: PlacementType): string {
  if (type === "Recommended") {
    return "Placed automatically according to streaming rules active at the time.";
  }
  if (type === "Manual Override") {
    return "Coordinator manually changed the recommended stream.";
  }
  return "Multiple students were placed together in one coordinated bulk action.";
}

function formatHistoryDateTime(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  const dateLine = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLine = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dateLine, timeLine };
}

export function StreamingHistoryDetailPanel({
  open,
  row,
  placementType,
  onClose,
}: {
  open: boolean;
  row: StreamingHistoryRow | null;
  placementType: PlacementType | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && row) {
      setRendered(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setRendered(false), 250);
    return () => window.clearTimeout(timeout);
  }, [open, row]);

  useEffect(() => {
    if (!open || !rendered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, rendered]);

  useEffect(() => {
    if (!open || !rendered) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rendered, onClose]);

  if (!mounted || !rendered || !row || !placementType) return null;

  const { dateLine, timeLine } = formatHistoryDateTime(row.createdAt);
  const coordinator = row.coordinatorName.replace(/\s+/g, " ").trim();
  const scoreLabel =
    STREAMING_PERFORMANCE_MEASURE_LABELS[row.performanceMeasure] ??
    "Performance";

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="presentation">
      <button
        type="button"
        aria-label="Close placement details"
        className={cn(
          "absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-250",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="streaming-history-detail-title"
        className={cn(
          "pointer-events-auto absolute flex max-h-[88dvh] flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl transition-all duration-250 ease-out dark:border-zinc-700 dark:bg-zinc-900",
          "inset-x-3 top-[6%] rounded-2xl",
          "md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:h-full md:max-h-[100dvh] md:w-[26rem] md:rounded-none md:border-l md:border-t-0",
          visible
            ? "translate-y-0 opacity-100 md:translate-x-0"
            : "translate-y-3 opacity-0 md:translate-x-full md:translate-y-0"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-zinc-800 md:px-5">
          <div className="min-w-0">
            <h2
              id="streaming-history-detail-title"
              className="text-base font-semibold text-slate-900 dark:text-zinc-50"
            >
              Placement details
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Read-only audit record
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 md:px-5 md:py-5">
          <div className="space-y-5">
            <DetailSection title="Student information">
              <DetailField label="Student name" value={row.studentName} />
              <DetailField
                label="Admission number"
                value={row.admissionNumber ?? "—"}
              />
              <DetailField label="Class" value={row.parentClassName} />
            </DetailSection>

            <DetailSection title="Placement information">
              <DetailField
                label="Previous stream"
                value={row.previousClassName}
              />
              <DetailField label="New stream" value={row.newClassName} />
              <DetailField
                label="Movement"
                value={
                  <MovementCell
                    previous={row.previousClassName}
                    next={row.newClassName}
                  />
                }
              />
              <DetailField
                label="Placement type"
                value={<PlacementTypeBadge type={placementType} />}
              />
              {row.recommendedClassName &&
              placementType === "Manual Override" ? (
                <DetailField
                  label="Rule recommendation"
                  value={row.recommendedClassName}
                />
              ) : null}
            </DetailSection>

            <DetailSection title="Assessment information">
              <DetailField label="Assessment name" value={row.examLabel} />
              <DetailField label="Assessment year" value={row.academicYear} />
              <DetailField label={scoreLabel} value={row.performanceValue} />
            </DetailSection>

            <DetailSection title="Audit information">
              <DetailField label="Coordinator" value={coordinator} />
              <DetailField label="Placement date" value={dateLine} />
              <DetailField label="Placement time" value={timeLine} />
            </DetailSection>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-xs leading-relaxed text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
              {placementTypeExplanation(placementType)}
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}

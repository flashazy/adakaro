"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ReportCardPreview } from "@/app/(dashboard)/teacher-dashboard/report-cards/components/ReportCardPreview";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import type { ProfileReportCardBlock } from "@/lib/student-profile-auto-data";
import { loadStudentProfileReportCardPreviewData } from "./student-profile-report-card-preview.action";

type CardOption = Pick<
  ProfileReportCardBlock,
  "id" | "term" | "academicYear"
>;

function formatOption(r: CardOption): string {
  return `${r.academicYear} · ${r.term}`.replace(/\s+/g, " ").trim();
}

export function StudentProfileFullReportCardButton({
  studentId,
  reportCardRows,
}: {
  studentId: string;
  reportCardRows: CardOption[];
}) {
  const idBase = useId();
  const sorted = useMemo(
    () =>
      [...reportCardRows].sort((a, b) => {
        const y = Number.parseInt(b.academicYear, 10) - Number.parseInt(a.academicYear, 10);
        if (y !== 0) return y;
        if (a.term === b.term) return 0;
        if (b.term === "Term 2" && a.term === "Term 1") return 1;
        if (b.term === "Term 1" && a.term === "Term 2") return -1;
        return 0;
      }),
    [reportCardRows]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    data: ReportCardPreviewData;
    reportCardStatus: string;
  } | null>(null);

  useEffect(() => {
    if (sorted.length === 0) return;
    setSelectedId((prev) => {
      if (prev && sorted.some((r) => r.id === prev)) return prev;
      return sorted[0]!.id;
    });
  }, [sorted]);

  const selected = sorted.find((r) => r.id === selectedId) ?? sorted[0];

  const runLoad = useCallback(
    async (reportCardId: string) => {
      setLoading(true);
      setLoadError(null);
      const res = await loadStudentProfileReportCardPreviewData(
        studentId,
        reportCardId
      );
      setLoading(false);
      if (res.ok) {
        setPreviewData({
          data: res.data,
          reportCardStatus: res.reportCardStatus,
        });
        return;
      }
      setPreviewData(null);
      setLoadError(res.error);
    },
    [studentId]
  );

  const openFullView = useCallback(() => {
    if (!selectedId) return;
    setModalOpen(true);
    setLoadError(null);
    setPreviewData(null);
    void runLoad(selectedId);
  }, [selectedId, runLoad]);

  if (reportCardRows.length === 0) {
    return null;
  }

  const showSelect = sorted.length > 1;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex w-full min-w-0 flex-col gap-1.5 sm:max-w-md sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
          <label
            htmlFor={`${idBase}-rc-full`}
            className="shrink-0 text-sm font-medium text-slate-600 dark:text-zinc-300"
          >
            Report card
          </label>
          {showSelect ? (
            <select
              id={`${idBase}-rc-full`}
              value={selected?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              aria-label="Select report card for full view"
            >
              {sorted.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatOption(r)}
                </option>
              ))}
            </select>
          ) : (
            <select
              id={`${idBase}-rc-full`}
              value={selected?.id ?? ""}
              disabled
              className="w-full min-w-0 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 opacity-90 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
            >
              <option value={selected?.id ?? ""}>
                {selected ? formatOption(selected) : "—"}
              </option>
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={openFullView}
          disabled={!selectedId || loading}
          className="w-full shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          {loading && modalOpen ? "Loading…" : "View full report card"}
        </button>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6 sm:pt-10"
          role="dialog"
          aria-modal="true"
          aria-label="Full report card preview"
          onClick={() => {
            setModalOpen(false);
            setLoadError(null);
            setPreviewData(null);
          }}
        >
          <div
            className="relative w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-end border-b border-slate-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setLoadError(null);
                  setPreviewData(null);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
            <div className="max-h-[min(85vh,900px)] overflow-y-auto p-3 sm:p-4">
              {loadError ? (
                <p className="p-4 text-sm text-red-600 dark:text-red-400">
                  {loadError}
                </p>
              ) : loading && !previewData ? (
                <p className="p-4 text-sm text-slate-600 dark:text-zinc-400">
                  Loading report card…
                </p>
              ) : previewData ? (
                <ReportCardPreview
                  data={previewData.data}
                  viewer="parent"
                  reportCardStatus={previewData.reportCardStatus}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

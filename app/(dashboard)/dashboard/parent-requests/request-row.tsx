"use client";

import { useState, useTransition } from "react";
import { approveRequest, rejectRequest } from "./actions";

interface StudentOption {
  id: string;
  full_name: string;
  admission_number: string | null;
  className: string;
}

export interface RequestData {
  id: string;
  parentName: string;
  parentEmail: string | null;
  admissionNumber: string;
  matchedStudentId: string | null;
  createdAt: string;
}

export default function RequestRow({
  request,
  students,
}: {
  request: RequestData;
  students: StudentOption[];
}) {
  const [action, setAction] = useState<"idle" | "approving" | "rejecting">(
    "idle"
  );
  const [selectedStudentId, setSelectedStudentId] = useState(
    request.matchedStudentId ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  function handleApprove() {
    if (!selectedStudentId) {
      setFeedback({ type: "error", message: "Please select a student." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await approveRequest(request.id, selectedStudentId);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
        setAction("idle");
      } else {
        setFeedback({ type: "success", message: result.success! });
      }
    });
  }

  function handleReject() {
    setFeedback(null);
    startTransition(async () => {
      const result = await rejectRequest(request.id);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
        setAction("idle");
      } else {
        setFeedback({ type: "success", message: result.success! });
      }
    });
  }

  const norm = (v: string | null) =>
    (v ?? "").trim().toLowerCase();
  const reqAdm = norm(request.admissionNumber);

  // Prioritize matched student at top of list (case-insensitive / trim)
  const sortedStudents = [...students].sort((a, b) => {
    const aMatch = norm(a.admission_number) === reqAdm ? -1 : 0;
    const bMatch = norm(b.admission_number) === reqAdm ? -1 : 0;
    return aMatch - bMatch;
  });

  if (feedback?.type === "success") {
    return (
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4 last:border-0 dark:border-zinc-800/50">
        <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {feedback.message}
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 last:border-0 dark:border-zinc-800/50">
      <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center">
        {/* Parent info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {request.parentName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {request.parentName}
              </p>
              {request.parentEmail && (
                <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                  {request.parentEmail}
                </p>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
              </svg>
              {request.admissionNumber}
            </span>
            <span className="inline-flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              {new Date(request.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {action === "idle" && (
            <>
              <button
                onClick={() => setAction("approving")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Approve
              </button>
              <button
                onClick={() => setAction("rejecting")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                Reject
              </button>
            </>
          )}

          {action === "rejecting" && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Reject this request?
              </p>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Rejecting…" : "Confirm"}
              </button>
              <button
                onClick={() => setAction("idle")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Approve panel — student selector */}
      {action === "approving" && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-zinc-800/50 dark:bg-zinc-800/20">
          <p className="mb-2 text-xs font-medium text-slate-700 dark:text-zinc-300">
            Select the student to link to this parent:
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Select a student…</option>
              {sortedStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} — {s.className}
                  {s.admission_number ? ` (${s.admission_number})` : ""}
                  {norm(s.admission_number) === reqAdm ? " ★ Match" : ""}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={isPending || !selectedStudentId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? "Linking…" : "Confirm & Link"}
              </button>
              <button
                onClick={() => setAction("idle")}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
          {feedback?.type === "error" && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {feedback.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

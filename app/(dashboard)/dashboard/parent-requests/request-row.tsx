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

function norm(v: string | null) {
  return (v ?? "").trim().toLowerCase();
}

function resolveStudentDisplay(
  request: RequestData,
  students: StudentOption[]
) {
  const reqAdm = norm(request.admissionNumber);
  if (request.matchedStudentId) {
    const s = students.find((x) => x.id === request.matchedStudentId);
    if (s) return { name: s.full_name, className: s.className };
  }
  const byAdm = students.find((s) => norm(s.admission_number) === reqAdm);
  if (byAdm) return { name: byAdm.full_name, className: byAdm.className };
  return { name: "—", className: "—" };
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

  const { name: studentDisplayName, className: studentClassName } =
    resolveStudentDisplay(request, students);

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

  const reqAdm = norm(request.admissionNumber);

  const sortedStudents = [...students].sort((a, b) => {
    const aMatch = norm(a.admission_number) === reqAdm ? -1 : 0;
    const bMatch = norm(b.admission_number) === reqAdm ? -1 : 0;
    return aMatch - bMatch;
  });

  const requestDateLabel = new Date(request.createdAt).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  if (feedback?.type === "success") {
    return (
      <tbody className="border-b border-slate-100 dark:border-zinc-800/50">
        <tr>
          <td colSpan={6} className="px-6 py-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 shrink-0 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {feedback.message}
              </p>
            </div>
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="border-b border-slate-100 last:border-0 dark:border-zinc-800/50">
      <tr className="align-top">
        <td className="px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {request.parentName.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {request.parentName}
            </p>
          </div>
        </td>
        <td className="max-w-[10rem] px-6 py-3">
          {request.parentEmail ? (
            <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
              {request.parentEmail}
            </p>
          ) : (
            <span className="text-xs text-slate-400 dark:text-zinc-500">—</span>
          )}
        </td>
        <td className="px-6 py-3">
          <p className="text-sm text-slate-900 dark:text-white">
            {studentDisplayName}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Adm. {request.admissionNumber}
          </p>
          <div className="mt-2 sm:hidden">
            <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
              {studentClassName}
            </span>
          </div>
        </td>
        <td className="hidden px-6 py-3 sm:table-cell">
          <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
            {studentClassName}
          </span>
        </td>
        <td className="whitespace-nowrap px-6 py-3 text-xs text-slate-600 dark:text-zinc-400">
          {requestDateLabel}
        </td>
        <td className="px-6 py-3 text-right">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {action === "idle" && (
              <>
                <button
                  type="button"
                  onClick={() => setAction("approving")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setAction("rejecting")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-950/20"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18 18 6M6 6l12 12"
                    />
                  </svg>
                  Reject
                </button>
              </>
            )}

            {action === "rejecting" && (
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Reject?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isPending}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isPending ? "Rejecting…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction("idle")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>

      {action === "approving" && (
        <tr className="bg-slate-50/80 dark:bg-zinc-800/25">
          <td colSpan={6} className="px-6 py-4">
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
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending || !selectedStudentId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPending ? "Linking…" : "Confirm & Link"}
                </button>
                <button
                  type="button"
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
          </td>
        </tr>
      )}
    </tbody>
  );
}

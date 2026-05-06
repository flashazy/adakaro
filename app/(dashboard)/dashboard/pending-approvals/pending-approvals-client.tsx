"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  approvePendingStudentAction,
  rejectPendingStudentAction,
} from "./actions";
import { formatEnrollmentDateDisplay } from "@/lib/enrollment-date";

export interface PendingStudentRow {
  id: string;
  full_name: string;
  admission_number: string | null;
  date_of_birth: string | null;
  parent_phone: string | null;
  enrollment_date: string;
  avatar_url: string | null;
  created_at: string;
  class: { name: string } | null;
  capture_username: string | null;
}

function SimpleDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ageFromDob(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} yrs`;
}

export function PendingApprovalsClient({
  students,
}: {
  students: PendingStudentRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<PendingStudentRow | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="space-y-4">
      {students.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          No pending enrolments right now.
        </p>
      ) : (
        students.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
                {s.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                    {s.full_name
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-white">
                  {s.full_name}
                </p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {s.admission_number ?? "—"} · {s.class?.name ?? "Class"}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  DOB {s.date_of_birth ?? "—"} ({ageFromDob(s.date_of_birth)}) ·
                  Parent {s.parent_phone ?? "—"}
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  Captured by {s.capture_username ?? "—"} ·{" "}
                  {formatEnrollmentDateDisplay(s.created_at)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDetail(s)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                View details
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await approvePendingStudentAction(s.id);
                    if (res.error) toast.error(res.error);
                    else toast.success("Student approved.");
                  });
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectFor(s.id);
                  setRejectReason("");
                }}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 dark:border-red-900 dark:text-red-200"
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}

      <SimpleDialog
        open={detail != null}
        title="Student details"
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <ul className="space-y-2 text-sm text-slate-800 dark:text-zinc-200">
            <li>
              <span className="font-medium">Name:</span> {detail.full_name}
            </li>
            <li>
              <span className="font-medium">Admission:</span>{" "}
              {detail.admission_number ?? "—"}
            </li>
            <li>
              <span className="font-medium">Class:</span>{" "}
              {detail.class?.name ?? "—"}
            </li>
            <li>
              <span className="font-medium">Date of birth:</span>{" "}
              {detail.date_of_birth ?? "—"}
            </li>
            <li>
              <span className="font-medium">Parent phone:</span>{" "}
              {detail.parent_phone ?? "—"}
            </li>
            <li>
              <span className="font-medium">Captured by:</span>{" "}
              {detail.capture_username ?? "—"}
            </li>
            <li>
              <span className="font-medium">Captured on:</span>{" "}
              {new Date(detail.created_at).toLocaleString()}
            </li>
          </ul>
        ) : null}
      </SimpleDialog>

      <SimpleDialog
        open={rejectFor != null}
        title="Reject enrolment"
        onClose={() => setRejectFor(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rejectFor) return;
            const id = rejectFor;
            startTransition(async () => {
              const res = await rejectPendingStudentAction(
                id,
                rejectReason.trim() || null
              );
              if (res.error) toast.error(res.error);
              else toast.success("Rejected.");
              setRejectFor(null);
              setRejectReason("");
            });
          }}
        >
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Optional note for the person who captured this student.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectFor(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </form>
      </SimpleDialog>
    </div>
  );
}

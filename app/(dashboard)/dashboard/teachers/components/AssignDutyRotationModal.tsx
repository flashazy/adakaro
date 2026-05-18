"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeDutyEndDate } from "@/lib/teacher-on-duty/teacher-duty";
import type { TeacherActionState } from "../types";
import type { TeacherRow } from "../teachers-page-client";

function teacherInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function formatPreviewDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  return `${d} ${months[m - 1]} ${y}`;
}

function renderFlash(state: TeacherActionState | null) {
  if (!state) return null;
  if (state.ok && state.message) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        {state.message}
      </p>
    );
  }
  if (!state.ok) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
        {state.error}
      </p>
    );
  }
  return null;
}

export function AssignDutyRotationModal(props: {
  teachers: TeacherRow[];
  onClose: () => void;
  formAction: (formData: FormData) => void;
  pending: boolean;
  flash: TeacherActionState | null;
}) {
  const { teachers, onClose, formAction, pending, flash } = props;
  const today = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(today);
  const [durationDays, setDurationDays] = useState(7);
  const [notes, setNotes] = useState("");

  const endDate = useMemo(
    () => computeDutyEndDate(startDate, Math.max(1, durationDays)),
    [startDate, durationDays]
  );

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => t.fullName.toLowerCase().includes(q));
  }, [teachers, search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleTeacher = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const preview =
    selected.size > 0
      ? `${selected.size} teacher${selected.size === 1 ? "" : "s"} will be on duty from ${formatPreviewDate(startDate)} to ${formatPreviewDate(endDate)}.`
      : "Select teacher(s) to see the assignment preview.";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-duty-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-school-primary/10 text-school-primary dark:bg-school-primary/20">
              <CalendarRange className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2
                id="assign-duty-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                Assign duty rotation
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                Only teachers who have logged in at least once appear here.
                Pending accounts are excluded.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {renderFlash(flash)}

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                Teachers on duty
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teachers…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                />
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-zinc-700">
                {filteredTeachers.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-slate-500">
                    {teachers.length === 0
                      ? "No active teachers yet. Teachers must complete their first login before they can be assigned to duty."
                      : "No teachers match your search."}
                  </p>
                ) : (
                  filteredTeachers.map((t) => {
                    const checked = selected.has(t.userId);
                    return (
                      <label
                        key={t.userId}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                          checked
                            ? "bg-school-primary/10 dark:bg-school-primary/15"
                            : "hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                        )}
                      >
                        <input
                          type="checkbox"
                          name="teacher_ids"
                          value={t.userId}
                          checked={checked}
                          onChange={() => toggleTeacher(t.userId)}
                          className="h-4 w-4 rounded border-slate-300 text-school-primary focus:ring-school-primary"
                        />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {teacherInitials(t.fullName)}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">
                          {t.fullName}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Start date
                </span>
                <input
                  type="date"
                  name="start_date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:[color-scheme:dark]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                  Duration (days)
                </span>
                <input
                  type="number"
                  name="duration_days"
                  required
                  min={1}
                  max={30}
                  value={durationDays}
                  onChange={(e) =>
                    setDurationDays(
                      Math.min(30, Math.max(1, Number(e.target.value) || 1))
                    )
                  }
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
                />
              </label>
            </div>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-zinc-800/60 dark:text-zinc-300">
              End date:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatPreviewDate(endDate)}
              </span>
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                Notes (optional)
              </span>
              <textarea
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Morning shift duty"
                className="resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              />
            </label>

            <p className="rounded-lg border border-dashed border-school-primary/30 bg-school-primary/5 px-3 py-2 text-sm text-school-primary dark:border-school-primary/40 dark:bg-school-primary/10">
              {preview}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || selected.size === 0}
              className="rounded-lg bg-school-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Assigning…" : "Assign duty"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { REPORT_TERM_OPTIONS } from "@/app/(dashboard)/teacher-dashboard/report-cards/constants";
import {
  showAdminErrorToast,
  useOptionalDashboardFeedback,
} from "@/components/dashboard/dashboard-feedback-provider";
import {
  upsertClassReportSettings,
  type ClassReportSettingsActionState,
} from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-school-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Saving...
        </>
      ) : (
        "Save settings"
      )}
    </button>
  );
}

export type CoordinatorClassOption = { id: string; name: string };

export type InitialSettings = {
  closing_date: string | null;
  opening_date: string | null;
  coordinator_message: string | null;
  required_items: string[] | null;
} | null;

const initialAction: ClassReportSettingsActionState = {};

export function ReportSettingsClient({
  classes,
  term,
  academicYear,
  selectedClassId,
  initialSettings,
}: {
  classes: CoordinatorClassOption[];
  term: "Term 1" | "Term 2";
  academicYear: string;
  selectedClassId: string;
  initialSettings: InitialSettings;
}) {
  const router = useRouter();
  const feedback = useOptionalDashboardFeedback();
  const [state, formAction] = useActionState(
    upsertClassReportSettings,
    initialAction
  );
  const [items, setItems] = useState<string[]>(() => {
    const r = initialSettings?.required_items;
    if (r && r.length > 0) return [...r];
    return [""];
  });

  const yearDropdown = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1].map(String);
  }, []);

  useEffect(() => {
    if (state.error) {
      showAdminErrorToast(state.error);
    } else if (state.success) {
      toast.success(state.success, {
        duration: 2000,
        id: "coordinator-report-settings-save",
      });
    }
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Class
          </span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            value={selectedClassId}
            onChange={(e) => {
              const id = e.target.value;
              feedback?.startNavigation();
              router.push(
                `/teacher-dashboard/coordinator/report-settings?classId=${encodeURIComponent(id)}&term=${encodeURIComponent(term)}&year=${encodeURIComponent(academicYear)}`
              );
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Term
          </span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            value={term}
            onChange={(e) => {
              const t = e.target.value;
              feedback?.startNavigation();
              router.push(
                `/teacher-dashboard/coordinator/report-settings?classId=${encodeURIComponent(selectedClassId)}&term=${encodeURIComponent(t)}&year=${encodeURIComponent(academicYear)}`
              );
            }}
          >
            {REPORT_TERM_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            Academic year
          </span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            value={academicYear}
            onChange={(e) => {
              const y = e.target.value;
              feedback?.startNavigation();
              router.push(
                `/teacher-dashboard/coordinator/report-settings?classId=${encodeURIComponent(selectedClassId)}&term=${encodeURIComponent(term)}&year=${encodeURIComponent(y)}`
              );
            }}
          >
            {yearDropdown.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedClassId ? (
        <form
          key={`${selectedClassId}-${term}-${academicYear}`}
          action={formAction}
          className="space-y-6"
        >
          <input type="hidden" name="class_id" value={selectedClassId} />
          <input type="hidden" name="term" value={term} />
          <input type="hidden" name="academic_year" value={academicYear} />
          <input
            type="hidden"
            name="required_items_json"
            value={JSON.stringify(items.map((s) => s.trim()).filter(Boolean))}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Term dates
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              These appear on student report cards under School Calendar.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  Closing date
                </span>
                <input
                  type="date"
                  name="closing_date"
                  defaultValue={initialSettings?.closing_date ?? ""}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-zinc-300">
                  Opening date
                </span>
                <input
                  type="date"
                  name="opening_date"
                  defaultValue={initialSettings?.opening_date ?? ""}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Coordinator message
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Up to 500 characters. Line breaks are preserved on the report card.
            </p>
            <textarea
              name="coordinator_message"
              rows={5}
              maxLength={500}
              defaultValue={initialSettings?.coordinator_message ?? ""}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Required items for next term
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              List items students must bring next term (e.g. books, uniform, supplies). Add one item per line. Do not repeat these items in the coordinator message.
            </p>
            <ul className="mt-4 space-y-2">
              {items.map((val, idx) => (
                <li key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = e.target.value;
                      setItems(next);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                    placeholder="e.g. Exercise books — Maths"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setItems(items.filter((_, i) => i !== idx));
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-school-primary hover:bg-slate-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              onClick={() => setItems([...items, ""])}
            >
              + Add item
            </button>
          </section>

          <SubmitButton />
        </form>
      ) : null}
    </div>
  );
}

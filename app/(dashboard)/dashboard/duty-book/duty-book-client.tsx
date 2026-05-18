"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, LayoutGrid, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttendanceRollupChips } from "@/components/attendance/attendance-rollup-chips";
import { loadDutyBookDataAction } from "./actions";
import {
  genderViewLabel,
  getDutyBookView,
} from "@/lib/duty-book/duty-book-gender";
import type {
  DutyBookReportPayload,
  DutyBookReportPermissions,
} from "@/lib/duty-book/duty-book-report-types";
import type { DutyBookGenderFilter, DutyBookPayload } from "@/lib/duty-book/types";
import {
  ILL_STATUS_DISPLAY,
  ILL_STATUS_DISPLAY_LOWER,
} from "@/lib/student-attendance-status";
import type { ActiveDutyTeacher } from "@/lib/teacher-on-duty/types";
import { DutyBookClassTable } from "./duty-book-class-table";
import { DutyBookReportSection } from "./duty-book-report-section";
import { DutyBookTodBanner } from "./duty-book-tod-banner";

const GENDER_FILTER_OPTIONS: {
  value: DutyBookGenderFilter;
  label: string;
  icon: string;
}[] = [
  { value: "all", label: "All", icon: "👥" },
  { value: "boys", label: "Boys", icon: "👦" },
  { value: "girls", label: "Girls", icon: "👧" },
];

const fieldControlClass =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white dark:[color-scheme:dark]";

function formatDisplayDate(isoDate: string) {
  const [ys, ms, ds] = isoDate.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return isoDate;
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard(props: {
  label: string;
  value: number;
  accent?: "default" | "green" | "red" | "orange" | "blue";
}) {
  const { label, value, accent = "default" } = props;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          accent === "green" && "text-green-700 dark:text-green-400",
          accent === "red" && "text-red-700 dark:text-red-400",
          accent === "orange" && "text-orange-700 dark:text-orange-400",
          accent === "blue" && "text-blue-700 dark:text-blue-400",
          accent === "default" && "text-slate-900 dark:text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DutyBookClient(props: {
  initialData: DutyBookPayload;
  initialReport: DutyBookReportPayload;
  initialReportPermissions: DutyBookReportPermissions;
  canExport?: boolean;
  activeDutyTeachers?: ActiveDutyTeacher[];
  backHref?: string;
}) {
  const [data, setData] = useState(props.initialData);
  const canExport = props.canExport ?? false;
  const backHref = props.backHref ?? "/dashboard/students";
  const [genderFilter, setGenderFilter] =
    useState<DutyBookGenderFilter>("all");
  const [date, setDate] = useState(props.initialData.views.all.summary.date);
  const [viewByClass, setViewByClass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const refresh = useCallback((nextDate: string) => {
    setError(null);
    startTransition(async () => {
      const res = await loadDutyBookDataAction(nextDate);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData(res.data);
      setDate(res.data.views.all.summary.date);
    });
  }, []);

  const activeView = useMemo(
    () => getDutyBookView(data, genderFilter),
    [data, genderFilter]
  );

  const handleDateChange = (next: string) => {
    setDate(next);
    if (next) refresh(next);
  };

  const downloadExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    setError(null);
    try {
      const params = new URLSearchParams({
        date,
        format,
        gender: genderFilter,
      });
      const res = await fetch(`/api/duty-book/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `duty-book-${date}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Check your connection and try again.");
    } finally {
      setExporting(null);
    }
  };

  const { summary } = activeView;
  const isToday = date === todayIso();
  const genderScoped = genderFilter !== "all";

  return (
    <div className="space-y-6">
      {props.activeDutyTeachers && props.activeDutyTeachers.length > 0 ? (
        <DutyBookTodBanner activeTeachers={props.activeDutyTeachers} />
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                  Date
                </span>
                <input
                  type="date"
                  value={date}
                  max={todayIso()}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={isPending}
                  className={fieldControlClass}
                />
              </label>
              {isToday ? (
                <span className="mb-0.5 rounded-full bg-school-primary/10 px-3 py-1.5 text-xs font-semibold text-school-primary dark:bg-school-primary/20">
                  Today
                </span>
              ) : null}
            </div>
            <select
              value={genderFilter}
              onChange={(e) =>
                setGenderFilter(e.target.value as DutyBookGenderFilter)
              }
              disabled={isPending}
              aria-label="Gender"
              className={cn(
                fieldControlClass,
                "min-w-[11.5rem] cursor-pointer sm:mb-0",
                genderFilter !== "all" &&
                  "border-school-primary/40 ring-1 ring-school-primary/20"
              )}
            >
              {GENDER_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.icon} {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <button
            type="button"
            onClick={() => setViewByClass((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              viewByClass
                ? "border-school-primary bg-school-primary/10 text-school-primary dark:bg-school-primary/20"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            )}
          >
            {viewByClass ? (
              <Table2 className="h-4 w-4" aria-hidden />
            ) : (
              <LayoutGrid className="h-4 w-4" aria-hidden />
            )}
              {viewByClass ? "Hide class breakdown" : "View by class"}
            </button>
            {canExport ? (
              <>
                <button
                  type="button"
                  disabled={!!exporting || isPending}
                  onClick={() => void downloadExport("csv")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {exporting === "csv" ? "Exporting…" : "CSV"}
                </button>
                <button
                  type="button"
                  disabled={!!exporting || isPending}
                  onClick={() => void downloadExport("pdf")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {exporting === "pdf" ? "Exporting…" : "PDF"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {isPending ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Updating…</p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          School summary · {formatDisplayDate(summary.date)}
          {genderScoped ? (
            <span className="ml-2 font-normal text-school-primary">
              ({genderViewLabel(genderFilter)})
            </span>
          ) : null}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
          {genderScoped
            ? `Counts include only ${genderFilter === "boys" ? "male" : "female"} students for this date (excused absences shown separately).`
            : `Registered students for this date; unmarked students count as absent unless flagged ${ILL_STATUS_DISPLAY_LOWER} or permitted.`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Registered" value={summary.registered} />
          {genderFilter !== "girls" ? (
            <StatCard label="Boys" value={summary.boys} />
          ) : null}
          {genderFilter !== "boys" ? (
            <StatCard label="Girls" value={summary.girls} />
          ) : null}
          <StatCard label="Present" value={summary.present} accent="green" />
          <StatCard
            label="Absent"
            value={summary.absent}
            accent="red"
          />
          <StatCard label={ILL_STATUS_DISPLAY} value={summary.ill} accent="orange" />
          <StatCard label="Permitted" value={summary.permitted} accent="blue" />
        </div>
        <div className="mt-4">
          <AttendanceRollupChips
            counts={{
              present: summary.present,
              absent: summary.absent,
              ill: summary.ill,
              permitted: summary.permitted,
              late: summary.late,
            }}
          />
        </div>
      </section>

      {viewByClass ? (
        <DutyBookClassTable
          classes={activeView.classes}
          genderFilter={genderFilter}
          date={date}
          disabled={isPending}
          canExport={canExport}
          onExportError={setError}
        />
      ) : null}

      <DutyBookReportSection
        reportDate={date}
        initial={props.initialReport}
        initialPermissions={props.initialReportPermissions}
        disabled={isPending}
      />

      <p className="text-xs text-slate-500 dark:text-zinc-400">
        <Link
          href={backHref}
          className="font-medium text-school-primary hover:underline"
        >
          ← Back
        </Link>
      </p>
    </div>
  );
}

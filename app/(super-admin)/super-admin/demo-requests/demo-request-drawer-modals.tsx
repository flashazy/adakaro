"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  showAdminErrorToast,
  showAdminSuccessToast,
} from "@/components/dashboard/dashboard-feedback-provider";
import {
  pipelineStageBadgeClass,
  TIMELINE_FILTER_ACTIVE_STYLES,
} from "@/lib/demo-requests/pipeline-stage-styles";
import type { DemoRequestRow } from "@/lib/demo-requests/types";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  Mail,
  Phone,
  Trophy,
  X,
} from "lucide-react";

export interface ContactModalLead {
  id: string;
  school_name: string;
  full_name: string;
  phone: string;
  email: string | null;
}

export interface ContactModalContext {
  score: number;
  scoreTier: string;
  priority: string;
  status: DemoRequestRow["status"];
  lastActivity: string;
}

function contactInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatContactActivityDisplay(summary: string): string {
  return formatContactActivityLine(summary);
}

function formatContactActivityLine(summary: string): string {
  if (summary === "No activity yet") return summary;

  const timeSuffix =
    /(just now|\d+ hours? ago|today|yesterday|\d+ days ago)$/.exec(summary);
  if (!timeSuffix || timeSuffix.index === undefined) return summary;

  const label = summary.slice(0, timeSuffix.index).trim();
  return `${label} • ${timeSuffix[1]}`;
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "High":
      return "bg-red-50 text-red-800 ring-red-200";
    case "Medium":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

function ContactModalShell({
  title,
  icon: Icon,
  iconClassName,
  fullName,
  schoolName,
  onClose,
  children,
}: {
  title: string;
  icon: typeof Phone;
  iconClassName: string;
  fullName: string;
  schoolName: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="contact-modal-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  iconClassName
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </div>
              <h2 id="contact-modal-title" className="text-lg font-bold text-slate-900">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-semibold text-indigo-600">
              {contactInitials(fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {fullName}
              </p>
              <p className="truncate text-xs text-slate-500">{schoolName}</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ContactValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ContactContextStrip({ context }: { context: ContactModalContext }) {
  const badgeBase =
    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn(badgeBase, "bg-indigo-50 text-indigo-800 ring-indigo-200")}>
        {context.score} {context.scoreTier}
      </span>
      <span className={cn(badgeBase, priorityBadgeClass(context.priority))}>
        {context.priority} Priority
      </span>
      <span className={cn(badgeBase, pipelineStageBadgeClass(context.status))}>
        {context.status}
      </span>
    </div>
  );
}

function ContactLastActivity({ line }: { line: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Last Activity
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{line}</p>
    </div>
  );
}

function ContactLogSuccess({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-6 w-6" strokeWidth={2} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-emerald-700">{message}</p>
    </div>
  );
}

type ContactModalPhase = "idle" | "marking" | "success";

function useContactLogFlow(
  onMark: () => Promise<boolean>,
  onClose: () => void,
  successMessage: string
) {
  const [phase, setPhase] = useState<ContactModalPhase>("idle");
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleMark = useCallback(async () => {
    setPhase("marking");
    try {
      const ok = await onMark();
      if (ok) {
        setPhase("success");
        closeTimerRef.current = window.setTimeout(() => onClose(), 1000);
      } else {
        setPhase("idle");
      }
    } catch {
      setPhase("idle");
    }
  }, [onMark, onClose]);

  if (phase === "success") {
    return { phase, handleMark, successView: <ContactLogSuccess message={successMessage} /> };
  }

  return { phase, handleMark, successView: null };
}

export function CallSchoolModal({
  lead,
  context,
  onClose,
  onMarkCalled,
}: {
  lead: Pick<ContactModalLead, "school_name" | "full_name" | "phone">;
  context: ContactModalContext;
  onClose: () => void;
  onMarkCalled: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const telHref = `tel:${lead.phone.replace(/\s+/g, "")}`;
  const { phase, handleMark, successView } = useContactLogFlow(
    onMarkCalled,
    onClose,
    "✓ Call logged"
  );

  const copyNumber = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lead.phone);
      setCopied(true);
      showAdminSuccessToast("Phone number copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAdminErrorToast("Could not copy number.");
    }
  }, [lead.phone]);

  return (
    <ContactModalShell
      title="Call School"
      icon={Phone}
      iconClassName="bg-cyan-50 text-cyan-600"
      fullName={lead.full_name}
      schoolName={lead.school_name}
      onClose={onClose}
    >
      {successView ?? (
        <>
          <ContactValueRow label="Phone Number" value={lead.phone} />

          <div className="mt-3 space-y-2.5">
            <ContactContextStrip context={context} />
            <ContactLastActivity line={context.lastActivity} />
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <a
              href={telHref}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Call with Device
            </a>
            <button
              type="button"
              onClick={() => void copyNumber()}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy Number"}
            </button>
            <button
              type="button"
              onClick={() => void handleMark()}
              disabled={phase === "marking"}
              className="w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            >
              {phase === "marking" ? "Logging…" : "Mark as Called"}
            </button>
          </div>
        </>
      )}
    </ContactModalShell>
  );
}

export function EmailSchoolModal({
  lead,
  context,
  onClose,
  onMarkEmailed,
}: {
  lead: Pick<ContactModalLead, "school_name" | "full_name" | "email"> & {
    email: string;
  };
  context: ContactModalContext;
  onClose: () => void;
  onMarkEmailed: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const mailtoHref = `mailto:${lead.email}`;
  const { phase, handleMark, successView } = useContactLogFlow(
    onMarkEmailed,
    onClose,
    "✓ Email logged"
  );

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lead.email);
      setCopied(true);
      showAdminSuccessToast("Email copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showAdminErrorToast("Could not copy email.");
    }
  }, [lead.email]);

  return (
    <ContactModalShell
      title="Email School"
      icon={Mail}
      iconClassName="bg-blue-50 text-blue-600"
      fullName={lead.full_name}
      schoolName={lead.school_name}
      onClose={onClose}
    >
      {successView ?? (
        <>
          <ContactValueRow label="Email Address" value={lead.email} />

          <div className="mt-3 space-y-2.5">
            <ContactContextStrip context={context} />
            <ContactLastActivity line={context.lastActivity} />
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <a
              href={mailtoHref}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Open in Mail App
            </a>
            <button
              type="button"
              onClick={() => void copyEmail()}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied" : "Copy Email"}
            </button>
            <button
              type="button"
              onClick={() => void handleMark()}
              disabled={phase === "marking"}
              className="w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            >
              {phase === "marking" ? "Logging…" : "Mark as Emailed"}
            </button>
          </div>
        </>
      )}
    </ContactModalShell>
  );
}

export interface WinCelebrationData {
  schoolName: string;
  score: number;
  revenueLabel: string;
  conversionDays: number;
}

export function WinCelebrationModal({
  data,
  onClose,
}: {
  data: WinCelebrationData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        aria-label="Close celebration"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="win-modal-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 py-8 text-center text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Trophy className="h-8 w-8 text-white" strokeWidth={2} aria-hidden />
          </div>
          <p className="mt-4 text-3xl" aria-hidden>
            🎉
          </p>
          <h2 id="win-modal-title" className="mt-2 text-2xl font-bold tracking-tight">
            School Converted
          </h2>
          <p className="mt-2 text-sm font-medium text-emerald-50">
            {data.schoolName} is now an Adakaro customer.
          </p>
        </div>

        <div className="px-6 py-5">
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Lead Score
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {data.score}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Revenue
              </dt>
              <dd className="mt-1 text-sm font-bold leading-tight text-slate-900">
                {data.revenueLabel}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Conversion
              </dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {data.conversionDays}
                <span className="text-sm font-medium text-slate-500">d</span>
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/super-admin/create"
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-md hover:bg-emerald-500"
            >
              Create School Workspace
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" aria-hidden />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FLAG_TONE: Record<"red" | "amber" | "green", string> = {
  red: "border-red-200 bg-red-50 text-red-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function AttentionFlagsRow({
  flags,
}: {
  flags: Array<{
    emoji: string;
    label: string;
    detail: string;
    tone: "red" | "amber" | "green";
  }>;
}) {
  if (flags.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {flags.map((flag) => (
        <div
          key={flag.label}
          className={cn(
            "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm",
            FLAG_TONE[flag.tone]
          )}
        >
          <span className="text-base leading-none" aria-hidden>
            {flag.emoji}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{flag.label}</p>
            <p className="mt-0.5 text-xs opacity-90">{flag.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NextDeadlineCard({
  deadline,
}: {
  deadline: {
    label: string;
    detail: string;
    isOverdue: boolean;
    isToday: boolean;
  };
}) {
  const isUrgent = deadline.isOverdue || deadline.isToday;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        deadline.isOverdue
          ? "border-red-200 bg-red-50"
          : isUrgent
            ? "border-amber-200 bg-amber-50"
            : "border-slate-200 bg-slate-50/60"
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          deadline.isOverdue
            ? "text-red-600"
            : isUrgent
              ? "text-amber-700"
              : "text-slate-500"
        )}
      >
        Next Deadline
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold",
          deadline.isOverdue
            ? "text-red-900"
            : isUrgent
              ? "text-amber-900"
              : "text-slate-900"
        )}
      >
        {deadline.label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm",
          deadline.isOverdue
            ? "text-red-700"
            : isUrgent
              ? "text-amber-800"
              : "text-slate-600"
        )}
      >
        {deadline.detail}
      </p>
    </div>
  );
}

const TIMELINE_FILTERS = [
  { id: "all", label: "All" },
  { id: "calls", label: "Calls" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "emails", label: "Emails" },
  { id: "meetings", label: "Meetings" },
  { id: "notes", label: "Notes" },
] as const;

export function TimelineFilterBar({
  value,
  onChange,
}: {
  value: (typeof TIMELINE_FILTERS)[number]["id"];
  onChange: (value: (typeof TIMELINE_FILTERS)[number]["id"]) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {TIMELINE_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange(filter.id)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition",
            value === filter.id
              ? TIMELINE_FILTER_ACTIVE_STYLES[filter.id]
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

export function CollapsibleSection({
  id,
  title,
  expanded,
  onToggle,
  children,
  className,
  headerClassName,
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-slate-200/80 bg-white", className)}>
      <button
        type="button"
        id={`section-${id}`}
        aria-expanded={expanded}
        aria-controls={`section-panel-${id}`}
        onClick={() => onToggle(id)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80",
          headerClassName
        )}
      >
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-800">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div
          id={`section-panel-${id}`}
          role="region"
          aria-labelledby={`section-${id}`}
          className="border-t border-slate-100 px-4 pb-4 pt-1"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function NoteTemplateChips({
  templates,
  onSelect,
}: {
  templates: readonly string[];
  onSelect: (text: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {templates.map((template) => (
        <button
          key={template}
          type="button"
          onClick={() => onSelect(template)}
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        >
          {template}
        </button>
      ))}
    </div>
  );
}

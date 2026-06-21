"use client";

import Image from "next/image";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { formatShortLocaleDate } from "@/lib/format-date";
import { binaryPlanLabel } from "@/lib/plans";
import { formatSchoolLastActivity } from "@/lib/super-admin/school-health";
import { schoolLifecycleStatusBadgeClass } from "@/lib/super-admin/school-lifecycle";
import type {
  ConfidenceLevel,
  PriorityLevel,
  SchoolCommandCenterPayload,
} from "@/lib/super-admin/school-command-center";
import {
  commandCenterHealthBarColor,
  commandCenterHealthDotColor,
  commandCenterHealthTextColor,
  commandCenterRiskBadgeClass,
  commandCenterRiskDotColor,
  commandCenterRiskTextColor,
  lifecycleStatusDisplay,
} from "@/lib/super-admin/school-command-center";
import type { ExecutiveStatusLevel } from "@/lib/super-admin/school-command-center";
import {
  ContactSchoolMenu,
  CopyButton,
  ScoreDot,
  ThemedEmptyPanel,
} from "./school-command-center-shared";
import {
  buildSchoolBroadcastHref,
  buildSchoolContactsHref,
} from "@/lib/super-admin/smart-intelligence-navigation";
import {
  SuperAdminLoadingButton,
  SuperAdminNavLink,
} from "@/components/super-admin/super-admin-loading-action";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
  saKpiCaption,
  saKpiLabel,
  saKpiValue,
  saKpiCard,
  saSection,
  saStatusBadge,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock3,
  Flame,
  GraduationCap,
  Mail,
  MessageSquare,
  Phone,
  Trophy,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  InvitationRow,
  MemberRow,
  SchoolDetail,
  StudentRow,
} from "./school-detail-client";

function schoolInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDaysAgo(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatMaybeDate(iso: string | null): string {
  if (!iso) return "Never";
  return formatShortLocaleDate(iso);
}

const saBtnGhostSm =
  "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100";

function KpiWithCaption({
  label,
  value,
  caption,
  target,
}: {
  label: string;
  value: string | number;
  caption: string;
  target?: string;
}) {
  return (
    <div className={cn(saKpiCard, "min-w-[9rem] shrink-0 snap-start sm:min-w-0")}>
      <p className={saKpiLabel}>{label}</p>
      <p className={saKpiValue}>{value}</p>
      {target ? (
        <p className="mt-1 text-[11px] font-medium text-indigo-600/90">{target}</p>
      ) : null}
      <p className={saKpiCaption}>{caption}</p>
    </div>
  );
}

function CommandCard({
  title,
  children,
  className,
  confidence,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  confidence?: ConfidenceLevel;
}) {
  return (
    <section className={cn(saSection, "flex h-full flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {confidence ? <ConfidenceLabel level={confidence} /> : null}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function ConfidenceLabel({ level }: { level: ConfidenceLevel }) {
  const tone =
    level === "High"
      ? "text-emerald-700"
      : level === "Medium"
        ? "text-amber-700"
        : "text-slate-500";

  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      Confidence:{" "}
      <span className={tone}>{level}</span>
    </span>
  );
}

function PriorityBadge({
  level,
  label,
}: {
  level: PriorityLevel;
  label: string;
}) {
  const config: Record<
    PriorityLevel,
    { icon: LucideIcon; className: string }
  > = {
    immediate: {
      icon: Flame,
      className: "bg-red-50 text-red-800 ring-red-200",
    },
    follow_up: {
      icon: AlertTriangle,
      className: "bg-amber-50 text-amber-900 ring-amber-200",
    },
    stable: {
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    },
    champion: {
      icon: Trophy,
      className: "bg-indigo-50 text-indigo-900 ring-indigo-200",
    },
  };

  const { icon: Icon, className } = config[level];

  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Priority Level
      </p>
      <span
        className={cn(
          "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
          className
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </span>
    </div>
  );
}

function ExecutiveStatusBadge({
  level,
  label,
}: {
  level: ExecutiveStatusLevel;
  label: string;
}) {
  const config: Record<
    ExecutiveStatusLevel,
    { dot: string; className: string }
  > = {
    needs_intervention: {
      dot: "bg-red-500",
      className: "bg-red-50 text-red-800 ring-red-200",
    },
    requires_follow_up: {
      dot: "bg-amber-500",
      className: "bg-amber-50 text-amber-900 ring-amber-200",
    },
    healthy: {
      dot: "bg-emerald-500",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    },
  };

  const { dot, className } = config[level];

  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Executive Status
      </p>
      <span
        className={cn(
          "mt-1.5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
          className
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
        {label}
      </span>
    </div>
  );
}

function EmptyPanel({
  title,
  description,
  recommendation,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  icon,
  theme = "neutral",
  impact,
}: {
  title: string;
  description: string;
  recommendation?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  icon: LucideIcon;
  theme?: "neutral" | "blue" | "purple" | "amber";
  impact?: string;
}) {
  return (
    <ThemedEmptyPanel
      title={title}
      description={description}
      impact={impact}
      recommendation={recommendation}
      primaryLabel={primaryLabel}
      secondaryLabel={secondaryLabel}
      onPrimary={onPrimary}
      onSecondary={onSecondary}
      icon={icon}
      theme={theme}
    />
  );
}

export function SchoolCommandCenterView({
  school,
  commandCenter,
  members,
  students,
  invitations,
  onUpgradePlan,
  onEditSchool,
  onOpenWorkspace,
  workspaceOpening,
}: {
  school: SchoolDetail;
  commandCenter: SchoolCommandCenterPayload;
  members: MemberRow[];
  students: StudentRow[];
  invitations: InvitationRow[];
  onUpgradePlan: () => void;
  onEditSchool: () => void;
  onOpenWorkspace: () => void;
  workspaceOpening: boolean;
}) {
  const navCtx = {
    schoolId: school.id,
    schoolName: school.name,
    source: "general" as const,
    riskLevel: commandCenter.risk.level.toLowerCase(),
  };

  const contactsHref = buildSchoolContactsHref(navCtx);
  const broadcastHref = buildSchoolBroadcastHref(navCtx);

  const admins = members.filter((m) => m.role === "admin");
  const primaryAdmin =
    admins.find((m) => m.user_id === school.created_by) ?? admins[0] ?? null;
  const contactEmail = primaryAdmin?.email ?? null;
  const contactPhone = primaryAdmin?.phone ?? null;

  const suspended = school.status === "suspended";
  const lifecycleLabel = lifecycleStatusDisplay(commandCenter.schoolStatus);
  const heroRef = useRef<HTMLElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const node = heroRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: "-68px 0px 0px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-6">
      <StickyExecutiveBar
        visible={showStickyBar}
        school={school}
        commandCenter={commandCenter}
        lifecycleLabel={lifecycleLabel}
        suspended={suspended}
        contactsHref={contactsHref}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        onOpenWorkspace={onOpenWorkspace}
        workspaceOpening={workspaceOpening}
      />

      <SchoolCommandHero
        ref={heroRef}
        school={school}
        commandCenter={commandCenter}
        lifecycleLabel={lifecycleLabel}
        suspended={suspended}
        contactsHref={contactsHref}
        broadcastHref={broadcastHref}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        onUpgradePlan={onUpgradePlan}
        onEditSchool={onEditSchool}
        onOpenWorkspace={onOpenWorkspace}
        workspaceOpening={workspaceOpening}
      />

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-6">
        <KpiWithCaption
          label="Students"
          value={commandCenter.kpis.students}
          target={commandCenter.kpis.studentTarget}
          caption={commandCenter.kpis.studentHelper}
        />
        <KpiWithCaption
          label="Admins"
          value={commandCenter.kpis.admins}
          target={commandCenter.kpis.adminTarget}
          caption={commandCenter.kpis.adminHelper}
        />
        <KpiWithCaption
          label="Teachers"
          value={commandCenter.kpis.teachers}
          target={commandCenter.kpis.teacherTarget}
          caption={commandCenter.kpis.teacherHelper}
        />
        <KpiWithCaption
          label="Parents"
          value={commandCenter.kpis.parents}
          caption={commandCenter.kpis.parentHelper}
        />
        <KpiWithCaption
          label="Revenue"
          value={commandCenter.kpis.revenueLabel}
          target={commandCenter.kpis.revenueTarget}
          caption={commandCenter.kpis.revenueHelper}
        />
        <KpiWithCaption
          label="Platform Activity"
          value={commandCenter.kpis.platformActivity}
          target={commandCenter.kpis.activityTarget}
          caption={commandCenter.kpis.activityHelper}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SchoolHealthCard commandCenter={commandCenter} />
        <SchoolRiskCard commandCenter={commandCenter} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SchoolTimelineCard timeline={commandCenter.timeline} />
        <SchoolActivityCard activity={commandCenter.activity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminTeamCard
          admins={admins}
          primaryAdmin={primaryAdmin}
          contactsHref={contactsHref}
          broadcastHref={broadcastHref}
        />
        <StudentOverviewCard
          overview={commandCenter.studentOverview}
          students={students}
          contactsHref={contactsHref}
          broadcastHref={broadcastHref}
          onOpenWorkspace={onOpenWorkspace}
        />
      </div>

      <NextBestActionCard
        commandCenter={commandCenter}
        contactsHref={contactsHref}
        broadcastHref={broadcastHref}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CommunicationHistoryCard
          communication={commandCenter.communication}
          communicationHealth={commandCenter.communicationHealth}
        />
        <IntelligencePanel
          commandCenter={commandCenter}
          broadcastHref={broadcastHref}
        />
      </div>

      <SchoolSummaryFooter commandCenter={commandCenter} />
    </div>
  );
}

function StickyExecutiveBar({
  visible,
  school,
  commandCenter,
  lifecycleLabel,
  suspended,
  contactsHref,
  contactEmail,
  contactPhone,
  onOpenWorkspace,
  workspaceOpening,
}: {
  visible: boolean;
  school: SchoolDetail;
  commandCenter: SchoolCommandCenterPayload;
  lifecycleLabel: string;
  suspended: boolean;
  contactsHref: string;
  contactEmail: string | null;
  contactPhone: string | null;
  onOpenWorkspace: () => void;
  workspaceOpening: boolean;
}) {
  const healthScore = commandCenter.health.score;
  const riskScore = commandCenter.risk.score;

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-[4.25rem] z-40 border-b border-slate-200 bg-white/95 shadow-md backdrop-blur-md transition-all duration-300 supports-[backdrop-filter]:bg-white/90",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0"
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold uppercase tracking-tight text-slate-900">
            {school.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>{binaryPlanLabel(school.plan)} Plan</span>
            <span className="text-slate-300">·</span>
            <span>{suspended ? "Suspended" : lifecycleLabel}</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <ScoreDot className={commandCenterHealthDotColor(healthScore)} />
              Health {healthScore}/100
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <ScoreDot className={commandCenterRiskDotColor(riskScore)} />
              Risk {riskScore}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SuperAdminLoadingButton
            type="button"
            loading={workspaceOpening}
            loadingLabel="Opening…"
            onClick={onOpenWorkspace}
            className={saBtnPrimarySm}
          >
            Open Workspace
          </SuperAdminLoadingButton>
          <ContactSchoolMenu
            email={contactEmail}
            phone={contactPhone}
            contactsHref={contactsHref}
          />
        </div>
      </div>
    </div>
  );
}

const SchoolCommandHero = forwardRef<
  HTMLElement,
  {
    school: SchoolDetail;
    commandCenter: SchoolCommandCenterPayload;
    lifecycleLabel: string;
    suspended: boolean;
    contactsHref: string;
    broadcastHref: string;
    contactEmail: string | null;
    contactPhone: string | null;
    onUpgradePlan: () => void;
    onEditSchool: () => void;
    onOpenWorkspace: () => void;
    workspaceOpening: boolean;
  }
>(function SchoolCommandHero(
  {
    school,
    commandCenter,
    lifecycleLabel,
    suspended,
    contactsHref,
    broadcastHref,
    contactEmail,
    contactPhone,
    onUpgradePlan,
    onEditSchool,
    onOpenWorkspace,
    workspaceOpening,
  },
  ref
) {
  const healthScore = commandCenter.health.score;
  const riskScore = commandCenter.risk.score;

  return (
    <header
      ref={ref}
      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/50 p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
            School Command Center
          </p>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Monitor school health, risk, onboarding progress and platform engagement.
          </p>
          <h1 className="mt-3 text-2xl font-bold uppercase tracking-tight text-slate-950 sm:text-3xl">
            {school.name}
          </h1>
          <ExecutiveStatusBadge
            level={commandCenter.executiveStatus}
            label={commandCenter.executiveStatusLabel}
          />
          <PriorityBadge
            level={commandCenter.priorityLevel}
            label={commandCenter.priorityLabel}
          />
          <p className="mt-2 flex items-center gap-1 font-mono text-xs text-slate-500">
            <span>ID: {school.id}</span>
            <CopyButton value={school.id} label="Copy school ID" />
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
              {binaryPlanLabel(school.plan)} Plan
            </span>
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                suspended
                  ? "bg-red-50 text-red-800 ring-red-200"
                  : schoolLifecycleStatusBadgeClass(commandCenter.schoolStatus)
              )}
            >
              {suspended ? "Suspended" : lifecycleLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                healthScore > 70
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : healthScore >= 40
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-red-50 text-red-800 ring-red-200"
              )}
            >
              <ScoreDot className={commandCenterHealthDotColor(healthScore)} />
              Health {healthScore}/100
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                commandCenterRiskBadgeClass(riskScore)
              )}
            >
              <ScoreDot className={commandCenterRiskDotColor(riskScore)} />
              Risk {riskScore}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Created {formatDaysAgo(commandCenter.daysSinceCreated)}
            </span>
          </div>
        </div>

        <SuperAdminNavLink
          href="/super-admin"
          loadingLabel="Loading…"
          className="shrink-0 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Back
        </SuperAdminNavLink>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Quick actions
        </p>
        <div className="flex flex-wrap gap-2">
          <SuperAdminLoadingButton
            type="button"
            loading={workspaceOpening}
            loadingLabel="Opening…"
            onClick={onOpenWorkspace}
            className={saBtnPrimarySm}
          >
            Open Workspace
          </SuperAdminLoadingButton>
          <ContactSchoolMenu
            email={contactEmail}
            phone={contactPhone}
            contactsHref={contactsHref}
          />
          <SuperAdminNavLink href={broadcastHref} className={saBtnSecondarySm}>
            Send Follow-Up
          </SuperAdminNavLink>
          <button type="button" onClick={onUpgradePlan} className={saBtnGhostSm}>
            Upgrade Plan
          </button>
          <button type="button" onClick={onEditSchool} className={saBtnGhostSm}>
            Edit School
          </button>
        </div>
      </div>
    </header>
  );
});

function SchoolHealthCard({
  commandCenter,
}: {
  commandCenter: SchoolCommandCenterPayload;
}) {
  const score = commandCenter.health.score;
  const trend = commandCenter.healthTrend;
  const trendColor =
    trend.delta === null
      ? "text-slate-500"
      : trend.delta > 0
        ? "text-emerald-700"
        : trend.delta < 0
          ? "text-red-600"
          : "text-slate-500";

  return (
    <CommandCard title="School Health" confidence="High">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={cn("text-3xl font-bold tabular-nums", commandCenterHealthTextColor(score))}>
            {score}
            <span className="text-lg font-semibold text-slate-400"> / 100</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">{commandCenter.health.label}</p>
          <p className={cn("mt-1 text-xs font-medium", trendColor)}>{trend.label}</p>
        </div>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all duration-500", commandCenterHealthBarColor(score))}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <ul className="mt-5 space-y-2">
        {commandCenter.healthDrivers.map((driver) => (
          <li key={driver.label} className="flex items-start gap-2 text-sm text-slate-700">
            <span className={driver.met ? "text-emerald-600" : "text-red-500"} aria-hidden>
              {driver.met ? "✓" : "✗"}
            </span>
            {driver.label}
          </li>
        ))}
      </ul>
    </CommandCard>
  );
}

function SchoolRiskCard({
  commandCenter,
}: {
  commandCenter: SchoolCommandCenterPayload;
}) {
  const riskScore = commandCenter.risk.score;
  const tone = commandCenterRiskBadgeClass(riskScore);

  return (
    <CommandCard title="Risk Assessment" confidence={commandCenter.insightConfidence}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Risk Score
          </p>
          <p className={cn("mt-1 text-3xl font-bold tabular-nums", commandCenterRiskTextColor(riskScore))}>
            {riskScore}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Risk Level
          </p>
          <span
            className={cn(
              "mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset",
              tone
            )}
          >
            {commandCenter.risk.level}
          </span>
        </div>
      </div>
      {commandCenter.riskTrend.previousScore !== null ? (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
          <p className="text-slate-600">
            Previous Risk:{" "}
            <span className="font-semibold text-slate-800">
              {commandCenter.riskTrend.previousScore}
            </span>
          </p>
          <p className="text-slate-600">
            Current Risk:{" "}
            <span className="font-semibold text-slate-800">
              {commandCenter.riskTrend.currentScore}
            </span>
          </p>
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              commandCenter.riskTrend.direction === "up"
                ? "text-red-600"
                : commandCenter.riskTrend.direction === "down"
                  ? "text-emerald-700"
                  : "text-slate-500"
            )}
          >
            {commandCenter.riskTrend.label}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">{commandCenter.riskTrend.label}</p>
      )}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Reasons
        </p>
        <ul className="mt-2 space-y-1.5">
          {commandCenter.risk.reasons.map((reason) => (
            <li key={reason} className="text-sm text-slate-700">
              • {reason}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Recommended action
        </p>
        <p className="mt-1 text-sm text-indigo-900">
          {commandCenter.risk.recommendedAction}
        </p>
      </div>
    </CommandCard>
  );
}

function SchoolTimelineCard({
  timeline,
}: {
  timeline: SchoolCommandCenterPayload["timeline"];
}) {
  return (
    <CommandCard title="School Timeline">
      <ol className="space-y-4">
        {timeline.map((event) => (
          <li key={event.id} className="flex gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
            <div>
              <p className="text-xs text-slate-500">
                {event.date ? formatShortLocaleDate(event.date) : "—"}
              </p>
              <p className="text-sm font-semibold text-slate-900">{event.label}</p>
              {event.note ? (
                <p className="mt-0.5 text-xs text-slate-500">{event.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </CommandCard>
  );
}

function SchoolActivityCard({
  activity,
}: {
  activity: SchoolCommandCenterPayload["activity"];
}) {
  const statusTone =
    activity.status === "Active"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : activity.status === "Dormant"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  const rows = [
    { label: "Last login", value: formatSchoolLastActivity(activity.lastLogin) },
    { label: "Attendance", value: formatSchoolLastActivity(activity.lastAttendance) },
    { label: "Report cards", value: formatSchoolLastActivity(activity.lastReportCard) },
    { label: "Finance", value: formatSchoolLastActivity(activity.lastFinance) },
  ];

  const hasAnyActivity = [
    activity.lastLogin,
    activity.lastAttendance,
    activity.lastReportCard,
    activity.lastFinance,
  ].some(Boolean);

  return (
    <CommandCard title="Activity Monitor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-500">
          <Activity className="h-4 w-4" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide">
            Platform usage signals
          </p>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
            statusTone
          )}
        >
          Status: {activity.status}
        </span>
      </div>
      {hasAnyActivity ? (
        <dl className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="font-medium text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
            <BarChart3 className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">No platform activity recorded</p>
          <p className="mt-1 text-sm text-slate-500">
            Usage signals will appear once admins begin using core features.
          </p>
        </div>
      )}
    </CommandCard>
  );
}

function AdminTeamCard({
  admins,
  primaryAdmin,
  contactsHref,
  broadcastHref,
}: {
  admins: MemberRow[];
  primaryAdmin: MemberRow | null;
  contactsHref: string;
  broadcastHref: string;
}) {
  if (admins.length === 0) {
    return (
      <CommandCard title="Admin Team">
        <EmptyPanel
          icon={UserCircle}
          theme="blue"
          title="No active administrators found"
          description="This school currently has no linked administrator accounts."
          recommendation="Invite or contact the school administrator."
          primaryLabel="Contact School"
          secondaryLabel="Send Follow-Up"
          onPrimary={() => {
            window.location.href = contactsHref;
          }}
          onSecondary={() => {
            window.location.href = broadcastHref;
          }}
        />
      </CommandCard>
    );
  }

  return (
    <CommandCard title="Admin Team">
      <div className="space-y-4">
        {admins.map((admin) => {
          const isPrimary = primaryAdmin?.user_id === admin.user_id;
          return (
            <article
              key={admin.user_id}
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
            >
              <div className="flex items-start gap-3">
                <AdminAvatar name={admin.full_name} avatarUrl={admin.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{admin.full_name}</p>
                    {isPrimary ? (
                      <span className={cn(saStatusBadge, "bg-violet-100 text-violet-900 ring-violet-200")}>
                        Primary Administrator
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{admin.role}</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{admin.email ?? "No email"}</span>
                      {admin.email ? (
                        <CopyButton value={admin.email} label="Copy email" />
                      ) : null}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{admin.phone ?? "No phone"}</span>
                      {admin.phone ? (
                        <CopyButton value={admin.phone} label="Copy phone" />
                      ) : null}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      Last active {formatSchoolLastActivity(admin.last_sign_in_at)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SuperAdminNavLink href={contactsHref} className={saBtnSecondarySm}>
                      View Contact
                    </SuperAdminNavLink>
                    <SuperAdminNavLink href={broadcastHref} className={saBtnSecondarySm}>
                      Send Message
                    </SuperAdminNavLink>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </CommandCard>
  );
}

function AdminAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-100 text-sm font-bold text-indigo-800 ring-1 ring-indigo-200/80">
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill className="object-cover" sizes="44px" unoptimized />
      ) : (
        schoolInitials(name)
      )}
    </div>
  );
}

function StudentOverviewCard({
  overview,
  students,
  contactsHref,
  broadcastHref,
  onOpenWorkspace,
}: {
  overview: SchoolCommandCenterPayload["studentOverview"];
  students: StudentRow[];
  contactsHref: string;
  broadcastHref: string;
  onOpenWorkspace: () => void;
}) {
  if (overview.total === 0) {
    return (
      <CommandCard title="Student Overview">
        <EmptyPanel
          icon={GraduationCap}
          theme="purple"
          title="No students have been enrolled"
          description="Schools with active onboarding usually enroll students within the first 7–14 days."
          impact="Student records are required before attendance, report cards and fee management can begin."
          recommendation="Assist the school with student onboarding."
          primaryLabel="Contact School"
          secondaryLabel="Send Follow-Up"
          onPrimary={() => {
            window.location.href = contactsHref;
          }}
          onSecondary={() => {
            window.location.href = broadcastHref;
          }}
        />
        <button type="button" onClick={onOpenWorkspace} className={cn(saBtnSecondarySm, "mt-3 w-full")}>
          Open Workspace
        </button>
      </CommandCard>
    );
  }

  return (
    <CommandCard title="Student Overview">
      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Total Students" value={overview.total} />
        <MetricTile label="Active Students" value={overview.active} />
        <MetricTile label="New This Month" value={overview.newThisMonth} />
        <MetricTile
          label="Last Student Added"
          value={formatMaybeDate(overview.lastAddedAt)}
          small
        />
      </div>
      {students.length > 0 ? (
        <div className="mt-4 max-h-48 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, 8).map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">{s.full_name}</td>
                  <td className="px-3 py-2 text-slate-600">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </CommandCard>
  );
}

function MetricTile({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className={saKpiLabel}>{label}</p>
      <p className={cn(small ? "mt-1 text-sm font-semibold text-slate-900" : saKpiValue, "!text-2xl")}>
        {value}
      </p>
    </div>
  );
}

function CommunicationHistoryCard({
  communication,
  communicationHealth,
}: {
  communication: SchoolCommandCenterPayload["communication"];
  communicationHealth: SchoolCommandCenterPayload["communicationHealth"];
}) {
  const healthTone =
    communicationHealth === "Good"
      ? "text-emerald-700"
      : communicationHealth === "Fair"
        ? "text-amber-700"
        : "text-red-600";

  const rows = [
    { label: "Last Follow-Up Sent", value: formatMaybeDate(communication.lastFollowUpAt) },
    { label: "Last Contact Attempt", value: formatMaybeDate(communication.lastContactAttemptAt) },
    { label: "Last Admin Login", value: formatSchoolLastActivity(communication.lastAdminLoginAt) },
    { label: "Broadcasts Sent", value: communication.broadcastsSent },
    { label: "Responses Received", value: communication.responsesReceived },
    { label: "Unread Messages", value: communication.unreadMessages },
  ];

  return (
    <CommandCard title="Communication History">
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <MessageSquare className="h-4 w-4" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wide">
          Outreach & engagement
        </p>
      </div>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="font-medium tabular-nums text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-500">Communication Health</span>
        <span className={cn("font-semibold", healthTone)}>{communicationHealth}</span>
      </div>
    </CommandCard>
  );
}

function NextBestActionCard({
  commandCenter,
  contactsHref,
  broadcastHref,
  contactEmail,
  contactPhone,
}: {
  commandCenter: SchoolCommandCenterPayload;
  contactsHref: string;
  broadcastHref: string;
  contactEmail: string | null;
  contactPhone: string | null;
}) {
  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700">
              Next Best Action
            </p>
            <ConfidenceLabel level={commandCenter.insightConfidence} />
          </div>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {commandCenter.nextBestAction.action}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Reason:</span>{" "}
            {commandCenter.nextBestAction.reason}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ContactSchoolMenu
            email={contactEmail}
            phone={contactPhone}
            contactsHref={contactsHref}
            variant="primary"
          />
          <SuperAdminNavLink href={broadcastHref} className={saBtnSecondarySm}>
            Send Follow-Up
          </SuperAdminNavLink>
        </div>
      </div>
    </section>
  );
}

function SchoolSummaryFooter({
  commandCenter,
}: {
  commandCenter: SchoolCommandCenterPayload;
}) {
  const operationalTone =
    commandCenter.operationalStatus === "healthy"
      ? "text-emerald-700"
      : commandCenter.operationalStatus === "at_risk"
        ? "text-amber-700"
        : "text-red-700";

  const rows = [
    {
      label: "School Age",
      value:
        commandCenter.daysSinceCreated === null
          ? "—"
          : `${commandCenter.daysSinceCreated} days`,
    },
    { label: "Health", value: `${commandCenter.health.score}/100`, tone: commandCenterHealthTextColor(commandCenter.health.score) },
    { label: "Risk", value: String(commandCenter.risk.score), tone: commandCenterRiskTextColor(commandCenter.risk.score) },
    { label: "Students", value: String(commandCenter.studentOverview.total) },
    { label: "Revenue", value: commandCenter.kpis.revenueLabel },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">School Summary</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {row.label}
            </dt>
            <dd className={cn("mt-1 text-sm font-semibold", row.tone ?? "text-slate-900")}>{row.value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Operational Status
          </dt>
          <dd className={cn("mt-1 text-sm font-semibold", operationalTone)}>
            {commandCenter.operationalStatusLabel}
          </dd>
        </div>
      </dl>
      <div className="mt-4 rounded-xl border border-indigo-100 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Recommended Action
        </p>
        <p className="mt-1 text-sm text-slate-800">
          {commandCenter.priorityLevel === "immediate"
            ? "Contact school administrator immediately."
            : commandCenter.recommendedNextStep}
        </p>
      </div>
    </section>
  );
}

function IntelligencePanel({
  commandCenter,
  broadcastHref,
}: {
  commandCenter: SchoolCommandCenterPayload;
  broadcastHref: string;
}) {
  return (
    <CommandCard title="Adakaro Intelligence" confidence={commandCenter.insightConfidence}>
      <div className="flex items-center gap-2 text-indigo-600">
        <Brain className="h-4 w-4" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-wide">
          Automated insights
        </p>
      </div>
      <ul className="mt-4 space-y-2">
        {commandCenter.insights.map((insight) => (
          <li
            key={insight}
            className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm text-amber-950"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            {insight}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Recommended next step
        </p>
        <p className="mt-1 text-sm text-indigo-900">
          {commandCenter.recommendedNextStep}
        </p>
        <SuperAdminNavLink href={broadcastHref} className={cn(saBtnPrimarySm, "mt-3 inline-flex")}>
          Send Follow-Up
        </SuperAdminNavLink>
      </div>
    </CommandCard>
  );
}

export function SchoolCommandCenterSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-48 rounded-2xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-2xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

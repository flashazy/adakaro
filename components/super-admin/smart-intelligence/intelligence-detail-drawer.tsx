"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { SuperAdminLoadingButton } from "@/components/super-admin/super-admin-loading-action";
import { useBodyScrollLock } from "./use-body-scroll-lock";
import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import { formatAnalyticsCurrency } from "@/lib/analytics-format";
import { formatDate } from "@/lib/format-date";
import type {
  IntelligenceCardId,
  SmartIntelligencePayload,
} from "@/lib/super-admin/smart-intelligence-types";
import {
  buildSchoolProfileHref,
  intelligenceCardToSource,
  type SmartIntelligenceNavigationContext,
} from "@/lib/super-admin/smart-intelligence-navigation";
import { SchoolIntelligenceActionLinks } from "./school-intelligence-action-links";
import {
  saBtnSecondarySm,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import { intelligenceStatusBadgeClass } from "./intelligence-skeleton";
import {
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  Target,
} from "lucide-react";

const CARD_TITLES: Record<IntelligenceCardId, string> = {
  churn: "Churn Prediction",
  risk: "School Risk Scoring",
  revenue: "Revenue Forecasting",
  onboarding: "Onboarding Tracking",
  engagement: "Engagement Scoring",
};

const ENGAGEMENT_LABELS: Record<string, string> = {
  champion: "Champion",
  active: "Active",
  weak_usage: "Weak Usage",
  disengaged: "Disengaged",
};

const CHURN_LABELS: Record<string, string> = {
  high: "High Risk",
  medium: "Medium Risk",
  low: "Low Risk",
};

const ONBOARDING_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  almost_ready: "Almost Ready",
  complete: "Complete",
};

export interface IntelligenceDetailDrawerProps {
  cardId: IntelligenceCardId | null;
  data: SmartIntelligencePayload | null;
  onClose: () => void;
}

function DrawerSectionCard({
  title,
  stripTone = "indigo",
  children,
  className,
}: {
  title: string;
  stripTone?: "indigo" | "amber" | "red" | "emerald";
  children: ReactNode;
  className?: string;
}) {
  const stripClass = {
    indigo: "bg-indigo-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    emerald: "bg-emerald-500",
  }[stripTone];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className={cn("h-1", stripClass)} aria-hidden />
      <div className="px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function InsightCallout({
  title,
  body,
  tone = "indigo",
}: {
  title: string;
  body: string;
  tone?: "indigo" | "amber" | "red" | "emerald";
}) {
  const styles = {
    indigo: "border-indigo-100 bg-indigo-50/60 text-indigo-900",
    amber: "border-amber-100 bg-amber-50/60 text-amber-900",
    red: "border-red-100 bg-red-50/60 text-red-900",
    emerald: "border-emerald-100 bg-emerald-50/60 text-emerald-900",
  }[tone];

  return (
    <div className={cn("rounded-xl border px-4 py-3.5", styles)}>
      <div className="flex items-start gap-2.5">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {title}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}

function ActionRecommendation({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recommended next step
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{text}</p>
        </div>
      </div>
    </div>
  );
}

function buildSchoolNavContext(
  cardId: IntelligenceCardId,
  school: {
    id: string;
    name: string;
    riskLevel?: string;
    engagementScore?: number;
    onboardingProgress?: number;
  }
): SmartIntelligenceNavigationContext {
  return {
    schoolId: school.id,
    schoolName: school.name,
    source: intelligenceCardToSource(cardId),
    riskLevel: school.riskLevel,
    engagementScore: school.engagementScore,
    onboardingProgress: school.onboardingProgress,
  };
}

function RiskSchoolCard({
  navContext,
  level,
  signals,
}: {
  navContext: SmartIntelligenceNavigationContext;
  level?: string;
  signals: string[];
}) {
  const tone =
    level === "high" || level === "High Risk"
      ? "red"
      : level === "medium" || level === "Medium Risk"
        ? "amber"
        : "indigo";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{navContext.schoolName}</p>
          {level ? (
            <span
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                intelligenceStatusBadgeClass(
                  tone === "red" ? "critical" : tone === "amber" ? "warning" : "healthy"
                )
              )}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {level}
            </span>
          ) : null}
        </div>
      </div>
      {signals.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Why this school is at risk
          </p>
          <ul className="mt-2 space-y-1.5">
            {signals.slice(0, 4).map((signal) => (
              <li
                key={signal}
                className="flex items-start gap-2 text-sm text-slate-600"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {signal}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <SchoolIntelligenceActionLinks context={navContext} compact />
    </div>
  );
}

function DrawerBody({
  cardId,
  data,
}: {
  cardId: IntelligenceCardId;
  data: SmartIntelligencePayload;
}) {
  const { churn, risk, revenue, onboarding, engagement } = data;

  if (cardId === "churn") {
    const top = churn.schools.filter((s) => s.riskLevel !== "low").slice(0, 6);
    return (
      <div className="space-y-4">
        <InsightCallout
          title="Executive insight"
          body={churn.explanation}
          tone={churn.highRiskCount > 0 ? "red" : "amber"}
        />

        <DrawerSectionCard title="Risk distribution" stripTone="red">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-red-700">{churn.highRiskCount}</span> high ·{" "}
            <span className="font-semibold text-amber-700">{churn.mediumRiskCount}</span> medium ·{" "}
            <span className="font-semibold text-emerald-700">{churn.lowRiskCount}</span> low
          </p>
        </DrawerSectionCard>

        <DrawerSectionCard title="Top affected schools" stripTone="amber">
          {top.length === 0 ? (
            <p className="text-sm text-slate-500">No elevated churn signals.</p>
          ) : (
            <div className="space-y-3">
              {top.map((s) => (
                <RiskSchoolCard
                  key={s.id}
                  navContext={buildSchoolNavContext(cardId, {
                    id: s.id,
                    name: s.name,
                    riskLevel: s.riskLevel,
                  })}
                  level={CHURN_LABELS[s.riskLevel]}
                  signals={s.signals}
                />
              ))}
            </div>
          )}
        </DrawerSectionCard>

        <DrawerSectionCard title="Signals used" stripTone="indigo">
          <ul className="space-y-1.5 text-sm text-slate-600">
            {churn.signalsUsed.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-indigo-400" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </DrawerSectionCard>

        <ActionRecommendation text={churn.recommendedAction} />
      </div>
    );
  }

  if (cardId === "risk") {
    return (
      <div className="space-y-4">
        <InsightCallout title="Executive insight" body={risk.explanation} tone="amber" />

        <DrawerSectionCard title="Average risk score" stripTone="red">
          <p className="text-3xl font-bold tabular-nums text-slate-950">
            {risk.averageRiskScore}
            <span className="text-lg font-medium text-slate-400">/100</span>
          </p>
        </DrawerSectionCard>

        <DrawerSectionCard title="Schools at risk" stripTone="amber">
          {risk.schoolsAtRisk.length === 0 ? (
            <p className="text-sm text-slate-500">No elevated-risk schools.</p>
          ) : (
            <div className="space-y-3">
              {risk.schoolsAtRisk.slice(0, 6).map((s) => (
                <RiskSchoolCard
                  key={s.id}
                  navContext={buildSchoolNavContext(cardId, {
                    id: s.id,
                    name: s.name,
                    riskLevel: String(s.riskScore),
                  })}
                  level={`Risk ${s.riskScore}`}
                  signals={s.signals}
                />
              ))}
            </div>
          )}
        </DrawerSectionCard>

        <DrawerSectionCard title="Signals used" stripTone="indigo">
          <ul className="space-y-1.5 text-sm text-slate-600">
            {risk.signalsUsed.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-indigo-400" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </DrawerSectionCard>

        <ActionRecommendation text={risk.recommendedAction} />
      </div>
    );
  }

  if (cardId === "revenue") {
    return (
      <div className="space-y-4">
        <InsightCallout
          title="Executive insight"
          body={revenue.explanation}
          tone={revenue.growthDirection === "down" ? "amber" : "emerald"}
        />

        <DrawerSectionCard title="Revenue forecast" stripTone="emerald">
          <dl className="grid gap-3 sm:grid-cols-1">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium text-slate-500">Current (30d)</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">
                {formatAnalyticsCurrency(revenue.currentRevenue)}
              </dd>
            </div>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3">
              <dt className="text-xs font-medium text-indigo-600">Next month</dt>
              <dd className="mt-1 text-xl font-bold text-indigo-900">
                {formatAnalyticsCurrency(revenue.projectedNextMonth)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white px-4 py-3">
              <dt className="text-xs font-medium text-slate-500">3-month projection</dt>
              <dd className="mt-1 text-xl font-bold text-slate-900">
                {formatAnalyticsCurrency(revenue.projected3Month)}
              </dd>
            </div>
          </dl>
        </DrawerSectionCard>

        <DrawerSectionCard title="Growth direction" stripTone="indigo">
          <span className={intelligenceStatusBadgeClass(revenue.statusBadge.tone)}>
            {revenue.statusBadge.label}
          </span>
          <p className="mt-2 text-sm text-slate-600">
            {revenue.paidSchoolCount} paid school{revenue.paidSchoolCount === 1 ? "" : "s"} in scope.
          </p>
        </DrawerSectionCard>

        <ActionRecommendation text={revenue.recommendedAction} />
      </div>
    );
  }

  if (cardId === "onboarding") {
    const stuck = onboarding.stuckSchools.slice(0, 6);
    return (
      <div className="space-y-4">
        <InsightCallout title="Executive insight" body={onboarding.explanation} tone="amber" />

        <DrawerSectionCard title="Platform progress" stripTone="indigo">
          <p className="text-3xl font-bold tabular-nums text-slate-950">
            {onboarding.averageProgress}%
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {onboarding.completeCount} complete · {onboarding.stuckCount} below 60%
          </p>
        </DrawerSectionCard>

        <DrawerSectionCard title="Stuck setup schools" stripTone="amber">
          {stuck.length === 0 ? (
            <p className="text-sm text-slate-500">No schools below 60% progress.</p>
          ) : (
            <div className="space-y-3">
              {stuck.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <span className="text-sm font-bold tabular-nums text-amber-700">
                      {s.progressPercent}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {ONBOARDING_LABELS[s.status]}
                  </p>
                  {s.missingSteps.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Missing milestones
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {s.missingSteps.map((step) => (
                          <li
                            key={step}
                            className="flex items-center gap-2 text-sm text-slate-600"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <SchoolIntelligenceActionLinks
                    context={buildSchoolNavContext(cardId, {
                      id: s.id,
                      name: s.name,
                      onboardingProgress: s.progressPercent,
                    })}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
        </DrawerSectionCard>

        <ActionRecommendation text={onboarding.recommendedAction} />
      </div>
    );
  }

  const top = engagement.topEngaged;
  const low = engagement.lowEngagement;

  return (
    <div className="space-y-4">
      <InsightCallout title="Executive insight" body={engagement.explanation} tone="emerald" />

      <DrawerSectionCard title="Average engagement" stripTone="emerald">
        <p className="text-3xl font-bold tabular-nums text-slate-950">
          {engagement.averageScore}
          <span className="text-lg font-medium text-slate-400">/100</span>
        </p>
      </DrawerSectionCard>

      <DrawerSectionCard title="Top engaged schools" stripTone="emerald">
        {top.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          <ul className="space-y-2">
            {top.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2.5"
              >
                <SuperAdminNavLink
                  href={buildSchoolProfileHref(s.id)}
                  loadingLabel="Opening school…"
                  className="text-sm font-medium text-indigo-600"
                >
                  {s.name}
                </SuperAdminNavLink>
                <span className="text-sm font-bold tabular-nums text-emerald-700">
                  {s.score} · {ENGAGEMENT_LABELS[s.label]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DrawerSectionCard>

      <DrawerSectionCard title="Low engagement schools" stripTone="amber">
        {low.length === 0 ? (
          <p className="text-sm text-slate-500">None flagged.</p>
        ) : (
          <div className="space-y-3">
            {low.map((s) => (
              <RiskSchoolCard
                key={s.id}
                navContext={buildSchoolNavContext(cardId, {
                  id: s.id,
                  name: s.name,
                  engagementScore: s.score,
                  riskLevel: s.label,
                })}
                level={ENGAGEMENT_LABELS[s.label]}
                signals={s.signals}
              />
            ))}
          </div>
        )}
      </DrawerSectionCard>

      <ActionRecommendation text={engagement.recommendedAction} />
    </div>
  );
}

export function IntelligenceDetailDrawer({
  cardId,
  data,
  onClose,
}: IntelligenceDetailDrawerProps) {
  const isOpen = Boolean(cardId && data);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!cardId || !data) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close intelligence details"
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onClose}
        onWheel={(e) => e.preventDefault()}
      />
      <aside
        className={cn(
          "fixed z-50 flex max-h-dvh flex-col bg-slate-50 shadow-2xl",
          "inset-x-0 bottom-0 h-[min(92dvh,100%)] rounded-t-2xl border border-slate-200",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-dvh sm:max-h-dvh",
          "sm:w-[520px] sm:max-w-xl sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intelligence-detail-title"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Smart Intelligence
            </p>
            <h2
              id="intelligence-detail-title"
              className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
            >
              {CARD_TITLES[cardId]}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Updated {formatDate(data.computedAt)}
            </p>
          </div>
          <SuperAdminLoadingButton
            type="button"
            className={saBtnSecondarySm}
            onClick={onClose}
          >
            Close
          </SuperAdminLoadingButton>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 touch-pan-y [-webkit-overflow-scrolling:touch]"
          data-intelligence-drawer-scroll
        >
          <DrawerBody cardId={cardId} data={data} />
        </div>
      </aside>
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";
import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import {
  getFollowUpTemplate,
  intelligenceDashboardHref,
  isFromIntelligenceNavigation,
  parseIntelligenceNavigationFromSearchParams,
} from "@/lib/super-admin/smart-intelligence-navigation";
import {
  buildPreviousFollowUps,
  extractSchoolAttentionSignals,
  extractSchoolScoreSummary,
  extractRiskScoreForSeverity,
  getFollowUpTypeLabel,
} from "@/lib/super-admin/school-follow-up-presentation";
import type { PreviousFollowUpItem } from "@/lib/super-admin/school-follow-up-presentation";
import { useSchoolIntelligenceContext } from "@/components/super-admin/smart-intelligence/use-school-intelligence-context";
import type { SmartIntelligencePayload } from "@/lib/super-admin/smart-intelligence-types";
import type { Database } from "@/types/supabase";
import {
  BroadcastKpiCard,
  BroadcastPreviewPanel,
  formatRelativeBroadcastTime,
} from "./broadcasts-dashboard-ui";
import { SendBroadcastForm, type BroadcastDraft } from "./components/SendBroadcastForm";
import { ExpectedOutcomePanel } from "./components/single-school-follow-up-ux";
import { BroadcastList } from "./components/BroadcastList";

type BroadcastRow = Database["public"]["Tables"]["broadcasts"]["Row"];

interface ReadersAudienceResponse {
  read?: { school_name: string }[];
  not_read?: { school_name: string }[];
  total_school_admins?: number;
}

interface IntelligenceFollowUpState {
  schoolId: string;
  schoolName: string;
  adminUserIds: string[];
  title: string;
  message: string;
}

async function fetchAudienceMetrics(
  broadcastId: string
): Promise<{ schools: number; admins: number }> {
  try {
    const res = await fetch(
      `/api/broadcasts/${encodeURIComponent(broadcastId)}/readers`,
      { cache: "no-store" }
    );
    const json = (await res.json().catch(() => ({}))) as ReadersAudienceResponse;
    if (!res.ok) {
      return { schools: 0, admins: 0 };
    }
    const schoolNames = new Set<string>();
    for (const row of [...(json.read ?? []), ...(json.not_read ?? [])]) {
      const name = row.school_name?.trim();
      if (name && name !== "—") schoolNames.add(name);
    }
    return {
      schools: schoolNames.size,
      admins: json.total_school_admins ?? 0,
    };
  } catch {
    return { schools: 0, admins: 0 };
  }
}

export function BroadcastsDashboardClient() {
  const searchParams = useSearchParams();
  const intelligenceNav = useMemo(
    () => parseIntelligenceNavigationFromSearchParams(searchParams),
    [searchParams]
  );
  const fromIntelligence = isFromIntelligenceNavigation(searchParams);

  const [items, setItems] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [audience, setAudience] = useState({ schools: 0, admins: 0 });
  const [draft, setDraft] = useState<BroadcastDraft>({
    title: "",
    message: "",
    isUrgent: false,
  });
  const [reminder, setReminder] = useState<{
    targetUserIds: string[];
    title: string;
    message: string;
  } | null>(null);
  const [intelligenceFollowUp, setIntelligenceFollowUp] =
    useState<IntelligenceFollowUpState | null>(null);
  const [lastBroadcastLabel, setLastBroadcastLabel] = useState("Never Sent");
  const [intelligenceData, setIntelligenceData] =
    useState<SmartIntelligencePayload | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [optimisticFollowUp, setOptimisticFollowUp] =
    useState<PreviousFollowUpItem | null>(null);

  const { data: schoolContextPayload, loading: schoolContextLoading } =
    useSchoolIntelligenceContext(intelligenceNav?.schoolId ?? null);

  const loadBroadcasts = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/broadcasts/list", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        items?: BroadcastRow[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load broadcasts.");
      }
      const rows = data.items ?? [];
      setItems(rows);

      if (rows.length > 0) {
        setLastBroadcastLabel(formatRelativeBroadcastTime(rows[0].sent_at));
        const metrics = await fetchAudienceMetrics(rows[0].id);
        setAudience(metrics);
      } else {
        setLastBroadcastLabel("Never Sent");
        setAudience({ schools: 0, admins: 0 });
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not load broadcasts.");
      setItems([]);
      setLastBroadcastLabel("Never Sent");
      setAudience({ schools: 0, admins: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBroadcasts();
  }, [loadBroadcasts, listKey]);

  useEffect(() => {
    if (!intelligenceNav?.schoolId) {
      setIntelligenceFollowUp(null);
      return;
    }

    const template = getFollowUpTemplate(intelligenceNav.source);
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(
          `/api/super-admin/schools/${encodeURIComponent(intelligenceNav.schoolId)}/intelligence-context`,
          { credentials: "same-origin" }
        );
        const body = (await res.json().catch(() => ({}))) as {
          school?: { name: string };
          adminUserIds?: string[];
        };
        if (cancelled) return;

        const schoolName =
          body.school?.name?.trim() || intelligenceNav.schoolName || "Selected school";

        setIntelligenceFollowUp({
          schoolId: intelligenceNav.schoolId,
          schoolName,
          adminUserIds: body.adminUserIds ?? [],
          title: template.title,
          message: template.message,
        });
        setFormKey((k) => k + 1);
        requestAnimationFrame(() =>
          document.getElementById("new-broadcast-form")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        );
      } catch {
        if (!cancelled) {
          setIntelligenceFollowUp({
            schoolId: intelligenceNav.schoolId,
            schoolName: intelligenceNav.schoolName || "Selected school",
            adminUserIds: [],
            title: template.title,
            message: template.message,
          });
          setFormKey((k) => k + 1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [intelligenceNav]);

  useEffect(() => {
    if (!intelligenceNav?.schoolId) {
      setIntelligenceData(null);
      return;
    }

    let cancelled = false;
    setIntelligenceLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/super-admin/smart-intelligence", {
          credentials: "same-origin",
        });
        const body = (await res.json().catch(() => ({}))) as
          | SmartIntelligencePayload
          | { error?: string };
        if (cancelled) return;
        if (res.ok && "churn" in body) {
          setIntelligenceData(body);
        } else {
          setIntelligenceData(null);
        }
      } catch {
        if (!cancelled) setIntelligenceData(null);
      } finally {
        if (!cancelled) setIntelligenceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [intelligenceNav?.schoolId]);

  const stats = useMemo(
    () => ({
      total: items.length,
      urgent: items.filter((b) => b.is_urgent).length,
      schoolsReached: audience.schools,
    }),
    [items, audience.schools]
  );

  const handleDraftChange = useCallback((next: BroadcastDraft) => {
    setDraft(next);
  }, []);

  const hasBroadcasts = !loading && items.length > 0;
  const singleSchoolTarget = intelligenceFollowUp ?? null;
  const isSingleSchoolFollowUp = Boolean(
    singleSchoolTarget && intelligenceNav?.source
  );

  const attentionSignals = useMemo(() => {
    if (!intelligenceNav?.schoolId || !intelligenceNav.source) return [];
    return extractSchoolAttentionSignals(
      intelligenceData,
      intelligenceNav.schoolId,
      intelligenceNav.source,
      intelligenceNav
    );
  }, [intelligenceData, intelligenceNav]);

  const scoreSummary = useMemo(() => {
    if (!intelligenceNav?.schoolId || !intelligenceNav.source) return null;
    return extractSchoolScoreSummary(
      intelligenceData,
      intelligenceNav.schoolId,
      intelligenceNav.source,
      intelligenceNav
    );
  }, [intelligenceData, intelligenceNav]);

  const followUpRiskScore = useMemo(() => {
    if (!intelligenceNav?.schoolId) return undefined;
    return extractRiskScoreForSeverity(intelligenceData, intelligenceNav.schoolId);
  }, [intelligenceData, intelligenceNav?.schoolId]);

  const previousFollowUps = useMemo(() => {
    const adminIds =
      schoolContextPayload?.adminUserIds ?? singleSchoolTarget?.adminUserIds ?? [];
    const fromServer = buildPreviousFollowUps(items, adminIds);
    if (
      optimisticFollowUp &&
      !fromServer.some(
        (item) =>
          item.id === optimisticFollowUp.id ||
          (item.typeLabel === optimisticFollowUp.typeLabel &&
            Math.abs(
              new Date(item.sentAt).getTime() -
                new Date(optimisticFollowUp.sentAt).getTime()
            ) < 60_000)
      )
    ) {
      return [optimisticFollowUp, ...fromServer].slice(0, 5);
    }
    return fromServer;
  }, [
    items,
    schoolContextPayload?.adminUserIds,
    singleSchoolTarget?.adminUserIds,
    optimisticFollowUp,
  ]);

  const recipientCounts = useMemo(() => {
    if (schoolContextPayload?.recipientCounts) {
      return schoolContextPayload.recipientCounts;
    }
    const adminCount = singleSchoolTarget?.adminUserIds.length ?? 0;
    if (!adminCount) return null;
    return {
      admins: adminCount,
      teachers: 0,
      parents: 0,
      total: adminCount,
    };
  }, [schoolContextPayload?.recipientCounts, singleSchoolTarget?.adminUserIds]);

  function handleFollowUpSent(schoolName?: string) {
    const name = schoolName || singleSchoolTarget?.schoolName;
    if (name) {
      toast.success(`Follow-up sent successfully to ${name}`, {
        description: "Message delivered to school administrators.",
        duration: 5000,
      });
    }
    if (intelligenceNav) {
      setOptimisticFollowUp({
        id: `sent-${Date.now()}`,
        sentAt: new Date().toISOString(),
        title: draft.title || getFollowUpTemplate(intelligenceNav.source).title,
        typeLabel: getFollowUpTypeLabel(intelligenceNav.source),
        sentBy: "Super Admin",
      });
    }
    setListKey((k) => k + 1);
    setReminder(null);
    if (intelligenceNav && singleSchoolTarget) {
      const template = getFollowUpTemplate(intelligenceNav.source);
      setIntelligenceFollowUp({
        ...singleSchoolTarget,
        title: template.title,
        message: template.message,
      });
      setFormKey((k) => k + 1);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <Toaster richColors position="bottom-right" closeButton />
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Broadcast messages
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Enterprise communication center for school admin dashboards.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              {singleSchoolTarget
                ? `Recipient: ${singleSchoolTarget.schoolName}`
                : "Recipients: All active school administrators"}
            </p>
          </div>
          <SuperAdminNavLink
            href={fromIntelligence ? intelligenceDashboardHref() : "/super-admin"}
            loadingLabel={fromIntelligence ? "Returning…" : "Loading…"}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {fromIntelligence ? "Back to Intelligence" : "Back to dashboard"}
          </SuperAdminNavLink>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid auto-rows-fr items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BroadcastKpiCard
            label="Total Broadcasts"
            value={loading ? "…" : stats.total}
            helper={hasBroadcasts ? "Messages ever sent" : "Broadcasts sent"}
          />
          <BroadcastKpiCard
            label="Urgent Broadcasts"
            value={loading ? "…" : stats.urgent}
            helper={
              hasBroadcasts ? "Highlighted messages" : "Urgent messages sent"
            }
          />
          <BroadcastKpiCard
            label="Schools Reached"
            value={loading ? "…" : stats.schoolsReached}
            helper={
              hasBroadcasts
                ? "Schools in current audience"
                : "No schools reached yet"
            }
          />
          <BroadcastKpiCard
            label="Last Broadcast"
            value={loading ? "…" : hasBroadcasts ? lastBroadcastLabel : "Never Sent"}
            helper={
              hasBroadcasts ? "Most recent send" : "No broadcasts sent yet"
            }
          />
        </div>

        {listError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {listError}
          </p>
        ) : null}

        <div id="new-broadcast-form" className="grid gap-6 lg:grid-cols-2">
          <SendBroadcastForm
            key={`${formKey}-${singleSchoolTarget?.schoolId ?? "all"}-${reminder ? "reminder" : "main"}`}
            defaultTitle={singleSchoolTarget?.title ?? reminder?.title ?? ""}
            defaultMessage={singleSchoolTarget?.message ?? reminder?.message ?? ""}
            defaultUrgent={false}
            targetUserIds={
              singleSchoolTarget?.adminUserIds.length
                ? singleSchoolTarget.adminUserIds
                : reminder?.targetUserIds ?? null
            }
            targetSchoolId={singleSchoolTarget?.schoolId ?? null}
            followUpSource={isSingleSchoolFollowUp ? intelligenceNav!.source : null}
            followUpSourceContext={
              isSingleSchoolFollowUp && intelligenceNav
                ? {
                    schoolId: intelligenceNav.schoolId,
                    schoolName: intelligenceNav.schoolName,
                    riskLevel: intelligenceNav.riskLevel,
                    engagementScore: intelligenceNav.engagementScore,
                    onboardingProgress: intelligenceNav.onboardingProgress,
                    from: "intelligence",
                  }
                : null
            }
            recipientSchoolName={singleSchoolTarget?.schoolName ?? null}
            targetTypeLabel={singleSchoolTarget ? "Single School" : "All Schools"}
            followUpRiskLevel={intelligenceNav?.riskLevel}
            followUpRiskScore={followUpRiskScore}
            schoolContext={schoolContextPayload?.school ?? null}
            schoolContextLoading={schoolContextLoading}
            attentionSignals={attentionSignals}
            attentionSignalsLoading={intelligenceLoading && !intelligenceData}
            scoreSummary={scoreSummary}
            scoreSummaryLoading={intelligenceLoading && !intelligenceData}
            recipientCounts={recipientCounts}
            previousFollowUps={previousFollowUps}
            previousFollowUpsLoading={loading}
            onDraftChange={handleDraftChange}
            onSent={(schoolName) => {
              if (isSingleSchoolFollowUp) {
                handleFollowUpSent(schoolName);
              } else {
                setListKey((k) => k + 1);
                setReminder(null);
                setDraft({ title: "", message: "", isUrgent: false });
              }
            }}
          />
          <div className="lg:sticky lg:top-6 lg:self-start">
            <BroadcastPreviewPanel
              title={draft.title}
              message={draft.message}
              isUrgent={draft.isUrgent}
              recipientName={singleSchoolTarget?.schoolName ?? null}
              showDeliveryMeta={isSingleSchoolFollowUp}
            />
            {isSingleSchoolFollowUp && intelligenceNav ? (
              <ExpectedOutcomePanel source={intelligenceNav.source} />
            ) : null}
          </div>
        </div>

        <BroadcastList
          items={items}
          loading={loading}
          audience={audience}
          refreshKey={listKey}
          onDeleted={(id) => {
            setItems((prev) => {
              const next = prev.filter((b) => b.id !== id);
              if (next[0]) {
                setLastBroadcastLabel(
                  formatRelativeBroadcastTime(next[0].sent_at)
                );
                void fetchAudienceMetrics(next[0].id).then(setAudience);
              } else {
                setLastBroadcastLabel("Never Sent");
                setAudience({ schools: 0, admins: 0 });
              }
              return next;
            });
          }}
          onConfigureReminder={(payload) => {
            setReminder({
              targetUserIds: payload.targetUserIds,
              title: payload.title,
              message: payload.message,
            });
            setIntelligenceFollowUp(null);
            setFormKey((k) => k + 1);
            requestAnimationFrame(() =>
              document.getElementById("new-broadcast-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            );
          }}
        />
      </main>
    </div>
  );
}

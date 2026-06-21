"use client";

import { SuperAdminLoadingButton } from "@/components/super-admin/super-admin-loading-action";
import type { SmartIntelligenceSource } from "@/lib/super-admin/smart-intelligence-navigation";
import {
  getFollowUpSendButtonLabel,
  getFollowUpSendLoadingLabel,
  type PreviousFollowUpItem,
  type SchoolScoreSummary,
} from "@/lib/super-admin/school-follow-up-presentation";
import type { SchoolIntelligenceContextPayload } from "@/lib/super-admin/smart-intelligence-navigation";
import {
  BROADCAST_MESSAGE_MAX,
  BROADCAST_TITLE_MAX,
  FieldLabelRow,
  PrioritySelector,
} from "../broadcasts-dashboard-ui";
import {
  AttentionSignalsCard,
  PreviousFollowUpsPanel,
  RecipientBreakdownCard,
  SchoolFollowUpContextCard,
  SendFollowUpConfirmModal,
  SmartMessageSourceLine,
} from "./single-school-follow-up-ux";
import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";

function normalizeTargetIds(
  ids: string[] | null | undefined
): string[] | null {
  if (!ids || ids.length === 0) return null;
  return [...new Set(ids.map((x) => String(x).trim()).filter(Boolean))];
}

export interface BroadcastDraft {
  title: string;
  message: string;
  isUrgent: boolean;
}

export function SendBroadcastForm({
  onSent,
  onDraftChange,
  defaultTitle = "",
  defaultMessage = "",
  defaultUrgent = false,
  targetUserIds = null,
  targetSchoolId = null,
  followUpSource = null,
  followUpSourceContext = null,
  recipientSchoolName = null,
  targetTypeLabel = "All Schools",
  followUpRiskLevel,
  followUpRiskScore,
  schoolContext = null,
  schoolContextLoading = false,
  attentionSignals = [],
  attentionSignalsLoading = false,
  scoreSummary = null,
  scoreSummaryLoading = false,
  recipientCounts = null,
  previousFollowUps = [],
  previousFollowUpsLoading = false,
}: {
  onSent?: (schoolName?: string) => void;
  onDraftChange?: (draft: BroadcastDraft) => void;
  defaultTitle?: string;
  defaultMessage?: string;
  defaultUrgent?: boolean;
  targetUserIds?: string[] | null;
  targetSchoolId?: string | null;
  followUpSource?: SmartIntelligenceSource | null;
  followUpSourceContext?: Record<string, unknown> | null;
  recipientSchoolName?: string | null;
  targetTypeLabel?: string;
  followUpRiskLevel?: string;
  followUpRiskScore?: number;
  schoolContext?: SchoolIntelligenceContextPayload["school"] | null;
  schoolContextLoading?: boolean;
  attentionSignals?: string[];
  attentionSignalsLoading?: boolean;
  scoreSummary?: SchoolScoreSummary | null;
  scoreSummaryLoading?: boolean;
  recipientCounts?: {
    admins: number;
    teachers: number;
    parents: number;
    total: number;
  } | null;
  previousFollowUps?: PreviousFollowUpItem[];
  previousFollowUpsLoading?: boolean;
}) {
  const isSingleSchoolFollowUp = Boolean(
    followUpSource && recipientSchoolName?.trim()
  );

  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState(defaultMessage);
  const [isUrgent, setIsUrgent] = useState(defaultUrgent);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetsForSend, setTargetsForSend] = useState<string[] | null>(() =>
    normalizeTargetIds(targetUserIds ?? undefined)
  );

  useEffect(() => {
    setTitle(defaultTitle);
    setMessage(defaultMessage);
    setIsUrgent(defaultUrgent);
  }, [defaultTitle, defaultMessage, defaultUrgent]);

  useEffect(() => {
    setTargetsForSend(normalizeTargetIds(targetUserIds ?? undefined));
  }, [targetUserIds]);

  useEffect(() => {
    onDraftChange?.({ title, message, isUrgent });
  }, [title, message, isUrgent, onDraftChange]);

  async function performSend() {
    setError(null);
    setSending(true);
    try {
      const payload: {
        title: string;
        message: string;
        is_urgent: boolean;
        target_user_ids?: string[];
        target_school_id?: string;
        target_type?: string;
        source?: string;
        source_context?: Record<string, unknown>;
      } = {
        title: title.trim(),
        message: message.trim(),
        is_urgent: isUrgent,
      };
      const t = normalizeTargetIds(targetsForSend ?? undefined);
      if (t && t.length > 0) {
        payload.target_user_ids = t;
      }
      const schoolId = targetSchoolId?.trim();
      if (schoolId) {
        payload.target_school_id = schoolId;
        payload.target_type = "single_school";
      } else if (t?.length) {
        payload.target_type = "targeted_admins";
      } else {
        payload.target_type = "all";
      }
      if (followUpSource) {
        payload.source = followUpSource;
      }
      if (followUpSourceContext && Object.keys(followUpSourceContext).length > 0) {
        payload.source_context = followUpSourceContext;
      }

      const res = await fetch("/api/broadcasts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not send broadcast.");
        return;
      }
      setConfirmOpen(false);
      setTitle("");
      setMessage("");
      setIsUrgent(false);
      onSent?.(recipientSchoolName?.trim() || undefined);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSingleSchoolFollowUp) {
      setConfirmOpen(true);
      return;
    }
    void performSend();
  }

  const sendLabel = isSingleSchoolFollowUp && followUpSource
    ? getFollowUpSendButtonLabel(followUpSource)
    : "Send Broadcast";
  const sendLoadingLabel = isSingleSchoolFollowUp && followUpSource
    ? getFollowUpSendLoadingLabel(followUpSource)
    : "Sending Broadcast...";

  const effectiveRecipientCounts =
    recipientCounts ??
    (targetsForSend?.length
      ? {
          admins: targetsForSend.length,
          teachers: 0,
          parents: 0,
          total: targetsForSend.length,
        }
      : null);

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {isSingleSchoolFollowUp ? "Send School Follow-Up" : "Create Broadcast Message"}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Messages appear on school admin dashboards immediately after sending.
        </p>

        {isSingleSchoolFollowUp && followUpSource ? (
          <div className="mt-4 space-y-3">
            <SchoolFollowUpContextCard
              schoolName={recipientSchoolName ?? ""}
              context={schoolContext}
              source={followUpSource}
              riskLevel={followUpRiskLevel}
              riskScore={followUpRiskScore}
              loading={schoolContextLoading}
            />
            <AttentionSignalsCard
              signals={attentionSignals}
              scoreSummary={scoreSummary}
              scoreSummaryLoading={scoreSummaryLoading}
              loading={attentionSignalsLoading}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/30">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Recipient
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
                  {recipientSchoolName?.trim()
                    ? recipientSchoolName
                    : "All active school administrators"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Target type
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">
                  {targetTypeLabel}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {isSingleSchoolFollowUp && effectiveRecipientCounts ? (
          <div className="mt-5">
            <RecipientBreakdownCard counts={effectiveRecipientCounts} />
          </div>
        ) : targetsForSend && targetsForSend.length > 0 ? (
          <p className="mt-3 text-sm text-indigo-700 dark:text-indigo-300">
            Only {targetsForSend.length} selected school admin
            {targetsForSend.length === 1 ? "" : "s"} will see this.
          </p>
        ) : null}

        <div className="mt-7 space-y-6">
          <div>
            <FieldLabelRow
              htmlFor="broadcast-title"
              label="Message title"
              counter={`${title.length} / ${BROADCAST_TITLE_MAX}`}
            />
            <input
              id="broadcast-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder="e.g. Scheduled maintenance tonight"
              required
              maxLength={BROADCAST_TITLE_MAX}
              autoComplete="off"
            />
          </div>

          <div>
            {isSingleSchoolFollowUp && followUpSource ? (
              <SmartMessageSourceLine source={followUpSource} />
            ) : null}
            <FieldLabelRow
              htmlFor="broadcast-body"
              label="Message body"
              counter={`${message.length} / ${BROADCAST_MESSAGE_MAX}`}
            />
            <textarea
              id="broadcast-body"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-white"
              placeholder={
                isSingleSchoolFollowUp
                  ? "Your follow-up message to school administrators…"
                  : "Your message to all school admins…"
              }
              required
              maxLength={BROADCAST_MESSAGE_MAX}
            />
          </div>

          <div className="pt-1">
            <PrioritySelector isUrgent={isUrgent} onChange={setIsUrgent} />
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div
          className={
            isSingleSchoolFollowUp
              ? "mt-8 lg:sticky lg:bottom-4 lg:z-10 lg:rounded-xl lg:border lg:border-slate-200/80 lg:bg-white/95 lg:p-4 lg:shadow-sm lg:backdrop-blur-sm dark:lg:border-zinc-700 dark:lg:bg-zinc-900/95"
              : "mt-8"
          }
        >
          <SuperAdminLoadingButton
            type="submit"
            disabled={sending}
            loading={sending && !confirmOpen}
            loadingLabel={sendLoadingLabel}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
            {sendLabel}
          </SuperAdminLoadingButton>
          {isSingleSchoolFollowUp && effectiveRecipientCounts ? (
            <p className="mt-2.5 text-xs text-slate-500 dark:text-zinc-400">
              This message will be delivered immediately to{" "}
              {effectiveRecipientCounts.admins === 1
                ? "1 school administrator"
                : `${effectiveRecipientCounts.admins} school administrators`}
              .
            </p>
          ) : null}
        </div>

        {isSingleSchoolFollowUp ? (
          <div className="mt-7">
            <PreviousFollowUpsPanel
              items={previousFollowUps}
              loading={previousFollowUpsLoading}
            />
          </div>
        ) : null}
      </form>

      {isSingleSchoolFollowUp && followUpSource ? (
        <SendFollowUpConfirmModal
          open={confirmOpen}
          schoolName={recipientSchoolName ?? "Selected school"}
          source={followUpSource}
          sending={sending}
          onCancel={() => {
            if (!sending) setConfirmOpen(false);
          }}
          onConfirm={() => void performSend()}
        />
      ) : null}
    </>
  );
}

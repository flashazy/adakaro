"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  showAdminErrorToast,
  showAdminSuccessToast,
} from "@/components/dashboard/dashboard-feedback-provider";
import { saStatusBadge } from "@/components/super-admin/super-admin-dashboard-ui";
import {
  buildConversationHistory,
  buildDemoWhatsAppMessage,
  buildWhatsAppUrl,
  computeAnnualRevenueTzs,
  computeDaysWaiting,
  computeLeadPriority,
  computeLeadScore,
  computeRevenueTier,
  formatRelativeContact,
  formatRevenueTzs,
  formatTimelineDay,
  getLeadScoreBreakdown,
  getLeadScoreTier,
  getContextualNextAction,
  DEMO_REQUEST_NEXT_ACTIONS,
  DEMO_REQUEST_STATUSES,
  LOST_REASONS,
  WON_REASONS,
  LEAD_OWNER_OPTIONS,
  NOTE_TEMPLATES,
  computeDealHealth,
  computeAttentionFlags,
  computeNextDeadline,
  computeCloseProbability,
  generateExecutiveSummary,
  formatLastActivitySummary,
  filterConversationHistory,
  computeConversionDays,
  dealHealthTone,
  closeProbabilityTone,
  pipelineStageBadgeClass,
  pipelineStageTextClass,
  pipelineStageSelectAccentClass,
  timelineActivityIconClass,
  isNextActionOverdue,
  type DemoRequestNote,
  type DemoRequestRow,
  type DemoRequestTimelineEvent,
  type TimelineFilter,
} from "@/lib/demo-requests/types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Copy,
  Lightbulb,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  StickyNote,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  Video,
  X,
} from "lucide-react";
import { LeadReminderBadges, FollowUpAlertBadges, LeadSourceBadge, LeadRequestTypeBadge } from "./demo-request-badges";
import {
  AttentionFlagsRow,
  CallSchoolModal,
  CollapsibleSection,
  EmailSchoolModal,
  formatContactActivityDisplay,
  NextDeadlineCard,
  NoteTemplateChips,
  TimelineFilterBar,
  WinCelebrationModal,
  type ContactModalContext,
  type WinCelebrationData,
} from "./demo-request-drawer-modals";

type DrawerSectionId =
  | "executive-summary"
  | "lead-score"
  | "conversion-probability"
  | "revenue-opportunity"
  | "contact"
  | "lead-details"
  | "pipeline"
  | "internal-notes"
  | "conversation-history";

type ContactChannel = "whatsapp" | "call" | "email";
type ContactModalKind = "call" | "email";

type QuickActionKey =
  | "call_opened"
  | "whatsapp_opened"
  | "email_opened"
  | "called"
  | "email_sent"
  | "demo_scheduled";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function timelineIcon(eventType: string, label: string) {
  const key = `${eventType} ${label}`.toLowerCase();
  if (key.includes("lead created") || eventType === "lead_created") {
    return Sparkles;
  }
  if (key.includes("whatsapp") || eventType.includes("whatsapp")) {
    return MessageCircle;
  }
  if (key.includes("email") || eventType.includes("email")) {
    return Mail;
  }
  if (key.includes("call") || eventType === "called") {
    return Phone;
  }
  if (key.includes("demo") || eventType.includes("demo")) {
    return Calendar;
  }
  if (key.includes("won") || eventType === "won") {
    return Trophy;
  }
  if (key.includes("lost") || eventType === "lost") {
    return AlertCircle;
  }
  if (key.includes("note")) {
    return StickyNote;
  }
  if (key.includes("assigned") || eventType === "lead_assigned") {
    return User;
  }
  if (
    key.includes("google meet") ||
    key.includes("zoom") ||
    eventType.includes("google_meet") ||
    eventType.includes("zoom_meeting")
  ) {
    return Video;
  }
  if (key.includes("invitation") || eventType === "demo_invitation_generated") {
    return Mail;
  }
  return CheckCircle2;
}

function resolveOwnerSelectValue(row: DemoRequestRow): string {
  if (!row.assigned_to_name) return "";
  const match = LEAD_OWNER_OPTIONS.find(
    (option) => option.label === row.assigned_to_name
  );
  return match?.id ?? row.assigned_to_name;
}

function ownerFieldsFromKey(ownerKey: string): {
  assigned_to_id: string | null;
  assigned_to_name: string | null;
} {
  const option = LEAD_OWNER_OPTIONS.find((item) => item.id === ownerKey);
  if (!ownerKey || !option?.id) {
    return { assigned_to_id: null, assigned_to_name: null };
  }
  const isUuid = /^[0-9a-f-]{36}$/i.test(ownerKey);
  return {
    assigned_to_id: isUuid ? ownerKey : null,
    assigned_to_name: option.label,
  };
}

function scoreTierTone(tier: string): string {
  switch (tier) {
    case "Hot Lead":
      return "text-orange-600";
    case "Warm Lead":
      return "text-amber-600";
    default:
      return "text-slate-500";
  }
}

function priorityTone(priority: string): string {
  switch (priority) {
    case "High":
      return "bg-red-50 text-red-800 ring-red-200";
    case "Medium":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

export function DemoRequestDetailDrawer({
  row,
  onClose,
  onSaved,
  onDeleted,
  initialContactModal = null,
}: {
  row: DemoRequestRow;
  onClose: () => void;
  onSaved: (row: DemoRequestRow) => void;
  onDeleted: (id: string) => void;
  initialContactModal?: ContactModalKind | null;
}) {
  const [liveRow, setLiveRow] = useState(row);
  const [status, setStatus] = useState(row.status);
  const [nextAction, setNextAction] = useState(row.next_action ?? "");
  const [nextActionDate, setNextActionDate] = useState(
    row.next_action_date ?? ""
  );
  const [demoDate, setDemoDate] = useState(row.demo_date ?? "");
  const [demoTime, setDemoTime] = useState(
    row.demo_time ? row.demo_time.slice(0, 5) : ""
  );
  const [meetingLink, setMeetingLink] = useState(row.meeting_link ?? "");
  const [notes, setNotes] = useState<DemoRequestNote[]>([]);
  const [timeline, setTimeline] = useState<DemoRequestTimelineEvent[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingContact, setLoggingContact] = useState<ContactChannel | null>(
    null
  );
  const [saveContactOpen, setSaveContactOpen] = useState(false);
  const [lostReason, setLostReason] = useState(row.lost_reason ?? "");
  const [wonReason, setWonReason] = useState(row.won_reason ?? "");
  const [leadOwner, setLeadOwner] = useState(resolveOwnerSelectValue(row));
  const [invitation, setInvitation] = useState<{
    subject: string;
    body: string;
    mailto: string;
  } | null>(null);
  const [crmLoading, setCrmLoading] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [winCelebration, setWinCelebration] = useState<WinCelebrationData | null>(
    null
  );
  const [collapsedSections, setCollapsedSections] = useState<
    Partial<Record<DrawerSectionId, boolean>>
  >({});
  const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
  const [contactModal, setContactModal] = useState<ContactModalKind | null>(
    initialContactModal
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerSentinelRef = useRef<HTMLDivElement>(null);
  const saveContactRef = useRef<HTMLDivElement>(null);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const res = await fetch(
        `/api/super-admin/demo-requests/${row.id}/detail`,
        { credentials: "same-origin" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        notes?: DemoRequestNote[];
        timeline?: DemoRequestTimelineEvent[];
        row?: DemoRequestRow;
        error?: string;
      };
      if (!res.ok || !body.row) {
        setLiveRow(row);
        setStatus(row.status);
        setNextAction(row.next_action ?? "");
        setNextActionDate(row.next_action_date ?? "");
        setDemoDate(row.demo_date ?? "");
        setDemoTime(row.demo_time ? row.demo_time.slice(0, 5) : "");
        setMeetingLink(row.meeting_link ?? "");
        setLostReason(row.lost_reason ?? "");
        setWonReason(row.won_reason ?? "");
        setLeadOwner(resolveOwnerSelectValue(row));
        setNotes([]);
        setTimeline([]);
        return;
      }
      setLiveRow(body.row);
      setStatus(body.row.status);
      setNextAction(body.row.next_action ?? "");
      setNextActionDate(body.row.next_action_date ?? "");
      setDemoDate(body.row.demo_date ?? "");
      setDemoTime(body.row.demo_time ? body.row.demo_time.slice(0, 5) : "");
      setMeetingLink(body.row.meeting_link ?? "");
      setLostReason(body.row.lost_reason ?? "");
      setWonReason(body.row.won_reason ?? "");
      setLeadOwner(resolveOwnerSelectValue(body.row));
      setNotes(body.notes ?? []);
      setTimeline(body.timeline ?? []);
    } finally {
      setLoadingDetail(false);
    }
  }, [row.id, row]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!saveContactOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!saveContactRef.current?.contains(e.target as Node)) {
        setSaveContactOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [saveContactOpen]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = headerSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setCompactHeaderVisible(!entry.isIntersecting),
      { root, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadingDetail]);

  function toggleSection(id: string) {
    setCollapsedSections((prev) => ({
      ...prev,
      [id as DrawerSectionId]: !prev[id as DrawerSectionId],
    }));
  }

  function isSectionExpanded(id: DrawerSectionId) {
    return collapsedSections[id] !== true;
  }

  const conversationHistory = useMemo(
    () => buildConversationHistory(timeline, notes),
    [timeline, notes]
  );

  const filteredHistory = useMemo(
    () => filterConversationHistory(conversationHistory, timelineFilter),
    [conversationHistory, timelineFilter]
  );

  const ownerFields = useMemo(
    () => ownerFieldsFromKey(leadOwner),
    [leadOwner]
  );

  const draftRow = useMemo(
    (): DemoRequestRow => ({
      ...liveRow,
      status,
      next_action: nextAction || null,
      next_action_date: nextActionDate || null,
      demo_date: demoDate || null,
      demo_time: demoTime || null,
      meeting_link: meetingLink || null,
      lost_reason: lostReason || null,
      won_reason: wonReason || null,
      assigned_to_id: ownerFields.assigned_to_id,
      assigned_to_name: ownerFields.assigned_to_name,
    }),
    [
      liveRow,
      status,
      nextAction,
      nextActionDate,
      demoDate,
      demoTime,
      meetingLink,
      lostReason,
      wonReason,
      ownerFields,
    ]
  );

  const score = computeLeadScore(draftRow);
  const scoreTier = getLeadScoreTier(score);
  const scoreFactors = getLeadScoreBreakdown(draftRow);
  const priority = computeLeadPriority(
    liveRow.student_count,
    liveRow.school_type
  );
  const daysWaiting = computeDaysWaiting(liveRow.created_at);
  const dealHealth = computeDealHealth(draftRow, timeline);
  const attentionFlags = computeAttentionFlags(draftRow, timeline, score);
  const lastActivitySummary = formatLastActivitySummary(timeline, liveRow);
  const nextDeadline = computeNextDeadline(draftRow);
  const closeProb = computeCloseProbability(draftRow, timeline);
  const executiveSummary = generateExecutiveSummary(
    draftRow,
    timeline,
    score,
    closeProb,
    dealHealth
  );
  const overdue = isNextActionOverdue(nextActionDate || null);
  const whatsAppMessage = buildDemoWhatsAppMessage(row);
  const whatsAppHref = row.phone
    ? buildWhatsAppUrl(row.phone, whatsAppMessage)
    : null;
  const callHref = row.phone ? `tel:${row.phone.replace(/\s+/g, "")}` : null;
  const emailHref = row.email ? `mailto:${row.email}` : null;
  const revenueTier = computeRevenueTier(liveRow.student_count);
  const revenueLabel = formatRevenueTzs(
    computeAnnualRevenueTzs(liveRow.student_count)
  );
  const nextBest = getContextualNextAction(draftRow, timeline);
  const studentSummary =
    liveRow.student_count != null
      ? `${liveRow.student_count.toLocaleString()} Students`
      : "Students unknown";
  const messageLabel =
    liveRow.request_type === "support" ? "Support Issue" : "Message";
  const leadSource = liveRow.source ?? "contact_page";
  const leadRequestType = liveRow.request_type ?? "demo";

  const contactModalContext = useMemo(
    (): ContactModalContext => ({
      score,
      scoreTier,
      priority,
      status: draftRow.status,
      lastActivity: formatContactActivityDisplay(lastActivitySummary),
    }),
    [score, scoreTier, priority, draftRow.status, lastActivitySummary]
  );

  const hasUnsavedChanges = useMemo(() => {
    return (
      status !== liveRow.status ||
      (nextAction || "") !== (liveRow.next_action ?? "") ||
      (nextActionDate || "") !== (liveRow.next_action_date ?? "") ||
      (demoDate || "") !== (liveRow.demo_date ?? "") ||
      (demoTime || "") !== (liveRow.demo_time?.slice(0, 5) ?? "") ||
      (meetingLink || "") !== (liveRow.meeting_link ?? "") ||
      (status === "Lost" ? lostReason : "") !== (liveRow.lost_reason ?? "") ||
      (status === "Won" ? wonReason : "") !== (liveRow.won_reason ?? "") ||
      leadOwner !== resolveOwnerSelectValue(liveRow)
    );
  }, [
    status,
    nextAction,
    nextActionDate,
    demoDate,
    demoTime,
    meetingLink,
    lostReason,
    wonReason,
    leadOwner,
    liveRow,
  ]);

  async function persistChanges(): Promise<DemoRequestRow | null> {
    if (status === "Lost" && !lostReason.trim()) {
      showAdminErrorToast("Please select a lost reason before saving.");
      return null;
    }
    if (status === "Won" && !wonReason.trim()) {
      showAdminErrorToast("Please select a won reason before saving.");
      return null;
    }

    const res = await fetch(`/api/super-admin/demo-requests/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        next_action: nextAction || null,
        next_action_date: nextActionDate || null,
        demo_date: demoDate || null,
        demo_time: demoTime || null,
        meeting_link: meetingLink || null,
        lost_reason: status === "Lost" ? lostReason : null,
        won_reason: status === "Won" ? wonReason : null,
        assigned_to_id: ownerFields.assigned_to_id,
        assigned_to_name: ownerFields.assigned_to_name,
      }),
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      row?: DemoRequestRow;
    };
    if (!res.ok || !body.row) {
      showAdminErrorToast(body.error || "Could not update request.");
      return null;
    }
    setLiveRow(body.row);
    onSaved(body.row);
    return body.row;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const previousStatus = liveRow.status;
      const saved = await persistChanges();
      if (saved) {
        showAdminSuccessToast("Demo request updated.");
        await loadDetail();
        if (previousStatus !== "Won" && saved.status === "Won") {
          setWinCelebration({
            schoolName: saved.school_name,
            score: computeLeadScore(saved),
            revenueLabel: formatRevenueTzs(
              computeAnnualRevenueTzs(saved.student_count)
            ),
            conversionDays: computeConversionDays(saved.created_at),
          });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function logContactAction(
    action: QuickActionKey,
    options?: { silent?: boolean }
  ): Promise<boolean> {
    const res = await fetch(
      `/api/super-admin/demo-requests/${row.id}/quick-action`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "same-origin",
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      row?: DemoRequestRow;
    };
    if (!res.ok || !body.row) {
      if (!options?.silent) {
        showAdminErrorToast(body.error || "Could not log contact.");
      }
      return false;
    }
    setLiveRow(body.row);
    setStatus(body.row.status);
    setNextAction(body.row.next_action ?? "");
    if (body.row.demo_date) setDemoDate(body.row.demo_date);
    onSaved(body.row);
    void loadDetail();
    return true;
  }

  async function handleContactOpen(channel: ContactChannel) {
    if (channel === "call") {
      setContactModal("call");
      return;
    }
    if (channel === "email") {
      if (!row.email) return;
      setContactModal("email");
      return;
    }

    if (!whatsAppHref) return;

    setLoggingContact(channel);
    try {
      await logContactAction("whatsapp_opened", { silent: true });
      window.open(whatsAppHref, "_blank", "noopener,noreferrer");
    } finally {
      setLoggingContact(null);
    }
  }

  async function handleMarkCalled(): Promise<boolean> {
    return logContactAction("called");
  }

  async function handleMarkEmailed(): Promise<boolean> {
    return logContactAction("email_sent");
  }

  async function handleCrmAction(
    action: "demo_invitation_generated" | "google_meet_created" | "zoom_meeting_created"
  ) {
    setCrmLoading(action);
    try {
      const res = await fetch(
        `/api/super-admin/demo-requests/${row.id}/crm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
          credentials: "same-origin",
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        row?: DemoRequestRow;
        invitation?: { subject: string; body: string; mailto: string };
        meetingLink?: string;
      };
      if (!res.ok) {
        showAdminErrorToast(body.error || "Could not complete CRM action.");
        return;
      }
      if (body.row) {
        setLiveRow(body.row);
        onSaved(body.row);
      }
      if (body.meetingLink) {
        setMeetingLink(body.meetingLink);
      }
      if (body.invitation) {
        setInvitation(body.invitation);
      }
      await loadDetail();
      if (action === "google_meet_created") {
        showAdminSuccessToast("Google Meet created");
      } else if (action === "zoom_meeting_created") {
        showAdminSuccessToast("Zoom meeting created");
      } else {
        showAdminSuccessToast("Demo invitation generated");
      }
    } finally {
      setCrmLoading(null);
    }
  }

  async function copyInvitation() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(
        `${invitation.subject}\n\n${invitation.body}`
      );
      showAdminSuccessToast("Invitation copied");
    } catch {
      showAdminErrorToast("Could not copy invitation.");
    }
  }

  async function saveAndContact(channel: ContactChannel) {
    setSaveContactOpen(false);
    setSaving(true);
    try {
      const previousStatus = liveRow.status;
      const saved = await persistChanges();
      if (!saved) return;
      if (previousStatus !== "Won" && saved.status === "Won") {
        setWinCelebration({
          schoolName: saved.school_name,
          score: computeLeadScore(saved),
          revenueLabel: formatRevenueTzs(
            computeAnnualRevenueTzs(saved.student_count)
          ),
          conversionDays: computeConversionDays(saved.created_at),
        });
      }
      showAdminSuccessToast("Saved.");
      if (channel === "whatsapp") {
        await handleContactOpen("whatsapp");
      } else {
        setContactModal(channel);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote() {
    const content = noteDraft.trim();
    if (!content) return;
    setAddingNote(true);
    try {
      const res = await fetch(
        `/api/super-admin/demo-requests/${row.id}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          credentials: "same-origin",
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        note?: DemoRequestNote;
      };
      if (!res.ok || !body.note) {
        showAdminErrorToast(body.error || "Could not add note.");
        return;
      }
      setNoteDraft("");
      await loadDetail();
      showAdminSuccessToast("Note added.");
    } finally {
      setAddingNote(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this demo request permanently?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/super-admin/demo-requests/${row.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showAdminErrorToast(body.error || "Could not delete request.");
        return;
      }
      showAdminSuccessToast("Demo request deleted.");
      onDeleted(row.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl sm:border-l sm:border-slate-200">
        {/* Minimal chrome */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
            Sales Workspace
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {/* Sticky compact header */}
          <div
            className={cn(
              "sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm transition-all duration-200",
              compactHeaderVisible
                ? "px-5 py-2.5 shadow-sm"
                : "pointer-events-none h-0 overflow-hidden border-0 py-0 opacity-0"
            )}
            aria-hidden={!compactHeaderVisible}
          >
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">
              {liveRow.school_name}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              <span className="font-semibold tabular-nums text-slate-800">
                {score}
              </span>{" "}
              {scoreTier}
              <span className="mx-1.5 text-slate-300">·</span>
              {dealHealth}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className={cn("font-medium", pipelineStageTextClass(status))}>
                {status}
              </span>
            </p>
          </div>

          {/* Full header */}
          <div className="px-5 pb-4 pt-4">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">
                {liveRow.school_name}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">{liveRow.full_name}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LeadSourceBadge source={leadSource} />
              <LeadRequestTypeBadge requestType={leadRequestType} />
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-slate-900">
                  {score}
                </span>
                <span className={cn("text-sm font-semibold", scoreTierTone(scoreTier))}>
                  {scoreTier}
                </span>
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                  dealHealthTone(dealHealth)
                )}
              >
                {dealHealth}
              </span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                  priorityTone(priority)
                )}
              >
                {priority} Priority
              </span>
              <span
                className={cn(
                  saStatusBadge,
                  "px-3 py-1 text-sm font-semibold",
                  pipelineStageBadgeClass(status)
                )}
              >
                {status}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{revenueTier}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              {studentSummary}
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="text-slate-700">Potential {revenueLabel}</span>
            </p>

            <LeadReminderBadges row={draftRow} timeline={timeline} className="mt-3" />
            <FollowUpAlertBadges row={draftRow} className="mt-2" />

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                Waiting{" "}
                <strong className="font-semibold text-slate-700">
                  {daysWaiting}d
                </strong>
              </span>
              <span>
                Last contact{" "}
                <strong className="font-semibold text-slate-700">
                  {formatRelativeContact(liveRow.last_contact_at)}
                </strong>
              </span>
              <span>
                Last activity{" "}
                <strong className="font-semibold text-slate-700">
                  {lastActivitySummary}
                </strong>
              </span>
            </div>
          </div>

          <div ref={headerSentinelRef} className="h-px" aria-hidden />

          <div className="space-y-3 px-5 pb-6">
            <CollapsibleSection
              id="executive-summary"
              title="Executive Summary"
              expanded={isSectionExpanded("executive-summary")}
              onToggle={toggleSection}
              className="border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white"
            >
              <p className="pt-3 text-sm leading-relaxed text-slate-800">
                {executiveSummary}
              </p>
            </CollapsibleSection>

            <CollapsibleSection
              id="lead-score"
              title="Lead Score"
              expanded={isSectionExpanded("lead-score")}
              onToggle={toggleSection}
            >
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Why this score?
                </p>
                <ul className="mt-3 space-y-2">
                  {scoreFactors.map((factor) => (
                    <li
                      key={factor.label}
                      className={cn(
                        "flex items-center justify-between text-sm",
                        factor.met ? "text-slate-800" : "text-slate-400"
                      )}
                    >
                      <span>
                        {factor.met ? "✓" : "○"} {factor.label}
                      </span>
                      <span className="font-medium tabular-nums">
                        {factor.met ? `+${factor.points}` : `+0`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="conversion-probability"
              title="Estimated Close Probability"
              expanded={isSectionExpanded("conversion-probability")}
              onToggle={toggleSection}
            >
              <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-bold tabular-nums text-slate-900">
                      {closeProb.percent}%
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        closeProbabilityTone(closeProb.tier)
                      )}
                    >
                      {closeProb.tier}
                    </p>
                  </div>
                  <div className="h-2 max-w-[140px] flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${closeProb.percent}%` }}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Based on lead score, school size, stage, and activity recency.
                </p>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="revenue-opportunity"
              title="Revenue Opportunity"
              expanded={isSectionExpanded("revenue-opportunity")}
              onToggle={toggleSection}
            >
              <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-900/15">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mt-2 text-3xl font-bold tracking-tight">
                      {revenueLabel.replace("/year", "")}
                      <span className="text-lg font-semibold text-emerald-100">
                        /year
                      </span>
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-emerald-50">
                      {revenueTier} Prospect
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                    <TrendingUp className="h-6 w-6 text-emerald-50" strokeWidth={2} />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {attentionFlags.length > 0 ? (
              <AttentionFlagsRow flags={attentionFlags} />
            ) : null}

            <CollapsibleSection
              id="contact"
              title="Contact"
              expanded={isSectionExpanded("contact")}
              onToggle={toggleSection}
            >
              <div className="space-y-2">
                {whatsAppHref ? (
                  <button
                    type="button"
                    onClick={() => void handleContactOpen("whatsapp")}
                    disabled={loggingContact === "whatsapp"}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-4 py-3.5 text-base font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:bg-[#20bd5a] disabled:opacity-60"
                  >
                    <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
                    {loggingContact === "whatsapp" ? "Opening…" : "WhatsApp"}
                  </button>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  {callHref ? (
                    <button
                      type="button"
                      onClick={() => handleContactOpen("call")}
                      disabled={loggingContact === "call"}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Phone className="h-4 w-4" aria-hidden />
                      Call
                    </button>
                  ) : null}
                  {emailHref ? (
                    <button
                      type="button"
                      onClick={() => handleContactOpen("email")}
                      disabled={loggingContact === "email"}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Mail className="h-4 w-4" aria-hidden />
                      Email
                    </button>
                  ) : null}
                </div>
              </div>
            </CollapsibleSection>

            {/* Dynamic recommendation — always visible for workflow speed */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                  <Lightbulb className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                    Recommended Action
                  </p>
                  {nextBest.completedTitle ? (
                    <p className="mt-1 text-sm font-semibold text-emerald-700">
                      {nextBest.completedTitle}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      "text-sm font-semibold text-slate-900",
                      nextBest.completedTitle ? "mt-1.5" : "mt-1"
                    )}
                  >
                    {nextBest.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {nextBest.description}
                  </p>
                </div>
              </div>
            </div>

            <CollapsibleSection
              id="lead-details"
              title="Lead Details"
              expanded={isSectionExpanded("lead-details")}
              onToggle={toggleSection}
            >
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{liveRow.phone}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {liveRow.email ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">School Type</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {liveRow.school_type ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Submitted</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {formatDate(liveRow.created_at)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">{messageLabel}</dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">
                    {liveRow.message?.trim() ? liveRow.message : "—"}
                  </dd>
                </div>
              </dl>
            </CollapsibleSection>

            <NextDeadlineCard deadline={nextDeadline} />

            <CollapsibleSection
              id="pipeline"
              title="Pipeline"
              expanded={isSectionExpanded("pipeline")}
              onToggle={toggleSection}
            >
              <div className="space-y-4">
                <div>
                  <label htmlFor="demo-lead-owner" className="block text-sm font-medium text-slate-700">
                    Lead Owner
                  </label>
                  <select
                    id="demo-lead-owner"
                    value={leadOwner}
                    onChange={(e) => setLeadOwner(e.target.value)}
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    {LEAD_OWNER_OPTIONS.map((option) => (
                      <option key={option.id || "unassigned"} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="demo-status" className="block text-sm font-medium text-slate-700">
                    Stage
                  </label>
                  <div
                    className={cn(
                      "mt-2 overflow-hidden rounded-lg border border-slate-300 border-l-4 bg-white",
                      pipelineStageSelectAccentClass(status)
                    )}
                  >
                    <select
                      id="demo-status"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as DemoRequestRow["status"])
                      }
                      className="block w-full border-0 bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-0"
                    >
                      {DEMO_REQUEST_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {status === "Lost" ? (
                  <div>
                    <label
                      htmlFor="demo-lost-reason"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Lost Reason <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="demo-lost-reason"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      className={cn(
                        "mt-2 block w-full rounded-lg border bg-white px-3 py-2.5 text-sm",
                        !lostReason
                          ? "border-red-300 ring-1 ring-red-200"
                          : "border-slate-300"
                      )}
                    >
                      <option value="">Select reason…</option>
                      {LOST_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                    {!lostReason ? (
                      <p className="mt-1.5 text-xs text-red-600">
                        Required when marking a lead as Lost.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {status === "Won" ? (
                  <div>
                    <label
                      htmlFor="demo-won-reason"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Won Reason <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="demo-won-reason"
                      value={wonReason}
                      onChange={(e) => setWonReason(e.target.value)}
                      className={cn(
                        "mt-2 block w-full rounded-lg border bg-white px-3 py-2.5 text-sm",
                        !wonReason
                          ? "border-red-300 ring-1 ring-red-200"
                          : "border-slate-300"
                      )}
                    >
                      <option value="">Select reason…</option>
                      {WON_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                    {!wonReason ? (
                      <p className="mt-1.5 text-xs text-red-600">
                        Required when marking a lead as Won.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="demo-next-action" className="block text-sm font-medium text-slate-700">
                      Next Action
                    </label>
                    <select
                      id="demo-next-action"
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">None</option>
                      {DEMO_REQUEST_NEXT_ACTIONS.map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="demo-next-action-date" className="block text-sm font-medium text-slate-700">
                      Due Date
                    </label>
                    <input
                      id="demo-next-action-date"
                      type="date"
                      value={nextActionDate}
                      onChange={(e) => setNextActionDate(e.target.value)}
                      className={cn(
                        "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm",
                        overdue &&
                          nextAction &&
                          "border-red-300 text-red-700 ring-1 ring-red-200"
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Calendar className="h-4 w-4 text-amber-600" aria-hidden />
                    Demo Scheduling
                  </h4>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="demo-date" className="block text-xs font-medium text-slate-600">
                        Demo Date
                      </label>
                      <input
                        id="demo-date"
                        type="date"
                        value={demoDate}
                        onChange={(e) => setDemoDate(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="demo-time" className="block text-xs font-medium text-slate-600">
                        Demo Time
                      </label>
                      <input
                        id="demo-time"
                        type="time"
                        value={demoTime}
                        onChange={(e) => setDemoTime(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="meeting-link" className="block text-xs font-medium text-slate-600">
                        Meeting Link
                      </label>
                      <input
                        id="meeting-link"
                        type="url"
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                        placeholder="https://…"
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCrmAction("demo_invitation_generated")}
                      disabled={crmLoading !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      {crmLoading === "demo_invitation_generated"
                        ? "Generating…"
                        : "Generate Demo Invitation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCrmAction("google_meet_created")}
                      disabled={crmLoading !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Video className="h-3.5 w-3.5" aria-hidden />
                      {crmLoading === "google_meet_created"
                        ? "Creating…"
                        : "Create Google Meet"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCrmAction("zoom_meeting_created")}
                      disabled={crmLoading !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Video className="h-3.5 w-3.5" aria-hidden />
                      {crmLoading === "zoom_meeting_created"
                        ? "Creating…"
                        : "Create Zoom Meeting"}
                    </button>
                  </div>
                  {invitation ? (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Demo Invitation
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {invitation.subject}
                      </p>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                        {invitation.body}
                      </pre>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyInvitation()}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          Copy Invitation
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(invitation.mailto, "_blank", "noopener,noreferrer")
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Open Email App
                        </button>
                        {row.email ? (
                          <button
                            type="button"
                            onClick={() =>
                              window.open(invitation.mailto, "_blank", "noopener,noreferrer")
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                          >
                            Send via Email
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="internal-notes"
              title="Internal Notes"
              expanded={isSectionExpanded("internal-notes")}
              onToggle={toggleSection}
            >
              {!loadingDetail && notes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-sm leading-relaxed text-slate-600">
                  <p className="font-medium text-slate-800">No notes yet</p>
                  <p className="mt-2 text-slate-600">Capture:</p>
                  <ul className="mt-2 space-y-1 text-slate-600">
                    <li>• Pain points</li>
                    <li>• Budget concerns</li>
                    <li>• Decision makers</li>
                    <li>• Follow-up commitments</li>
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Add an internal note…"
                  className="min-w-0 flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddNote()}
                  disabled={addingNote || !noteDraft.trim()}
                  className="shrink-0 self-end rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {addingNote ? "Adding…" : "Add note"}
                </button>
              </div>
              <NoteTemplateChips
                templates={NOTE_TEMPLATES}
                onSelect={(text) => setNoteDraft(text)}
              />
            </CollapsibleSection>

            <CollapsibleSection
              id="conversation-history"
              title="Conversation History"
              expanded={isSectionExpanded("conversation-history")}
              onToggle={toggleSection}
            >
              <p className="text-sm text-slate-500">
                The story of this deal — every touchpoint in one place.
              </p>
              <TimelineFilterBar
                value={timelineFilter}
                onChange={setTimelineFilter}
              />
              {loadingDetail ? (
                <p className="mt-4 text-sm text-slate-500">Loading history…</p>
              ) : conversationHistory.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No activity yet. Contact the school to start the timeline.
                </p>
              ) : filteredHistory.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No {timelineFilter === "all" ? "events" : timelineFilter} in this timeline.
                </p>
              ) : (
                <ol className="relative mt-6 space-y-0">
                  {filteredHistory.map((item, index) => {
                    const Icon = timelineIcon(item.eventType ?? "", item.label);
                    const iconClass = timelineActivityIconClass(
                      item.eventType ?? "",
                      item.label
                    );
                    const isLast = index === filteredHistory.length - 1;
                    return (
                      <li key={item.id} className="relative flex gap-4 pb-8">
                        {!isLast ? (
                          <span
                            className="absolute left-[1.125rem] top-10 bottom-0 w-px bg-slate-200"
                            aria-hidden
                          />
                        ) : null}
                        <div
                          className={cn(
                            "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-sm",
                            iconClass
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.label}
                            </p>
                            <time
                              className="text-xs tabular-nums text-slate-400"
                              dateTime={item.createdAt}
                            >
                              {formatTimelineDay(item.createdAt)} ·{" "}
                              {formatTime(item.createdAt)}
                            </time>
                          </div>
                          {item.detail ? (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                              {item.detail}
                            </p>
                          ) : null}
                          {item.actorName ? (
                            <p className="mt-1.5 text-xs text-slate-500">
                              by {item.actorName}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CollapsibleSection>
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-5">
          <div className="mb-2 flex items-center justify-end gap-2 text-xs text-slate-500">
            {hasUnsavedChanges ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                <span className="font-medium text-amber-700">Unsaved changes</span>
              </>
            ) : (
              <span>No unsaved changes</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </button>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || deleting || !hasUnsavedChanges}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>

              <div className="relative" ref={saveContactRef}>
                <div className="flex rounded-lg shadow-sm">
                  <button
                    type="button"
                    onClick={() => void saveAndContact("whatsapp")}
                    disabled={saving || deleting || !whatsAppHref}
                    className="rounded-l-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Save & Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveContactOpen((v) => !v)}
                    disabled={saving || deleting}
                    className="rounded-r-lg border-l border-emerald-500 bg-emerald-600 px-2 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
                    aria-expanded={saveContactOpen}
                    aria-label="Choose contact method"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                {saveContactOpen ? (
                  <div className="absolute bottom-full right-0 z-30 mb-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {whatsAppHref ? (
                      <SaveContactOption
                        label="WhatsApp"
                        onClick={() => void saveAndContact("whatsapp")}
                      />
                    ) : null}
                    {callHref ? (
                      <SaveContactOption
                        label="Call"
                        onClick={() => void saveAndContact("call")}
                      />
                    ) : null}
                    {emailHref ? (
                      <SaveContactOption
                        label="Email"
                        onClick={() => void saveAndContact("email")}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {winCelebration ? (
        <WinCelebrationModal
          data={winCelebration}
          onClose={() => setWinCelebration(null)}
        />
      ) : null}

      {contactModal === "call" && callHref ? (
        <CallSchoolModal
          lead={{
            school_name: liveRow.school_name,
            full_name: liveRow.full_name,
            phone: row.phone,
          }}
          context={contactModalContext}
          onClose={() => setContactModal(null)}
          onMarkCalled={handleMarkCalled}
        />
      ) : null}

      {contactModal === "email" && emailHref && row.email ? (
        <EmailSchoolModal
          lead={{
            school_name: liveRow.school_name,
            full_name: liveRow.full_name,
            email: row.email,
          }}
          context={contactModalContext}
          onClose={() => setContactModal(null)}
          onMarkEmailed={handleMarkEmailed}
        />
      ) : null}
    </div>
  );
}

function SaveContactOption({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      Save & {label}
    </button>
  );
}

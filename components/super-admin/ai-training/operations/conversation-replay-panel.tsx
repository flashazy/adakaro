"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, MessageSquare } from "lucide-react";
import { saSection, saSectionSubtitle, saSectionTitle } from "@/components/super-admin/super-admin-dashboard-ui";
import { formatDateTime } from "@/components/super-admin/ai-training/shared";
import { buildConversationReplay } from "@/lib/ai-training/operations-presentation";
import type { LearningEventRow } from "@/lib/ai-training/learning-types";
import { cn } from "@/lib/utils";
import { GlassPanel } from "./operations-premium-ui";

export function ConversationReplayPanel() {
  const [events, setEvents] = useState<LearningEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/ai-training/learning/events?section=all");
      if (!res.ok) return;
      const data = (await res.json()) as { events?: LearningEventRow[] };
      setEvents((data.events ?? []).slice(0, 20));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={cn(saSection, "flex justify-center py-12")}>
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <GlassPanel>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-indigo-600" />
        <h3 className={saSectionTitle}>AI Conversation Replay</h3>
      </div>
      <p className={saSectionSubtitle}>
        Full transparency — question to match, confidence, outcome, and learning path
      </p>

      {events.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">No interactions captured yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {events.map((event) => {
            const open = expandedId === event.id;
            const steps = buildConversationReplay(event);
            return (
              <li key={event.id} className="rounded-xl border border-slate-200 bg-white/80">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
                  onClick={() => setExpandedId(open ? null : event.id)}
                >
                  {open ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{event.original_question}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {event.answer_status} · {event.confidence_level} · {formatDateTime(event.created_at)}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <ol className="relative space-y-0">
                      {steps.map((step, idx) => (
                        <li key={step.label} className="flex gap-4 pb-4 last:pb-0">
                          <div className="flex flex-col items-center">
                            <span
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                                step.tone === "success"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : step.tone === "warning"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {idx + 1}
                            </span>
                            {idx < steps.length - 1 ? (
                              <span className="mt-1 w-px flex-1 bg-indigo-200" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                              {step.label}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-800">{step.value}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}

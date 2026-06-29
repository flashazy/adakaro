"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, MessageSquare } from "lucide-react";
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
      setEvents((data.events ?? []).slice(0, 15));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <GlassPanel compact className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel compact>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-sky-600" />
        <h3 className="text-xs font-semibold text-slate-900">AI Conversation Replay</h3>
      </div>
      <p className="text-[10px] text-slate-500">Question → match → confidence → outcome</p>

      {events.length === 0 ? (
        <p className="mt-3 text-center text-xs text-slate-400">No interactions captured yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {events.map((event) => {
            const open = expandedId === event.id;
            const steps = buildConversationReplay(event);
            return (
              <li key={event.id} className="rounded-lg border border-slate-200/80 bg-white/80">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors duration-200 hover:bg-slate-50/80"
                  onClick={() => setExpandedId(open ? null : event.id)}
                >
                  {open ? (
                    <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-900">{event.original_question}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {event.answer_status} · {event.confidence_level} · {formatDateTime(event.created_at)}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="border-t border-slate-100 px-3 py-2">
                    <ol className="relative space-y-0">
                      {steps.map((step, idx) => (
                        <li key={step.label} className="relative flex gap-2 pb-2 last:pb-0">
                          {idx < steps.length - 1 ? (
                            <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />
                          ) : null}
                          <span
                            className={cn(
                              "relative z-10 mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold",
                              step.tone === "success"
                                ? "bg-emerald-100 text-emerald-700"
                                : step.tone === "warning"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-sky-100 text-sky-700"
                            )}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-[10px] font-semibold text-slate-800">{step.label}</p>
                            <p className="text-[10px] text-slate-600">{step.value}</p>
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

/**
 * Copilot operational event logging — routing failures, permission denials, etc.
 * Logs to console in development; persists lightweight metrics for the AI Ops dashboard.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type CopilotEventType =
  | "routing_failure"
  | "permission_denied"
  | "role_unresolved"
  | "ambiguous_query"
  | "copilot_disabled";

export interface CopilotEvent {
  type: CopilotEventType;
  message: string;
  schoolId?: string | null;
  userId?: string | null;
  role?: string | null;
  module?: string | null;
  tool?: string | null;
  timestamp: string;
}

const recentEvents: CopilotEvent[] = [];
const MAX_RECENT = 200;

export function logCopilotEvent(event: Omit<CopilotEvent, "timestamp">): void {
  const full: CopilotEvent = { ...event, timestamp: new Date().toISOString() };
  recentEvents.unshift(full);
  if (recentEvents.length > MAX_RECENT) recentEvents.pop();

  if (process.env.NODE_ENV === "development") {
    console.info("[copilot-event]", full.type, {
      message: full.message.slice(0, 80),
      role: full.role,
      module: full.module,
      tool: full.tool,
    });
  }
}

export function getRecentCopilotEvents(limit = 50): CopilotEvent[] {
  return recentEvents.slice(0, limit);
}

export function getCopilotEventSummary(): {
  routingFailures: number;
  permissionFailures: number;
  roleUnresolved: number;
  ambiguousQueries: number;
} {
  return {
    routingFailures: recentEvents.filter((e) => e.type === "routing_failure").length,
    permissionFailures: recentEvents.filter((e) => e.type === "permission_denied").length,
    roleUnresolved: recentEvents.filter((e) => e.type === "role_unresolved").length,
    ambiguousQueries: recentEvents.filter((e) => e.type === "ambiguous_query").length,
  };
}

/** Persist copilot unanswered question (async, non-blocking). */
export async function persistCopilotUnanswered(
  question: string,
  schoolId?: string | null,
  role?: string | null
): Promise<void> {
  try {
    const admin = createAdminClient();
    const normalized = question.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized) return;

    const { data: existing } = await admin
      .from("ai_unanswered_questions")
      .select("id, occurrences")
      .eq("normalized_question", normalized)
      .eq("source", "copilot")
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      const row = existing as { id: string; occurrences: number };
      await admin
        .from("ai_unanswered_questions")
        .update({
          occurrences: row.occurrences + 1,
          last_seen_at: now,
          status: "pending",
        } as never)
        .eq("id", row.id);
    } else {
      await admin.from("ai_unanswered_questions").insert({
        question: question.trim(),
        normalized_question: normalized,
        source: "copilot",
        status: "pending",
        first_seen_at: now,
        last_seen_at: now,
      } as never);
    }

    logCopilotEvent({
      type: "routing_failure",
      message: question,
      schoolId,
      role,
    });
  } catch (e) {
    console.error("[copilot-events] persist unanswered:", e);
  }
}

/**
 * Session memory helpers — interpret follow-ups in conversation context.
 */

import type { ConversationFilters } from "@/lib/ai/copilot/types";
import type { CopilotIntentType } from "@/lib/ai/adakaro-registry";
import { findRegistryCard } from "@/lib/ai/adakaro-registry";

export interface SessionContext {
  /** Last data tool executed in this conversation. */
  lastDataTool?: string;
  /** Last module id discussed. */
  lastModuleId?: string;
  /** Last card label discussed. */
  lastCardLabel?: string;
  /** Prior conversation text for filter parsing. */
  priorText: string;
}

const EXPORT_RE = /\b(export|download|print|share)\b/i;
const COMPARE_RE = /\b(compare|versus|vs\.?|compared to|against last)\b/i;
const FILTER_RE = /^(only|just|filter)\b/i;

export function extractSessionContext(
  priorMessages: Array<{ role: string; content: string }>
): SessionContext {
  const priorText = priorMessages
    .slice(-10)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  let lastDataTool: string | undefined;
  let lastModuleId: string | undefined;
  let lastCardLabel: string | undefined;

  for (let i = priorMessages.length - 1; i >= 0; i--) {
    const msg = priorMessages[i];
    if (!msg || msg.role !== "assistant") continue;

    const cardMatch = findRegistryCard(msg.content);
    if (cardMatch && !lastDataTool && cardMatch.card.dataTool) {
      lastDataTool = cardMatch.card.dataTool;
      lastModuleId = cardMatch.module.id;
      lastCardLabel = cardMatch.card.label;
      break;
    }

    // Scan assistant headings like **Monthly Income**
    const heading = msg.content.match(/^\*\*([^*]+)\*\*/m);
    if (heading?.[1] && !lastCardLabel) {
      const match = findRegistryCard(heading[1]);
      if (match) {
        lastDataTool = match.card.dataTool;
        lastModuleId = match.module.id;
        lastCardLabel = match.card.label;
        break;
      }
    }
  }

  return { lastDataTool, lastModuleId, lastCardLabel, priorText };
}

export function isSessionRefinement(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return (
    FILTER_RE.test(lower) ||
    EXPORT_RE.test(lower) ||
    COMPARE_RE.test(lower) ||
    lower.split(/\s+/).length <= 4
  );
}

export function resolveRefinementIntent(
  message: string,
  session: SessionContext
): CopilotIntentType | null {
  const lower = message.toLowerCase().trim();

  if (EXPORT_RE.test(lower) && session.lastDataTool) {
    return "report_request";
  }
  if (COMPARE_RE.test(lower) && session.lastDataTool) {
    return "comparison";
  }
  if (FILTER_RE.test(lower) && session.lastDataTool) {
    return "data_lookup";
  }
  if (isSessionRefinement(message) && session.lastDataTool) {
    return "data_lookup";
  }
  return null;
}

export function mergeFiltersWithSession(
  message: string,
  session: SessionContext,
  filters: ConversationFilters
): ConversationFilters {
  const text = `${session.priorText} ${message}`.toLowerCase();

  if (text.includes("sort by balance") || text.includes("top debtor") || text.includes("highest balance")) {
    filters.sortByBalance = true;
  }
  if (text.includes("top 10") || text.includes("top ten")) {
    filters.limit = 10;
  } else if (text.includes("top 5")) {
    filters.limit = 5;
  }

  const formMatch = text.match(/form\s*(\d+)/i);
  if (formMatch?.[1] && !filters.classFilter) {
    filters.classFilter = `Form ${formMatch[1]}`;
  }

  if (COMPARE_RE.test(message) && text.includes("last term")) {
    (filters as ConversationFilters & { compareLastTerm?: boolean }).compareLastTerm = true;
  }

  return filters;
}

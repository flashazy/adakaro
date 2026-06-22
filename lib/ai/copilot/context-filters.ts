import type { ConversationFilters } from "./types";

export function parseConversationFilters(
  message: string,
  priorText: string
): ConversationFilters {
  const text = `${priorText} ${message}`.toLowerCase();
  const filters: ConversationFilters = {};

  const gradeMatch =
    text.match(/grade\s*(\d+[a-z]?)/i) ??
    text.match(/form\s*(\d+)/i) ??
    text.match(/only\s+(\d+[a-z]?)/i);
  if (gradeMatch?.[1]) {
    filters.gradeFilter = gradeMatch[1].toUpperCase();
  }

  const classMatch = text.match(/class\s+([a-z0-9]+)/i);
  if (classMatch?.[1]) {
    filters.classFilter = classMatch[1];
  }

  if (
    text.includes("highest balance") ||
    text.includes("sort by balance") ||
    text.includes("top debtor")
  ) {
    filters.sortByBalance = true;
  }

  if (text.includes("top 10") || text.includes("top ten")) {
    filters.limit = 10;
  } else if (text.includes("top 5") || text.includes("top five")) {
    filters.limit = 5;
  }

  return filters;
}

export function buildPriorContext(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .slice(-10)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}

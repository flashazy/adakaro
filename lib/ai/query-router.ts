/**
 * Copilot query router — classifies intent, then routes to the correct module/card.
 */

import type { ConversationFilters } from "@/lib/ai/copilot/types";
import type { CopilotIntentType } from "@/lib/ai/adakaro-registry";
import { classifyCopilotIntent } from "@/lib/ai/intent-classifier";
import {
  extractSessionContext,
  resolveRefinementIntent,
  mergeFiltersWithSession,
} from "@/lib/ai/copilot/session-memory";
import {
  findDashboardTopic,
  findRegistryCard,
  findRegistryModule,
  findAmbiguousRegistryMatches,
  DASHBOARD_TOPICS,
  type DashboardModule,
  type DashboardIntentKind,
} from "@/lib/ai/dashboard-context";

export interface RoutedQuery {
  tool: string;
  module: DashboardModule;
  kind: DashboardIntentKind;
  intentType: CopilotIntentType;
  classFilter?: string;
  topicId?: string;
  href?: string;
  description?: string;
  label?: string;
  dashboardPage?: string;
  confidence: "high" | "medium" | "low";
  /** True when multiple cards match — caller should clarify. */
  ambiguous?: boolean;
  ambiguousOptions?: Array<{ label: string; moduleName: string }>;
}

function topicFromRegistry(
  intentType: CopilotIntentType,
  message: string
): RoutedQuery | null {
  const cardMatch = findRegistryCard(message);
  const moduleMatch = findRegistryModule(message);

  // Data intents prefer cards with data tools.
  if (
    intentType === "data_lookup" ||
    intentType === "comparison" ||
    intentType === "analysis" ||
    intentType === "report_request"
  ) {
    if (cardMatch?.card.dataTool) {
      const topic = findDashboardTopic(cardMatch.card.label);
      if (topic) {
        return {
          tool: cardMatch.card.dataTool,
          module: topic.module,
          kind: "data",
          intentType,
          topicId: topic.id,
          href: topic.href,
          label: cardMatch.card.label,
          description: cardMatch.card.description,
          dashboardPage: cardMatch.module.dashboardPage,
          confidence: "high",
        };
      }
    }

    const topic = findDashboardTopic(message);
    if (topic?.kind === "data") {
      return {
        tool: topic.tool,
        module: topic.module,
        kind: "data",
        intentType,
        topicId: topic.id,
        href: topic.href,
        description: topic.description,
        label: topic.label,
        dashboardPage: topic.dashboardPage,
        confidence: "high",
      };
    }
  }

  // Navigation / explanation → module help.
  if (
    intentType === "navigation" ||
    intentType === "explanation" ||
    intentType === "action_request"
  ) {
    const mod = moduleMatch ?? cardMatch?.module;
    if (mod) {
      const topic = findDashboardTopic(mod.name) ?? findDashboardTopic(mod.keywords[0] ?? "");
      const navTopic = dashboardTopicsNav(mod.id);
      return {
        tool: navTopic?.tool ?? mod.navigationTool,
        module: navTopic?.module ?? "overview",
        kind: "navigation",
        intentType,
        topicId: mod.id,
        href: mod.route,
        description: mod.description,
        label: mod.name,
        dashboardPage: mod.dashboardPage,
        confidence: "high",
      };
    }
  }

  // Explanation of a card metric without data fetch.
  if (intentType === "explanation" && cardMatch) {
    const mod = cardMatch.module;
    return {
      tool: mod.navigationTool,
      module: findDashboardTopic(mod.name)?.module ?? "overview",
      kind: "navigation",
      intentType,
      topicId: cardMatch.card.id,
      href: mod.route,
      description: cardMatch.card.description,
      label: cardMatch.card.label,
      dashboardPage: mod.dashboardPage,
      confidence: "high",
    };
  }

  return null;
}

function dashboardTopicsNav(moduleId: string) {
  return DASHBOARD_TOPICS.find(
    (t) => t.kind === "navigation" && t.registryModuleId === moduleId
  );
}

function checkAmbiguity(message: string): RoutedQuery["ambiguousOptions"] | null {
  const matches = findAmbiguousRegistryMatches(message, 5);
  if (matches.length < 2) return null;
  const top = matches[0]!;
  const second = matches[1]!;
  if (top.score - second.score < 2) {
    return matches.slice(0, 3).map((m) => ({
      label: m.card.label,
      moduleName: m.module.dashboardPage,
    }));
  }
  return null;
}

export function routeCopilotQuery(
  message: string,
  priorContext: string,
  filters: ConversationFilters,
  priorMessages: Array<{ role: string; content: string }> = []
): RoutedQuery | null {
  const current = message.toLowerCase().trim();
  const session = extractSessionContext(priorMessages);
  const mergedFilters = mergeFiltersWithSession(message, session, { ...filters });

  const classified = classifyCopilotIntent(message);

  // Session refinement ("only Form 4", "export this", "compare with last term").
  const refinementIntent = resolveRefinementIntent(message, session);
  if (refinementIntent && session.lastDataTool) {
    const topic = DASHBOARD_TOPICS.find((t) => t.tool === session.lastDataTool);
    if (topic) {
      return {
        tool: mergedFilters.sortByBalance && topic.module === "finance"
          ? "top_debtors"
          : session.lastDataTool,
        module: topic.module,
        kind: "data",
        intentType: refinementIntent,
        classFilter: resolveClassFilter(current, mergedFilters),
        topicId: topic.id,
        href: topic.href,
        label: topic.label,
        dashboardPage: topic.dashboardPage,
        confidence: "medium",
      };
    }
  }

  // Ambiguity check before routing.
  const ambiguousOptions = checkAmbiguity(current);
  if (ambiguousOptions && classified.confidence !== "high") {
    return {
      tool: "none",
      module: "overview",
      kind: "navigation",
      intentType: classified.type,
      confidence: "low",
      ambiguous: true,
      ambiguousOptions,
      label: "Clarification",
      description: "",
    };
  }

  const routed = topicFromRegistry(classified.type, current);
  if (routed) {
    routed.classFilter =
      routed.kind === "data"
        ? resolveClassFilter(current, mergedFilters)
        : undefined;
    return routed;
  }

  // Legacy topic match fallback (current message only).
  const topic = findDashboardTopic(current);
  if (topic) {
    return {
      tool: topic.tool,
      module: topic.module,
      kind: topic.kind,
      intentType: classified.type,
      classFilter:
        topic.kind === "data"
          ? resolveClassFilter(current, mergedFilters)
          : undefined,
      topicId: topic.id,
      href: topic.href,
      description: topic.description,
      label: topic.label,
      dashboardPage: topic.dashboardPage,
      confidence: classified.confidence === "high" ? "high" : "medium",
    };
  }

  return null;
}

function resolveClassFilter(
  text: string,
  filters: ConversationFilters
): string | undefined {
  if (filters.gradeFilter) return `Grade ${filters.gradeFilter}`;
  if (filters.classFilter) return filters.classFilter;
  const formMatch = text.match(/form\s*(\d+)/i);
  if (formMatch) return `Form ${formMatch[1]}`;
  return undefined;
}

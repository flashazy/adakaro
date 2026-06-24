import type { ConversationFilters } from "./types";
import { routeCopilotQuery } from "@/lib/ai/query-router";
import type {
  DashboardModule,
  DashboardIntentKind,
} from "@/lib/ai/dashboard-context";
import type { CopilotIntentType } from "@/lib/ai/adakaro-registry";

export interface DetectedIntent {
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
  ambiguous?: boolean;
  ambiguousOptions?: Array<{ label: string; moduleName: string }>;
}

export function detectCopilotIntent(
  message: string,
  priorContext: string,
  filters: ConversationFilters,
  priorMessages: Array<{ role: string; content: string }> = []
): DetectedIntent | null {
  const routed = routeCopilotQuery(
    message,
    priorContext,
    filters,
    priorMessages
  );
  if (!routed) return null;

  return {
    tool: routed.tool,
    module: routed.module,
    kind: routed.kind,
    intentType: routed.intentType,
    classFilter: routed.classFilter,
    topicId: routed.topicId,
    href: routed.href,
    description: routed.description,
    label: routed.label,
    dashboardPage: routed.dashboardPage,
    ambiguous: routed.ambiguous,
    ambiguousOptions: routed.ambiguousOptions,
  };
}

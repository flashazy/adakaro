/**
 * Conversational navigation and explanation responses with action chips.
 */

import type { AISuggestion } from "@/lib/ai/types";
import type {
  AdakaroRegistryEntry,
  RegistryCard,
  CopilotIntentType,
} from "@/lib/ai/adakaro-registry";
import type { CopilotMessageMeta } from "@/lib/ai/copilot/types";

export function buildModuleActions(
  module: AdakaroRegistryEntry,
  card?: RegistryCard | null
): AISuggestion[] {
  const actions: AISuggestion[] = [];

  if (module.route) {
    actions.push({
      id: `open-${module.id}`,
      label: "Open Page",
      prompt: `Open ${module.name}`,
    });
  }

  actions.push({
    id: `explain-${module.id}`,
    label: "Explain Feature",
    prompt: `What is ${module.name}?`,
  });

  const dataCard =
    card?.dataTool ? card : module.cards.find((c) => c.dataTool);
  if (dataCard?.dataTool) {
    actions.push({
      id: `stats-${dataCard.id}`,
      label: "Show Statistics",
      prompt: `Show ${dataCard.label}`,
    });
  }

  return actions.slice(0, 4);
}

export function buildNavigationContent(
  module: AdakaroRegistryEntry,
  intentType: CopilotIntentType
): string {
  const lines = [`**${module.name}**`, "", module.description];

  if (intentType === "navigation" || intentType === "action_request") {
    lines.push(
      "",
      "Would you like me to:",
      `• Explain ${module.name}`,
      module.route ? `• Open ${module.name}` : "",
      module.cards.some((c) => c.dataTool)
        ? `• Show ${module.name} statistics`
        : ""
    );
    if (module.route) {
      lines.push("", `→ [Open ${module.name}](${module.route})`);
    }
  }

  return lines.filter(Boolean).join("\n");
}

export function buildExplanationContent(
  module: AdakaroRegistryEntry,
  card?: RegistryCard | null
): string {
  if (card) {
    return [
      `**${card.label}**`,
      "",
      card.description,
      "",
      `_This metric is part of the ${module.dashboardPage} area in Adakaro._`,
      module.route ? `\n→ [Open ${module.name}](${module.route})` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const related = module.relatedModules
    .map((id) => id.replace(/_/g, " "))
    .slice(0, 3);

  const lines = [
    `**${module.name}**`,
    "",
    module.description,
  ];

  if (related.length > 0) {
    lines.push("", `Related areas: ${related.join(", ")}.`);
  }

  if (module.route) {
    lines.push("", `→ [Open ${module.name}](${module.route})`);
  }

  return lines.join("\n");
}

export function buildRegistryNavigationResponse(
  module: AdakaroRegistryEntry,
  intentType: CopilotIntentType,
  card?: RegistryCard | null,
  schoolName?: string | null
): { content: string; meta: CopilotMessageMeta } {
  const isExplanation = intentType === "explanation";
  const content = isExplanation
    ? buildExplanationContent(module, card)
    : buildNavigationContent(module, intentType);

  return {
    content: schoolName ? `**${schoolName}**\n\n${content}` : content,
    meta: {
      schoolName: schoolName ?? undefined,
      responseType: "summary",
      confidence: "high",
      blocks: [],
      actions: buildModuleActions(module, card),
    },
  };
}

export function buildClarificationContent(
  options: Array<{ label: string; moduleName: string }>
): string {
  if (options.length === 0) {
    return "Could you tell me a bit more about what you'd like to see?";
  }
  if (options.length === 1) {
    return `Did you mean **${options[0]!.label}** from the ${options[0]!.moduleName} dashboard?`;
  }
  const list = options
    .slice(0, 3)
    .map((o) => `• **${o.label}** (${o.moduleName})`)
    .join("\n");
  return `I want to make sure I help with the right thing. Did you mean:\n\n${list}`;
}

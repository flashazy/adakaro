import type { CopilotContext } from "@/lib/ai/types";
import type { CopilotMessageMeta } from "./types";
import {
  clarificationMessage,
  findAmbiguousHint,
  findDashboardTopic,
  findAmbiguousRegistryMatches,
} from "@/lib/ai/dashboard-context";
import { buildClarificationContent } from "@/lib/ai/copilot/navigation-response";
import { findRegistryModule } from "@/lib/ai/adakaro-registry";

export function buildCopilotFallback(
  message: string,
  ctx: CopilotContext
): { content: string; meta: CopilotMessageMeta } {
  const schoolLabel = ctx.schoolName ?? "Your school";

  const ambiguous = findAmbiguousRegistryMatches(message, 4);
  if (ambiguous.length > 1) {
    const options = ambiguous.slice(0, 3).map((m) => ({
      label: m.card.label,
      moduleName: m.module.dashboardPage,
    }));
    return {
      content: [`**${schoolLabel}**`, "", buildClarificationContent(options)].join(
        "\n"
      ),
      meta: {
        schoolName: ctx.schoolName ?? undefined,
        responseType: "summary",
        confidence: "low",
        blocks: [],
        actions: options.map((o, i) => ({
          id: `clarify-${i}`,
          label: o.label,
          prompt: `Show ${o.label}`,
        })),
      },
    };
  }

  const mod = findRegistryModule(message);
  if (mod) {
    return {
      content: [
        `**${schoolLabel}**`,
        "",
        `**${mod.name}**`,
        "",
        mod.description,
        "",
        `Would you like to open ${mod.name} or see statistics?`,
      ].join("\n"),
      meta: {
        schoolName: ctx.schoolName ?? undefined,
        responseType: "summary",
        confidence: "low",
        blocks: [],
        actions: [
          { id: "open", label: "Open Page", prompt: `Open ${mod.name}` },
          {
            id: "explain",
            label: "Explain Feature",
            prompt: `What is ${mod.name}?`,
          },
        ],
      },
    };
  }

  const guess = findDashboardTopic(message) ?? findAmbiguousHint(message);
  const content = [
    `**${schoolLabel}**`,
    "",
    clarificationMessage(guess),
  ].join("\n");

  return {
    content,
    meta: {
      schoolName: ctx.schoolName ?? undefined,
      responseType: "summary",
      confidence: "none",
      blocks: [],
      actions: guess
        ? [{ id: "try", label: guess.label, prompt: `Show ${guess.label}` }]
        : [],
    },
  };
}

import type { CopilotContext } from "@/lib/ai/types";
import type { CopilotMessageMeta } from "./types";
import { followUpActionsForTool } from "./follow-ups";

export function buildCopilotFallback(
  message: string,
  ctx: CopilotContext
): { content: string; meta: CopilotMessageMeta } {
  const schoolLabel = ctx.schoolName ?? "Your school";

  const content = [
    `**${schoolLabel}**`,
    "",
    "I don't currently have enough school data to answer that question confidently.",
    "",
    "You may be able to answer this after:",
    "• Recording attendance",
    "• Adding finance records",
    "• Completing AI training in the Training Center",
    "",
    "Try asking about fee balances, attendance, syllabus coverage, or report cards — I can help with those when data is available.",
  ].join("\n");

  return {
    content,
    meta: {
      schoolName: ctx.schoolName ?? undefined,
      responseType: "recommendations",
      confidence: "none",
      blocks: [
        {
          type: "recommendations",
          items: [
            "Record attendance for today",
            "Add fee payments and outstanding balances",
            "Set up syllabus topics for coverage tracking",
            "Add knowledge entries in AI Training Center",
          ],
        },
      ],
      actions: followUpActionsForTool("none", message),
    },
  };
}

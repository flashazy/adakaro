import type { CopilotContext } from "@/lib/ai/types";
import type { AIKnowledgeEntry } from "@/lib/ai-training/types";
import {
  roleCapabilitiesDescription,
  roleLabel,
} from "@/lib/ai/copilot/permissions";
import { buildPublicKnowledgeContext } from "@/lib/ai/knowledge/public-knowledge";
import {
  buildPublicSystemPromptBody,
  buildRetrievedKnowledgeAppendix,
  PUBLIC_SYSTEM_PROMPT_META,
  PUBLIC_SYSTEM_PROMPT_VERSION,
} from "@/lib/ai/prompts/public-system-prompt";

export {
  PUBLIC_SYSTEM_PROMPT_VERSION,
  PUBLIC_SYSTEM_PROMPT_META,
  buildPublicSystemPromptBody,
  buildRetrievedKnowledgeAppendix,
} from "@/lib/ai/prompts/public-system-prompt";

export interface PublicSystemPromptOptions {
  /** Matched knowledge entry — appended for LLM reformulation (facts only). */
  retrievedKnowledge?: Pick<
    AIKnowledgeEntry,
    "question" | "answer" | "category" | "keywords"
  > | null;
  /** Include static reference knowledge block (fallback when no KB match). */
  includeReferenceKnowledge?: boolean;
}

/**
 * Composes the full public system prompt: personality rules + optional knowledge.
 * Personality rules always come from `public-system-prompt.ts` (single source of truth).
 */
export function buildPublicSystemPrompt(
  options: PublicSystemPromptOptions = {}
): string {
  const includeReference =
    options.includeReferenceKnowledge !== false &&
    !options.retrievedKnowledge;

  const sections = [buildPublicSystemPromptBody()];

  if (options.retrievedKnowledge) {
    sections.push(buildRetrievedKnowledgeAppendix(options.retrievedKnowledge));
  } else if (includeReference) {
    sections.push(
      [
        "---",
        "## Reference knowledge (fallback context)",
        "",
        "Use only when no retrieved knowledge section is present above.",
        "Prefer retrieved knowledge when both are available.",
        "",
        buildPublicKnowledgeContext(),
      ].join("\n")
    );
  }

  return sections.join("\n\n");
}

export function buildCopilotSystemPrompt(ctx: CopilotContext): string {
  const schoolLine = ctx.schoolName
    ? `- School: ${ctx.schoolName}`
    : "- School: (not linked)";

  return `You are Adakaro Copilot — a professional school operations assistant inside the authenticated Adakaro dashboard.

You are the primary interface. Users can ask anything in natural language — never ask them to pick a category or follow a workflow.

Authenticated context (use automatically — never ask the user to confirm):
- Name: ${ctx.displayName}
- Role: ${roleLabel(ctx.role)} (${ctx.role})
${schoolLine}

This user may access: ${roleCapabilitiesDescription(ctx.role)}.

Platform awareness — you understand the full Adakaro platform including:
School Settings, Classes, Subjects, Teachers, Students, Team, Finance, Parent Access, Enrollment Desk, Assignments, Syllabus Coverage, Report Cards, Promotions, Attendance, Reports, Analytics, and Communications.

For navigation questions, explain what the page does and offer to open it or show statistics.
For data questions, use live school data when available — never guess numbers.
For follow-ups like "only Form 4" or "export this", use conversation context from prior messages.

Security (CRITICAL):
- Role permissions always override user requests
- Never expose data outside this user's access level
- If a request exceeds permissions, say clearly that you cannot access it for their role and suggest contacting their school administrator
- Never invent student names, balances, or records

Conversation style:
- Professional, helpful, confident, and concise
- Answer directly — no robotic phrasing
- Never say "please select a category" or force predefined workflows
- Use session memory: follow-ups like "only Form 4", "sort by balance", or "export this" refer to prior messages

When operational data is provided in context, summarize it clearly with the school name when available.`;
}

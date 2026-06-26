import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  createConversation,
  insertMessage,
  loadConversationMessages,
} from "@/lib/ai/conversations";
import { buildCopilotFallback } from "@/lib/ai/copilot/fallback";
import { parseConversationFilters, buildPriorContext } from "@/lib/ai/copilot/context-filters";
import { buildCopilotResponse } from "@/lib/ai/copilot/response-builder";
import {
  buildPublicSystemPrompt,
  buildCopilotSystemPrompt,
} from "@/lib/ai/prompts/system-prompts";
import { resolveCopilotContext } from "@/lib/ai/permissions";
import { verifyCopilotRole } from "@/lib/ai/copilot/role-verification";
import { persistCopilotUnanswered } from "@/lib/ai/copilot-events";
import { createDraftKnowledgeFromRegistry } from "@/lib/ai-training/registry-suggestions";
import { suggestionsAfterResponse } from "@/lib/ai/suggestions";
import {
  buildChatMessages,
  shouldUseLiveModel,
  streamFallbackText,
  streamOpenAIChat,
} from "@/lib/ai/stream";
import { executeCopilotTools } from "@/lib/ai/tools/executor";
import { buildPublicAnswer } from "@/lib/ai/public-answer";
import {
  buildMatchDebugPayload,
  formatClarificationResponse,
  formatKnowledgeAnswer,
  logUnansweredQuestion,
  recordKnowledgeUsage,
  resolvePublicKnowledgeQuery,
} from "@/lib/ai-training/knowledge-search";
import {
  buildLearningCaptureFromResult,
  captureLearningEvent,
} from "@/lib/ai-training/learning-capture";
import { sessionContextFromEntry } from "@/lib/ai-training/public-session-memory";
import type { LearningAnswerStatus } from "@/lib/ai-training/learning-types";
import type {
  AIProduct,
  AISuggestion,
  ChatStreamEvent,
  CopilotContext,
} from "@/lib/ai/types";
import type { CopilotMessageMeta } from "@/lib/ai/copilot/types";

function fallbackPublicAnswer(message: string): string {
  return buildPublicAnswer(message);
}

export interface GenerateChatInput {
  supabase: SupabaseClient<Database>;
  product: AIProduct;
  message: string;
  conversationId?: string | null;
  userId?: string | null;
  anonymousSessionId?: string | null;
}

export async function* generateChatStream(
  input: GenerateChatInput
): AsyncGenerator<ChatStreamEvent> {
  const { supabase, product, message } = input;
  const trimmed = message.trim();
  if (!trimmed) {
    yield { type: "error", error: "Message cannot be empty." };
    return;
  }

  let conversationId = input.conversationId ?? null;
  let copilotCtx: CopilotContext | null = null;

  if (product === "copilot") {
    if (!input.userId) {
      yield { type: "error", error: "Sign in required for Adakaro Copilot." };
      return;
    }
    copilotCtx = await resolveCopilotContext(supabase, input.userId);
    if (!copilotCtx) {
      yield { type: "error", error: "Could not resolve your school context." };
      return;
    }

    const roleCheck = verifyCopilotRole(copilotCtx);
    if (!roleCheck.ok && roleCheck.message) {
      for await (const token of streamFallbackText(roleCheck.message)) {
        yield { type: "token", content: token };
      }
      yield { type: "done", suggestions: [] };
      return;
    }
  }

  if (!conversationId) {
    const conv = await createConversation(supabase, {
      product,
      userId: input.userId ?? null,
      schoolId: copilotCtx?.schoolId ?? null,
      anonymousSessionId: input.anonymousSessionId ?? null,
      title: trimmed.slice(0, 80),
    });
    if (!conv) {
      yield { type: "error", error: "Could not start conversation." };
      return;
    }
    conversationId = conv.id;
    yield { type: "conversation", conversationId };
  }

  const userMsg = await insertMessage(supabase, {
    conversationId,
    role: "user",
    content: trimmed,
  });
  if (!userMsg) {
    yield { type: "error", error: "Could not save your message." };
    return;
  }

  const history = await loadConversationMessages(supabase, conversationId);
  const historyForTools = history
    .filter((m) => m.id !== userMsg.id)
    .map((m) => ({ role: m.role, content: m.content }));

  let toolSummary: string | null = null;
  let copilotMeta: CopilotMessageMeta | undefined;
  let toolResult = null;

  if (product === "copilot" && copilotCtx) {
    toolResult = await executeCopilotTools(
      supabase,
      copilotCtx,
      trimmed,
      historyForTools
    );

    if (toolResult && toolResult.tool !== "none") {
      if (toolResult.denied) {
        toolSummary = toolResult.summary;
        copilotMeta = {
          schoolName: copilotCtx.schoolName ?? undefined,
          responseType: "summary",
          confidence: "high",
          blocks: [],
          actions: [],
        };
      } else {
        const priorContext = buildPriorContext(historyForTools);
        const filters = parseConversationFilters(trimmed, priorContext);
        const built = buildCopilotResponse(
          toolResult,
          copilotCtx,
          trimmed,
          filters
        );
        toolSummary = built.content;
        copilotMeta = built.meta;
      }
    }
  }

  const systemPrompt =
    product === "copilot" && copilotCtx
      ? buildCopilotSystemPrompt(copilotCtx)
      : buildPublicSystemPrompt();

  const knowledgeHistory = history
    .filter((m) => m.id !== userMsg.id)
    .map((m) => ({
      role: m.role,
      content: m.content,
      metadata: (m.metadata ?? null) as {
        knowledgeEntryId?: string | null;
        sessionContext?: ReturnType<typeof sessionContextFromEntry> | null;
      } | null,
    }));

  const knowledgeResult =
    product === "public"
      ? await resolvePublicKnowledgeQuery(supabase, {
          query: trimmed,
          history: knowledgeHistory,
        })
      : null;

  const knowledgeMatch = knowledgeResult?.match ?? null;
  const clarification = knowledgeResult?.clarification ?? null;

  let fallbackText: string;
  if (product === "copilot" && copilotCtx) {
    if (toolSummary) {
      fallbackText = toolSummary;
    } else {
      const fb = buildCopilotFallback(trimmed, copilotCtx);
      fallbackText = fb.content;
      copilotMeta = fb.meta;
    }
  } else if (knowledgeMatch) {
    fallbackText = formatKnowledgeAnswer(knowledgeMatch.entry);
  } else if (clarification) {
    fallbackText = formatClarificationResponse(clarification);
  } else {
    fallbackText = fallbackPublicAnswer(trimmed);
  }

  let assistantContent = "";
  let answerSource: "knowledge" | "clarification" | "llm" | "fallback" =
    knowledgeMatch
      ? "knowledge"
      : clarification
        ? "clarification"
        : "fallback";

  try {
    if (
      shouldUseLiveModel() &&
      !knowledgeMatch &&
      !clarification &&
      !toolSummary &&
      product !== "copilot"
    ) {
      const chatMessages = buildChatMessages(
        systemPrompt,
        history.filter((m) => m.id !== userMsg.id),
        trimmed,
        undefined
      );

      for await (const token of streamOpenAIChat(chatMessages)) {
        assistantContent += token;
        yield { type: "token", content: token };
      }

      if (assistantContent.trim()) {
        answerSource = "llm";
      } else {
        for await (const token of streamFallbackText(fallbackText)) {
          assistantContent += token;
          yield { type: "token", content: token };
        }
      }
    } else {
      for await (const token of streamFallbackText(fallbackText)) {
        assistantContent += token;
        yield { type: "token", content: token };
      }
    }
  } catch (err) {
    console.error("[ai] stream error:", err);
    assistantContent = fallbackText;
    for await (const token of streamFallbackText(fallbackText)) {
      yield { type: "token", content: token };
    }
  }

  if (product === "public" && knowledgeResult) {
    const learningStatus: LearningAnswerStatus =
      answerSource === "knowledge"
        ? "answered"
        : answerSource === "clarification"
          ? "clarified"
          : answerSource === "llm"
            ? "llm"
            : knowledgeResult.type === "no_match"
              ? "unanswered"
              : "fallback";

    void captureLearningEvent(
      supabase,
      buildLearningCaptureFromResult(trimmed, {
        matchedEntryId: knowledgeMatch?.entry.id ?? null,
        matchedIntentKey:
          knowledgeMatch?.matchedIntentKey ??
          knowledgeResult.matchedIntentKey ??
          null,
        finalScore:
          knowledgeMatch?.finalScore ??
          knowledgeMatch?.score ??
          knowledgeResult.candidates[0]?.score ??
          null,
        answerStatus: learningStatus,
        candidates: knowledgeResult.candidates,
        reasonSignals: knowledgeResult.reasonSignals.map((s) => s.detail),
      })
    );

    if (knowledgeMatch) {
      await recordKnowledgeUsage(
        supabase,
        knowledgeMatch.entry.id,
        trimmed,
        knowledgeMatch.finalScore ?? knowledgeMatch.score
      );
    } else if (answerSource === "fallback" || learningStatus === "unanswered") {
      await logUnansweredQuestion(
        supabase,
        trimmed,
        "public_ai",
        buildMatchDebugPayload(trimmed, knowledgeResult)
      );
    }
  }

  if (product === "copilot" && copilotCtx && !toolResult) {
    void persistCopilotUnanswered(
      trimmed,
      copilotCtx.schoolId,
      copilotCtx.role
    );
    void createDraftKnowledgeFromRegistry(supabase, trimmed, input.userId);
  }

  const suggestions: AISuggestion[] =
    product === "copilot"
      ? copilotMeta?.actions ?? []
      : copilotMeta?.actions?.length
        ? copilotMeta.actions
        : suggestionsAfterResponse(trimmed, assistantContent, product);

  const sessionContext = knowledgeMatch
    ? sessionContextFromEntry(knowledgeMatch.entry)
    : null;

  const assistantMsg = await insertMessage(supabase, {
    conversationId,
    role: "assistant",
    content: assistantContent,
    metadata: {
      toolUsed: toolResult ? true : false,
      knowledgeEntryId: knowledgeMatch?.entry.id ?? null,
      sessionContext,
      matchedIntentKey:
        knowledgeMatch?.matchedIntentKey ??
        knowledgeResult?.matchedIntentKey ??
        null,
      answerSource,
    },
  });

  if (copilotMeta) {
    yield { type: "copilot_meta", copilotMeta };
  }

  yield {
    type: "done",
    conversationId,
    messageId: assistantMsg?.id,
    suggestions,
    copilotMeta,
  };
}

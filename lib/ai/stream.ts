import { AI_CONFIG } from "@/lib/ai/config";
import { isPublicPaidLlmEnabled } from "@/lib/ai-training/retrieval-config";
import type { AIMessage } from "@/lib/ai/types";

export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function* streamOpenAIChat(
  messages: OpenAIChatMessage[]
): AsyncGenerator<string> {
  const apiKey = AI_CONFIG.openaiApiKey;
  if (!apiKey) return;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages,
      stream: true,
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
    }),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    throw new Error(errText || `OpenAI error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = json.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }
}

export async function* streamFallbackText(text: string): AsyncGenerator<string> {
  const words = text.split(/(\s+)/);
  for (const chunk of words) {
    if (!chunk) continue;
    yield chunk;
    await new Promise((r) => setTimeout(r, 12));
  }
}

export function buildChatMessages(
  systemPrompt: string,
  history: AIMessage[],
  userMessage: string,
  toolContext?: string
): OpenAIChatMessage[] {
  const msgs: OpenAIChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (toolContext) {
    msgs.push({
      role: "system",
      content: `Live school data for this response:\n${toolContext}`,
    });
  }

  const recent = history.slice(-AI_CONFIG.maxContextMessages);
  for (const m of recent) {
    if (m.role === "user" || m.role === "assistant") {
      msgs.push({ role: m.role, content: m.content });
    }
  }

  msgs.push({ role: "user", content: userMessage });
  return msgs;
}

export function isAIConfigured(): boolean {
  return Boolean(AI_CONFIG.openaiApiKey.trim());
}

/** Public AI paid LLM — disabled by default. */
export function shouldUseLiveModel(): boolean {
  return isAIConfigured() && isPublicPaidLlmEnabled();
}

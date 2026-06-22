"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AIMessage,
  AIProduct,
  AISuggestion,
  AIStreamStatus,
  ChatStreamEvent,
} from "@/lib/ai/types";

function createId(): string {
  return crypto.randomUUID();
}

export interface UseAIChatOptions {
  product: AIProduct;
  conversationId?: string | null;
  initialMessages?: AIMessage[];
}

export function useAIChat({
  product,
  conversationId: initialConversationId = null,
  initialMessages = [],
}: UseAIChatOptions) {
  const [messages, setMessages] = useState<AIMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );
  const [status, setStatus] = useState<AIStreamStatus>("idle");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    streamingIdRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (text: string, options?: { regenerate?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || status === "thinking" || status === "streaming") return;

      setError(null);
      setSuggestions([]);
      setStatus("thinking");

      const userMessage: AIMessage = {
        id: createId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      if (!options?.regenerate) {
        setMessages((prev) => [...prev, userMessage]);
      }

      const assistantId = createId();
      streamingIdRef.current = assistantId;

      const assistantPlaceholder: AIMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => {
        if (options?.regenerate) {
          const withoutLastAssistant = [...prev];
          const lastIdx = withoutLastAssistant.findLastIndex(
            (m) => m.role === "assistant"
          );
          if (lastIdx >= 0) withoutLastAssistant.splice(lastIdx, 1);
          return [...withoutLastAssistant, assistantPlaceholder];
        }
        return [...prev, assistantPlaceholder];
      });

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product,
            message: trimmed,
            conversationId,
            regenerate: options?.regenerate ?? false,
          }),
          signal: abortRef.current.signal,
          credentials: "same-origin",
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errBody.error ?? "Could not reach Adakaro AI.");
        }

        if (!res.body) throw new Error("No response stream.");

        setStatus("streaming");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;

            let event: ChatStreamEvent;
            try {
              event = JSON.parse(json) as ChatStreamEvent;
            } catch {
              continue;
            }

            if (event.type === "conversation" && event.conversationId) {
              setConversationId(event.conversationId);
            }

            if (event.type === "token" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              );
            }

            if (event.type === "copilot_meta" && event.copilotMeta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        metadata: {
                          ...m.metadata,
                          copilotMeta: event.copilotMeta,
                        },
                      }
                    : m
                )
              );
            }

            if (event.type === "done") {
              if (event.suggestions) setSuggestions(event.suggestions);
              if (event.conversationId) setConversationId(event.conversationId);
              if (event.copilotMeta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          metadata: {
                            ...m.metadata,
                            copilotMeta: event.copilotMeta,
                          },
                        }
                      : m
                  )
                );
              }
            }

            if (event.type === "error") {
              throw new Error(event.error ?? "Stream error.");
            }
          }
        }

        setStatus("idle");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(msg);
        setStatus("error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content
              ? {
                  ...m,
                  content:
                    "I'm sorry — I couldn't complete that response. Please try again.",
                }
              : m
          )
        );
      } finally {
        streamingIdRef.current = null;
        abortRef.current = null;
      }
    },
    [conversationId, product, status]
  );

  const regenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) void sendMessage(lastUser.content, { regenerate: true });
  }, [messages, sendMessage]);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setConversationId(null);
    setSuggestions([]);
    setError(null);
    setStatus("idle");
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    messages,
    conversationId,
    status,
    suggestions,
    error,
    isThinking: status === "thinking",
    isStreaming: status === "streaming",
    isBusy: status === "thinking" || status === "streaming",
    sendMessage,
    regenerate,
    reset,
    stop,
    setSuggestions,
  };
}

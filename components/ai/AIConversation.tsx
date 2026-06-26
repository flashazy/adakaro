"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AIMessage } from "@/lib/ai/types";
import { AIMessage as AIMessageBubble } from "./AIMessage";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { AIWelcomeScreen } from "./AIWelcomeScreen";
import { PublicAIWelcomeScreen } from "./public-ai-welcome-screen";
import { CopilotWelcomeScreen } from "./copilot-welcome-screen";
import { AISuggestions } from "./AISuggestions";
import type { AISuggestion } from "@/lib/ai/types";

export function AIConversation({
  messages,
  welcomeTitle,
  welcomeSubtitle,
  welcomeSuggestions,
  welcomeVariant = "default",
  followUpSuggestions,
  isThinking,
  isStreaming,
  streamingMessageId,
  onSelectSuggestion,
  onRegenerate,
  isBusy,
  className,
  isCopilot = false,
}: {
  messages: AIMessage[];
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeSuggestions: AISuggestion[];
  welcomeVariant?: "default" | "public" | "copilot";
  followUpSuggestions: AISuggestion[];
  isThinking: boolean;
  isStreaming: boolean;
  streamingMessageId?: string | null;
  onSelectSuggestion: (prompt: string) => void;
  onRegenerate?: () => void;
  isBusy: boolean;
  className?: string;
  isCopilot?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasConversationStarted = messages.length > 0 || isThinking;
  const isPublic = welcomeVariant === "public" && !isCopilot;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking, followUpSuggestions, isStreaming]);

  const showWelcome = !hasConversationStarted;

  return (
    <div
      ref={containerRef}
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
        {showWelcome ? (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            {isCopilot ? (
              <CopilotWelcomeScreen />
            ) : welcomeVariant === "public" ? (
              <PublicAIWelcomeScreen
                suggestions={welcomeSuggestions}
                onSelectSuggestion={onSelectSuggestion}
                disabled={isBusy}
              />
            ) : (
              <AIWelcomeScreen
                title={welcomeTitle}
                subtitle={welcomeSubtitle}
                suggestions={welcomeSuggestions}
                onSelectSuggestion={onSelectSuggestion}
                disabled={isBusy}
                variant={welcomeVariant}
              />
            )}
          </div>
        ) : (
          <div className="py-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-250">
            {messages.map((msg) => {
              if (isThinking && msg.role === "assistant" && !msg.content) {
                return null;
              }
              const meta = msg.metadata?.copilotMeta as
                | { actions?: unknown[] }
                | undefined;
              const hasCopilotActions =
                isCopilot && (meta?.actions?.length ?? 0) > 0;
              return (
                <AIMessageBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming && msg.id === streamingMessageId}
                  onRegenerate={
                    msg.role === "assistant" && !isBusy
                      ? onRegenerate
                      : undefined
                  }
                  onActionSelect={
                    hasCopilotActions ? onSelectSuggestion : undefined
                  }
                  hideActionChips={isCopilot && !hasCopilotActions}
                  variant={isPublic ? "public" : "default"}
                />
              );
            })}
            {isThinking ? (
              <AIThinkingIndicator showAvatar showIdentity={isPublic} />
            ) : null}
          </div>
        )}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>

      {followUpSuggestions.length > 0 && !showWelcome ? (
        <AISuggestions
          suggestions={followUpSuggestions}
          onSelect={onSelectSuggestion}
          disabled={isBusy}
          variant="premium"
          className="shrink-0 border-t border-slate-100 px-3 py-2.5 dark:border-zinc-800"
        />
      ) : null}
    </div>
  );
}

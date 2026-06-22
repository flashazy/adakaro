"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AIMessage } from "@/lib/ai/types";
import { AIMessage as AIMessageBubble } from "./AIMessage";
import { AIThinkingIndicator } from "./AIThinkingIndicator";
import { AIWelcomeScreen } from "./AIWelcomeScreen";
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
  onFillPrompt,
  showCopilotOnboarding = true,
  copilotSnapshot = null,
  onActionSelect,
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
  onFillPrompt?: (prompt: string) => void;
  showCopilotOnboarding?: boolean;
  copilotSnapshot?: import("@/lib/ai/copilot/types").CopilotSnapshot | null;
  onActionSelect?: (prompt: string) => void;
  isCopilot?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking, followUpSuggestions]);

  const showWelcome = messages.length === 0 && !isThinking;

  return (
    <div
      ref={containerRef}
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {showWelcome ? (
          welcomeVariant === "copilot" && onFillPrompt ? (
            <CopilotWelcomeScreen
              suggestions={welcomeSuggestions}
              onFillPrompt={onFillPrompt}
              onSendPrompt={onSelectSuggestion}
              snapshot={copilotSnapshot}
              disabled={isBusy}
              showOnboarding={showCopilotOnboarding}
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
          )
        ) : (
          <div className="py-2">
            {messages.map((msg) => (
              <AIMessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && msg.id === streamingMessageId}
                onRegenerate={
                  msg.role === "assistant" && !isBusy ? onRegenerate : undefined
                }
                onActionSelect={
                  isCopilot && msg.role === "assistant" ? onActionSelect : undefined
                }
              />
            ))}
            {isThinking ? (
              <div className="px-4 py-2">
                <AIThinkingIndicator />
              </div>
            ) : null}
          </div>
        )}
        <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
      </div>

      {followUpSuggestions.length > 0 && !showWelcome && !isCopilot ? (
        <AISuggestions
          suggestions={followUpSuggestions}
          onSelect={onSelectSuggestion}
          disabled={isBusy}
          className="border-t border-slate-100 pt-3 dark:border-zinc-800"
        />
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Bot, Check, Copy, RefreshCw, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIMessage } from "@/lib/ai/types";
import type { CopilotMessageMeta } from "@/lib/ai/copilot/types";
import { AIMessageContent } from "./ai-message-content";
import {
  CopilotActionChips,
  CopilotRichBlocks,
} from "./copilot-rich-message";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getCopilotMeta(message: AIMessage): CopilotMessageMeta | null {
  const meta = message.metadata?.copilotMeta;
  if (!meta || typeof meta !== "object") return null;
  return meta as CopilotMessageMeta;
}

export function AIMessage({
  message,
  isStreaming = false,
  onRegenerate,
  onActionSelect,
  showActions = true,
  hideActionChips = false,
  variant = "default",
}: {
  message: AIMessage;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onActionSelect?: (prompt: string) => void;
  showActions?: boolean;
  hideActionChips?: boolean;
  variant?: "default" | "public";
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const copilotMeta = !isUser ? getCopilotMeta(message) : null;
  const isPublic = variant === "public";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "group flex gap-3 px-3 py-2.5 sm:px-4 sm:py-3",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl",
          isUser
            ? "h-8 w-8 bg-indigo-600 text-white"
            : "h-9 w-9 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"
        )}
        aria-hidden
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div
        className={cn(
          "min-w-0",
          isUser ? "max-w-[88%] sm:max-w-[82%]" : "max-w-[92%] sm:max-w-[88%]",
          isUser ? "items-end text-right" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl shadow-sm",
            isUser
              ? cn(
                  "bg-indigo-600 px-4 py-3 text-[15px] leading-relaxed text-white",
                  isPublic && "rounded-br-md"
                )
              : cn(
                  "border border-slate-200/80 bg-white px-4 py-3 text-[15px] leading-[1.65] text-slate-800 dark:border-zinc-700/80 dark:bg-zinc-900 dark:text-zinc-100",
                  isPublic && "rounded-bl-md"
                )
          )}
        >
          {message.content ? (
            <AIMessageContent content={message.content} isUser={isUser} />
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-1" aria-hidden>
              <span className="inline-block h-4 w-0.5 animate-pulse rounded-full bg-indigo-400" />
            </span>
          ) : null}

          {copilotMeta && !isStreaming ? (
            <CopilotRichBlocks meta={copilotMeta} />
          ) : null}

          {copilotMeta?.actions && onActionSelect && !isStreaming && !hideActionChips ? (
            <CopilotActionChips
              actions={copilotMeta.actions}
              onSelect={onActionSelect}
            />
          ) : null}
        </div>

        <div
          className={cn(
            "mt-1.5 flex items-center gap-2 text-[10px] text-slate-400/90 dark:text-zinc-500",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {!isUser && showActions && message.content && !isStreaming ? (
            <>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 opacity-0 transition-opacity duration-150 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-zinc-800"
                aria-label="Copy response"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
              {onRegenerate ? (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 opacity-0 transition-opacity duration-150 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-zinc-800"
                  aria-label="Regenerate response"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

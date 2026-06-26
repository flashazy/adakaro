"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIProduct, AIStreamStatus } from "@/lib/ai/types";
import {
  COPILOT_WELCOME_SUGGESTIONS,
  PUBLIC_WELCOME_SUGGESTIONS,
} from "@/lib/ai/suggestions";
import { AIConversation } from "./AIConversation";
import { CopilotStatusBadge, type CopilotAIStatus } from "./copilot-dock";
import { useAIChat } from "./use-ai-chat";

export type AIChatWidgetMode = "widget" | "page";

export interface AIChatWidgetProps {
  product: AIProduct;
  mode?: AIChatWidgetMode;
  open?: boolean;
  onClose?: () => void;
  className?: string;
  onChatStatusChange?: (
    status: AIStreamStatus,
    meta?: { trainingRequired?: boolean }
  ) => void;
}

function productMeta(product: AIProduct) {
  if (product === "copilot") {
    return {
      name: "Adakaro Copilot",
      shortName: "Copilot",
      welcomeTitle: "Adakaro Copilot",
      welcomeSubtitle: "Ask anything about your school",
      welcomeSuggestions: COPILOT_WELCOME_SUGGESTIONS,
      welcomeVariant: "copilot" as const,
    };
  }
  return {
    name: "Adakaro AI",
    shortName: "Adakaro AI",
    welcomeTitle: "Ask Adakaro AI",
    welcomeSubtitle:
      "Get instant answers about Adakaro, school management, pricing, and platform features.",
    welcomeSuggestions: PUBLIC_WELCOME_SUGGESTIONS,
    welcomeVariant: "public" as const,
  };
}

export function AIChatWidget({
  product,
  mode = "widget",
  open = true,
  onClose,
  className,
  onChatStatusChange,
}: AIChatWidgetProps) {
  const meta = productMeta(product);
  const isCopilot = product === "copilot";
  const {
    messages,
    status,
    suggestions,
    error,
    isThinking,
    isStreaming,
    isBusy,
    sendMessage,
    regenerate,
    reset,
  } = useAIChat({ product });

  const copilotStatus: CopilotAIStatus =
    status === "thinking" || status === "streaming" ? "analyzing" : "ready";

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingId =
    isStreaming && messages.length > 0
      ? messages[messages.length - 1]?.id
      : null;

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 160;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight, open]);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || isBusy) return;
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      void sendMessage(text);
    },
    [input, isBusy, sendMessage]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (open && mode === "widget") {
      textareaRef.current?.focus();
    }
  }, [open, mode]);

  useEffect(() => {
    onChatStatusChange?.(status, {});
  }, [status, onChatStatusChange]);

  const inner = (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-zinc-950",
        className
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {meta.name}
            </p>
            {isCopilot ? (
              <div className="mt-0.5">
                <CopilotStatusBadge status={copilotStatus} compact />
              </div>
            ) : (
              <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
                AI Assistant
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              disabled={isBusy}
              className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-zinc-800"
              aria-label="New conversation"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
          {mode === "widget" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Conversation */}
      <AIConversation
        messages={messages}
        welcomeTitle={meta.welcomeTitle}
        welcomeSubtitle={meta.welcomeSubtitle}
        welcomeSuggestions={meta.welcomeSuggestions}
        welcomeVariant={meta.welcomeVariant}
        isCopilot={isCopilot}
        followUpSuggestions={isCopilot ? [] : suggestions}
        isThinking={isThinking}
        isStreaming={isStreaming}
        streamingMessageId={streamingId}
        onSelectSuggestion={(prompt) => void sendMessage(prompt)}
        onRegenerate={regenerate}
        isBusy={isBusy}
      />

      {error ? (
        <p className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "shrink-0 border-t border-slate-200/80 dark:border-zinc-800",
          "bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:bg-zinc-950 sm:px-4 sm:pb-4 sm:pt-4"
        )}
      >
        <div
          className={cn(
            "flex items-end gap-3 rounded-[1.25rem] border border-slate-200/90 bg-white p-2 pl-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
            "transition-all duration-200 ease-out",
            "focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12),0_2px_8px_rgba(99,102,241,0.08)]",
            "dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-indigo-500 dark:focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isBusy}
            placeholder={
              isCopilot ? "Ask anything…" : "Ask Adakaro AI anything..."
            }
            className={cn(
              "flex-1 resize-none bg-transparent py-3 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60 dark:text-white dark:placeholder:text-zinc-500",
              "min-h-[48px] max-h-40"
            )}
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            className="mb-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all duration-150 ease-out hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            aria-label={isBusy ? "Sending…" : "Send message"}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        {!isCopilot ? (
          <p className="mt-2 px-1 text-center text-[9px] leading-snug text-slate-400/80 dark:text-zinc-600">
            Adakaro AI answers platform questions. It cannot access school data.
          </p>
        ) : null}
      </form>
    </div>
  );

  if (mode === "page") {
    return (
      <div className="mx-auto flex h-[min(720px,calc(100dvh-12rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 shadow-xl dark:border-zinc-800">
        {inner}
      </div>
    );
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-250 sm:bg-transparent sm:backdrop-blur-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        aria-label="Close assistant"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed z-[120] flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-zinc-950",
          "inset-x-0 bottom-0 top-auto max-h-[min(92dvh,720px)] rounded-t-2xl border border-slate-200 dark:border-zinc-800",
          "pb-[env(safe-area-inset-bottom,0px)]",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[min(100%,420px)] sm:rounded-none sm:border-l sm:border-t-0 sm:pb-0",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-250",
          "motion-safe:slide-in-from-bottom-4 sm:motion-safe:slide-in-from-right-4"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={meta.name}
      >
        {inner}
      </div>
    </>
  );
}

export function AIChatFloatButton({
  onClick,
  label = "Ask AI",
  className,
  subtle = false,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed z-40 inline-flex items-center justify-center gap-2 rounded-full text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        subtle
          ? "bg-gradient-to-r from-indigo-500/90 to-violet-500/90 px-3.5 py-2.5 text-xs font-medium shadow-md shadow-indigo-500/15 hover:from-indigo-500 hover:to-violet-500"
          : "bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500",
        "bottom-4 left-4 sm:bottom-8 sm:left-8",
        className
      )}
      aria-label={label}
    >
      <MessageSquare
        className={cn("shrink-0", subtle ? "h-4 w-4" : "h-5 w-5")}
        aria-hidden
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

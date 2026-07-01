"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { saInput } from "@/components/super-admin/super-admin-dashboard-ui";

export interface TextHighlight {
  start: number;
  end: number;
  issueId: string;
  ruleLabel: string;
  reason: string;
  suggestion: string;
  tone?: "amber" | "rose" | "violet" | "sky";
}

export interface HighlightedTextareaHandle {
  focusAt: (start: number, end?: number) => void;
  scrollToRange: (start: number, end: number) => void;
  getTextarea: () => HTMLTextAreaElement | null;
}

interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  highlights?: TextHighlight[];
  activeRange?: { start: number; end: number } | null;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  rows?: number;
  className?: string;
  onHighlightAction?: (issueId: string, action: "accept" | "ignore") => void;
}

const TONE_CLASS: Record<NonNullable<TextHighlight["tone"]>, string> = {
  amber: "decoration-amber-500/80 bg-amber-100/60",
  rose: "decoration-rose-500/80 bg-rose-100/60",
  violet: "decoration-violet-500/80 bg-violet-100/60",
  sky: "decoration-sky-500/80 bg-sky-100/60",
};

function buildHighlightedMarkup(
  text: string,
  highlights: TextHighlight[],
  activeRange: { start: number; end: number } | null | undefined
): React.ReactNode[] {
  if (!text) return [""];

  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const highlight of sorted) {
    if (highlight.start > cursor) {
      nodes.push(text.slice(cursor, highlight.start));
    }

    const tone = highlight.tone ?? "amber";
    const isActive =
      activeRange &&
      highlight.start >= activeRange.start &&
      highlight.end <= activeRange.end;

    nodes.push(
      <mark
        key={`${highlight.issueId}-${highlight.start}`}
        data-issue-id={highlight.issueId}
        className={cn(
          "rounded-sm underline decoration-2 underline-offset-[3px]",
          TONE_CLASS[tone],
          isActive && "ring-2 ring-yellow-300/90 animate-pulse"
        )}
      >
        {text.slice(highlight.start, highlight.end)}
      </mark>
    );
    cursor = Math.max(cursor, highlight.end);
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export const HighlightedTextarea = forwardRef<HighlightedTextareaHandle, HighlightedTextareaProps>(
  function HighlightedTextarea(
    {
      value,
      onChange,
      highlights = [],
      activeRange,
      placeholder,
      required,
      disabled,
      id,
      rows = 16,
      className,
      onHighlightAction,
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const [hoveredIssue, setHoveredIssue] = useState<TextHighlight | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

    const syncScroll = useCallback(() => {
      const textarea = textareaRef.current;
      const backdrop = backdropRef.current;
      if (!textarea || !backdrop) return;
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    }, []);

    useImperativeHandle(ref, () => ({
      focusAt(start: number, end?: number) {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        const endPos = end ?? start;
        textarea.setSelectionRange(start, endPos);
        syncScroll();
      },
      scrollToRange(start: number, end: number) {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const midpoint = (start + end) / 2;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 20;
        const textBefore = value.slice(0, midpoint);
        const lineNumber = textBefore.split("\n").length;
        textarea.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
        syncScroll();
      },
      getTextarea() {
        return textareaRef.current;
      },
    }));

    useEffect(() => {
      if (!activeRange) return;
      const timer = window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 120);
      return () => window.clearTimeout(timer);
    }, [activeRange?.start, activeRange?.end]);

    const handleMouseMove = (event: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!onHighlightAction || highlights.length === 0) return;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const style = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(style.lineHeight) || 20;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const rect = textarea.getBoundingClientRect();
      const row = Math.floor(
        (event.clientY - rect.top - paddingTop + textarea.scrollTop) / lineHeight
      );
      const lines = value.split("\n");
      let index = 0;
      for (let i = 0; i < Math.min(Math.max(row, 0), lines.length); i++) {
        index += lines[i]!.length + 1;
      }
      const col = Math.max(
        0,
        Math.floor((event.clientX - rect.left - paddingLeft + textarea.scrollLeft) / 7.8)
      );
      index = Math.min(value.length, index + col);

      const issue =
        highlights.find((h) => index >= h.start && index <= h.end) ?? null;
      setHoveredIssue(issue);
      if (issue) {
        setTooltipPos({
          top: event.clientY - rect.top + 18,
          left: Math.min(event.clientX - rect.left, rect.width - 260),
        });
      } else {
        setTooltipPos(null);
      }
    };

    const sharedTypography = cn(
      "font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words",
      "px-3 py-2"
    );

    const useHighlightOverlay = highlights.length > 0;

    useEffect(() => {
      syncScroll();
    }, [value, highlights, syncScroll]);

    return (
      <div className="relative mt-1">
        {useHighlightOverlay ? (
          <div
            ref={backdropRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-xl border border-transparent",
              sharedTypography,
              "text-slate-900"
            )}
          >
            {buildHighlightedMarkup(value, highlights, activeRange)}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          required={required}
          disabled={disabled}
          rows={rows}
          spellCheck
          wrap="soft"
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onMouseMove={useHighlightOverlay ? handleMouseMove : undefined}
          onMouseLeave={
            useHighlightOverlay
              ? () => {
                  setHoveredIssue(null);
                  setTooltipPos(null);
                }
              : undefined
          }
          className={cn(
            saInput,
            "relative z-[1] w-full resize-y",
            sharedTypography,
            "min-h-[18rem] max-h-[36rem] overflow-y-auto scroll-smooth",
            useHighlightOverlay
              ? "!bg-transparent text-transparent caret-slate-900 selection:bg-indigo-200/70 selection:text-slate-900"
              : "text-slate-800",
            className
          )}
        />

        {hoveredIssue && tooltipPos && onHighlightAction ? (
          <div
            className="pointer-events-auto absolute z-[3] w-64 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] shadow-lg"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
            onMouseLeave={() => {
              setHoveredIssue(null);
              setTooltipPos(null);
            }}
          >
            <p className="font-semibold text-slate-900">{hoveredIssue.ruleLabel}</p>
            <p className="mt-1 text-slate-600">{hoveredIssue.reason}</p>
            {hoveredIssue.suggestion ? (
              <p className="mt-1 text-emerald-700">
                <span className="font-medium">Suggested: </span>
                {hoveredIssue.suggestion}
              </p>
            ) : null}
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
                onClick={() => onHighlightAction(hoveredIssue.issueId, "accept")}
              >
                Accept
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => onHighlightAction(hoveredIssue.issueId, "ignore")}
              >
                Ignore
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);

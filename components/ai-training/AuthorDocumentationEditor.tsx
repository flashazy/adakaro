"use client";

import { forwardRef } from "react";
import {
  HighlightedTextarea,
  type HighlightedTextareaHandle,
  type TextHighlight,
} from "@/components/super-admin/ai-training/highlighted-textarea";
import { cn } from "@/lib/utils";

export type { HighlightedTextareaHandle, TextHighlight };

interface AuthorDocumentationEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  highlights?: TextHighlight[];
  activeRange?: { start: number; end: number } | null;
  onHighlightAction?: (issueId: string, action: "accept" | "ignore") => void;
}

export const AuthorDocumentationEditor = forwardRef<
  HighlightedTextareaHandle,
  AuthorDocumentationEditorProps
>(function AuthorDocumentationEditor(
  {
    value,
    onChange,
    placeholder,
    required,
    disabled,
    id,
    className,
    highlights,
    activeRange,
    onHighlightAction,
  },
  ref
) {
  return (
    <HighlightedTextarea
      ref={ref}
      id={id ?? "author-answer-editor"}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      highlights={highlights}
      activeRange={activeRange}
      onHighlightAction={onHighlightAction}
      className={cn(className)}
    />
  );
});

"use client";

import { cn } from "@/lib/utils";
import { saInput } from "@/components/super-admin/super-admin-dashboard-ui";

interface AuthorDocumentationEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function AuthorDocumentationEditor({
  value,
  onChange,
  placeholder,
  required,
  disabled,
  id,
  className,
}: AuthorDocumentationEditorProps) {
  return (
    <textarea
      id={id}
      value={value}
      required={required}
      disabled={disabled}
      rows={16}
      spellCheck
      wrap="soft"
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        saInput,
        "mt-1 w-full resize-y font-mono text-[13px] leading-relaxed",
        "whitespace-pre-wrap break-words",
        "min-h-[18rem] max-h-[36rem] overflow-y-auto scroll-smooth",
        className
      )}
    />
  );
}

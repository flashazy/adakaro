"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const inputClassName =
  "block w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";

type PasswordInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "className"
> & { className?: string };

/**
 * Password field with show/hide toggle — matches auth form input styling.
 */
export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative mt-1.5">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={[inputClassName, className].filter(Boolean).join(" ")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-2.5 text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0 dark:text-zinc-400 dark:hover:text-zinc-100"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        ) : (
          <Eye className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </div>
  );
}

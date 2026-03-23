import type { ReactNode } from "react";

interface QueryErrorBannerProps {
  title: string;
  message: string;
  children?: ReactNode;
  /** Extra Tailwind classes (e.g. spacing). */
  className?: string;
}

/** Inline alert for failed Supabase reads on dashboard management pages. */
export function QueryErrorBanner({
  title,
  message,
  children,
  className,
}: QueryErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200${className ? ` ${className}` : ""}`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-2 whitespace-pre-wrap break-words opacity-95">{message}</p>
      {children ? <div className="mt-3 text-xs opacity-90">{children}</div> : null}
    </div>
  );
}

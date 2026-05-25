import type { ReactNode } from "react";

/** Consistent section heading for the Finance hub page. */
export function FinanceHubSection({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ?? `finance-section-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-4 sm:mb-5">
        <h2
          id={headingId}
          className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

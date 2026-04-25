"use client";

import { useEffect, useMemo, useState } from "react";

export type LegalTocVariant = "privacy" | "terms";

type Item = { id: string; label: string };

export function LegalTocNav({
  items,
  variant,
}: {
  items: readonly Item[];
  variant: LegalTocVariant;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: "-12% 0px -52% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 1],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  const isTerms = variant === "terms";

  return (
    <nav
      className="sticky top-24"
      aria-label="On this page"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500">
        On this page
      </p>
      <ul className="mt-4 space-y-2 text-sm text-gray-500 dark:text-zinc-400">
        {items.map((item) => {
          const active = activeId === item.id;
          const base =
            "block border-l-2 py-0.5 pl-2 transition border-transparent";
          const inactiveHover = isTerms
            ? "hover:text-indigo-600 dark:hover:text-indigo-400"
            : "hover:text-gray-900 dark:hover:text-zinc-100";
          const activeClasses = isTerms
            ? "border-indigo-500 font-medium text-indigo-600 dark:text-indigo-400"
            : "border-gray-900 font-medium text-gray-900 dark:border-zinc-200 dark:text-white";

          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`${base} ${inactiveHover} ${
                  active ? activeClasses : ""
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

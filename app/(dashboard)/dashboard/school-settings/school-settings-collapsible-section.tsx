"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { ChevronRight } from "lucide-react";

const STORAGE_KEY = "adakaro-school-settings-expanded-v1";

function readExpandedMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (data == null || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }
    return data as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeExpandedMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export interface SchoolSettingsCollapsibleSectionProps {
  sectionId: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  /** When true, start expanded; localStorage can still open other sections. */
  defaultOpen?: boolean;
}

export function SchoolSettingsCollapsibleSection({
  sectionId,
  title,
  description,
  children,
  defaultOpen = false,
}: SchoolSettingsCollapsibleSectionProps) {
  const reactId = useId().replace(/:/g, "");
  const headingId = `${sectionId}-heading-${reactId}`;
  const panelId = `${sectionId}-panel-${reactId}`;
  const [open, setOpen] = useState(!!defaultOpen);

  useEffect(() => {
    if (defaultOpen) return;
    const map = readExpandedMap();
    if (map[sectionId]) setOpen(true);
  }, [sectionId, defaultOpen]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const map = readExpandedMap();
      if (next) map[sectionId] = true;
      else delete map[sectionId];
      writeExpandedMap(map);
      return next;
    });
  }, [sectionId]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 p-6 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40"
      >
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out dark:text-zinc-400 ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span
              id={headingId}
              className="text-sm font-semibold text-slate-900 dark:text-white"
            >
              {title}
            </span>
            <span className="shrink-0 text-xs text-slate-500 dark:text-zinc-500">
              {open ? "(click to collapse)" : "(click to expand)"}
            </span>
          </div>
        </div>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="border-t border-slate-100 px-6 pb-6 pt-4 dark:border-zinc-800">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {description}
            </p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

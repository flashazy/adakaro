"use client";

import {
  useState,
  useEffect,
  type ReactNode,
  Children,
  cloneElement,
  isValidElement,
} from "react";
import { cn } from "@/lib/utils";
import type { SubjectResultsUnreadState } from "@/lib/parent-subject-results-unread-types";
import { initialEmptySubjectResultsUnread } from "@/lib/parent-subject-results-unread-types";

const TAB_LABELS = [
  "Attendance",
  "Subject results",
  "Exam results",
  "Report cards",
  "Fees",
] as const;

const SUBJECT_TAB_INDEX = 1;

/**
 * Renders one of five RSC child segments (active tab). Child order must match:
 * Attendance, Subject results, Exam results, Report cards, Fees.
 */
export function ParentChildCardTabs({
  children,
  initialSubjectResultsUnread = initialEmptySubjectResultsUnread(),
}: {
  children: ReactNode;
  initialSubjectResultsUnread?: SubjectResultsUnreadState;
}) {
  const [active, setActive] = useState(0);
  const [subjectUnread, setSubjectUnread] = useState(initialSubjectResultsUnread);
  const items = Children.toArray(children);

  const initialUnreadSerialized = JSON.stringify(initialSubjectResultsUnread);
  useEffect(() => {
    setSubjectUnread(initialSubjectResultsUnread);
    // Sync when the server-provided unread snapshot changes (same content keeps one reference key).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally depend on serialized snapshot only
  }, [initialUnreadSerialized]);

  return (
    <div>
      <div
        className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-3 pt-2 dark:border-zinc-800 dark:bg-zinc-900/40"
        role="tablist"
        aria-label="Student sections"
      >
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={cn(
              "relative inline-flex items-center gap-1 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors",
              active === i
                ? "bg-slate-50 text-school-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-school-primary dark:bg-zinc-800/80 dark:text-school-primary"
                : "text-slate-500 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-200"
            )}
          >
            {i === SUBJECT_TAB_INDEX && subjectUnread.totalUnviewed > 0 && (
              <span
                className="shrink-0"
                title="New results"
                aria-hidden
              >
                🔴
              </span>
            )}
            <span>
              {label}
              {i === SUBJECT_TAB_INDEX && subjectUnread.totalUnviewed > 0
                ? ` (${subjectUnread.totalUnviewed})`
                : null}
            </span>
          </button>
        ))}
      </div>
      <div className="min-h-0" role="tabpanel">
        {(() => {
          const item = items[active];
          if (active === SUBJECT_TAB_INDEX && isValidElement(item)) {
            return cloneElement(item, {
              subjectResultsUnread: subjectUnread,
              onSubjectResultsUnreadChange: setSubjectUnread,
            } as never);
          }
          return item ?? null;
        })()}
      </div>
    </div>
  );
}

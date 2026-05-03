"use client";

import {
  useState,
  useEffect,
  useCallback,
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
  "Messages",
] as const;

const SUBJECT_TAB_INDEX = 1;
const MESSAGES_TAB_INDEX = 5;

/**
 * Renders one of six RSC child segments (active tab). Child order must match:
 * Attendance, Subject results, Exam results, Report cards, Fees, Messages.
 */
export function ParentChildCardTabs({
  children,
  initialSubjectResultsUnread = initialEmptySubjectResultsUnread(),
  initialMessagesUnread = 0,
}: {
  children: ReactNode;
  initialSubjectResultsUnread?: SubjectResultsUnreadState;
  initialMessagesUnread?: number;
}) {
  const [active, setActive] = useState(0);
  const [subjectUnread, setSubjectUnread] = useState(initialSubjectResultsUnread);
  const [messagesUnread, setMessagesUnread] = useState(initialMessagesUnread);
  const items = Children.toArray(children);

  const onMessagesUnreadChange = useCallback((n: number) => {
    setMessagesUnread(n);
  }, []);

  const initialUnreadSerialized = JSON.stringify(initialSubjectResultsUnread);
  useEffect(() => {
    setSubjectUnread(initialSubjectResultsUnread);
    // Sync when the server-provided unread snapshot changes (same content keeps one reference key).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally depend on serialized snapshot only
  }, [initialUnreadSerialized]);

  const initialMessagesUnreadSerialized = JSON.stringify(initialMessagesUnread);
  useEffect(() => {
    setMessagesUnread(initialMessagesUnread);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serialized server snapshot only
  }, [initialMessagesUnreadSerialized]);

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="relative px-3 pb-3 pt-3 sm:px-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-3 left-0 z-10 w-8 bg-gradient-to-r from-slate-50 to-transparent dark:from-zinc-950 md:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-3 right-0 z-10 w-8 bg-gradient-to-l from-slate-50 to-transparent dark:from-zinc-950 md:hidden"
        />
        <div
          className="flex min-w-0 touch-pan-x flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] md:flex-wrap md:gap-2 md:overflow-visible md:pb-0"
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
                "relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 sm:min-h-0 sm:py-2 sm:text-sm",
                active === i
                  ? "bg-gradient-to-r from-school-primary to-indigo-600 text-white shadow-md dark:to-indigo-500"
                  : "border border-slate-200/90 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
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
              {i === MESSAGES_TAB_INDEX && messagesUnread > 0 && (
                <span
                  className="shrink-0"
                  title="Unread messages"
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
                {i === MESSAGES_TAB_INDEX && messagesUnread > 0
                  ? ` (${messagesUnread})`
                  : null}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 bg-white dark:bg-zinc-900" role="tabpanel">
        {(() => {
          const item = items[active];
          if (active === SUBJECT_TAB_INDEX && isValidElement(item)) {
            return cloneElement(item, {
              subjectResultsUnread: subjectUnread,
              onSubjectResultsUnreadChange: setSubjectUnread,
            } as never);
          }
          if (active === MESSAGES_TAB_INDEX && isValidElement(item)) {
            return cloneElement(item, {
              onMessagesUnreadChange,
            } as never);
          }
          return item ?? null;
        })()}
      </div>
    </div>
  );
}

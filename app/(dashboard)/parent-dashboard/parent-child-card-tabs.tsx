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
      <div className="min-h-0" role="tabpanel">
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

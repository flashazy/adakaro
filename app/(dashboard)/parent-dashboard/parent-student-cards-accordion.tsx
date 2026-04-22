"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AccordionCtx = {
  expandedStudentId: string | null;
  toggle: (studentId: string) => void;
  isExpanded: (studentId: string) => boolean;
};

const Ctx = createContext<AccordionCtx | null>(null);

/**
 * At most one child card is expanded. Default: all collapsed.
 */
export function ParentStudentCardsGroup({ children }: { children: ReactNode }) {
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(
    null
  );

  const toggle = useCallback((studentId: string) => {
    setExpandedStudentId((cur) => (cur === studentId ? null : studentId));
  }, []);

  const value = useMemo<AccordionCtx>(
    () => ({
      expandedStudentId,
      toggle,
      isExpanded: (id) => expandedStudentId === id,
    }),
    [expandedStudentId, toggle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useAccordion() {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error(
      "ParentStudentCard must be used inside ParentStudentCardsGroup"
    );
  }
  return c;
}

type ParentStudentCardProps = {
  studentId: string;
  /** Shown when collapsed: name, class, admission (only). */
  summary: ReactNode;
  /** Shown in the card header when expanded (full header: school, due badge, etc.). */
  headerExpanded: ReactNode;
  /** Tabs and all panel content. */
  children: ReactNode;
};

/**
 * One student card: collapsed shows summary only; expanded shows full header + children.
 * Header is always the toggle (expand / collapse / switch).
 */
export function ParentStudentCard({
  studentId,
  summary,
  headerExpanded,
  children,
}: ParentStudentCardProps) {
  const { toggle, isExpanded } = useAccordion();
  const open = isExpanded(studentId);
  const panelId = `parent-student-card-panel-${studentId}`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-200/60 dark:border-zinc-700/90 dark:bg-zinc-900 dark:shadow-lg dark:ring-zinc-700/50">
      {open ? (
        <>
          <div className="border-b border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              id={`parent-student-card-trigger-${studentId}`}
              aria-expanded
              aria-controls={panelId}
              onClick={() => toggle(studentId)}
              className="w-full cursor-pointer text-left"
            >
              {headerExpanded}
            </button>
          </div>
          <div
            id={panelId}
            role="region"
            aria-labelledby={`parent-student-card-trigger-${studentId}`}
          >
            {children}
          </div>
        </>
      ) : (
        <button
          type="button"
          id={`parent-student-card-trigger-${studentId}`}
          aria-expanded={false}
          aria-controls={panelId}
          onClick={() => toggle(studentId)}
          className="w-full cursor-pointer text-left"
        >
          {summary}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import {
  academicBadgeReadyClass,
  academicBadgeReviewClass,
  academicCardBaseClass,
  academicCardInteractiveClass,
} from "@/components/academic/academic-ui-styles";
import type { ClassPromotionDisplayStats } from "@/lib/academic/academic-promotions-display.server";
import { cn } from "@/lib/utils";
import { PromotionModal } from "./promotion-modal";
import { ProgressionSetupPanel } from "./progression-setup-panel";
import type { PromotionClassRow } from "@/lib/promotions/types";

interface SetupClass {
  id: string;
  name: string;
  track_id: string | null;
  progression_order: number | null;
  parent_class_id: string | null;
}

interface PromotionsClientProps {
  academicYear: number;
  tracks: { id: string; track_name: string }[];
  classes: PromotionClassRow[];
  setupClasses: SetupClass[];
  /** Optional display-only readiness counts per class (Academic hub). */
  classDisplayStats?: Record<string, ClassPromotionDisplayStats>;
  /** Academic hub uses tighter spacing and shared card styling. */
  presentationVariant?: "default" | "academic";
}

export function PromotionsClient({
  academicYear,
  tracks,
  classes,
  setupClasses,
  classDisplayStats,
  presentationVariant = "default",
}: PromotionsClientProps) {
  const [activeClass, setActiveClass] = useState<PromotionClassRow | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isAcademic = presentationVariant === "academic";

  return (
    <div className={cn(isAcademic ? "space-y-4" : "space-y-6")}>
      {successMessage ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      <div
        className={cn(
          isAcademic &&
            "[&>section]:rounded-xl [&>section]:shadow-sm [&_button]:text-left"
        )}
      >
        <ProgressionSetupPanel tracks={tracks} classes={setupClasses} />
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Promote by class
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Only top-level classes are listed (streams are promoted with their
          class). Configure sequence above so &quot;Promote&quot; knows the next
          class.
        </p>

        {classes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No classes found.</p>
        ) : (
          <ul
            className={cn(
              "mt-3 grid gap-2.5 sm:grid-cols-2",
              isAcademic && "mt-3"
            )}
          >
            {classes.map((c) => {
              const stats = classDisplayStats?.[c.id];
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex flex-col justify-between p-4",
                    academicCardBaseClass,
                    isAcademic && academicCardInteractiveClass
                  )}
                >
                  <div className="space-y-3">
                    <div>
                      <p className="text-base font-semibold uppercase tracking-wide text-slate-900 dark:text-white">
                        {c.name}
                      </p>
                      {c.track_name ? (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                          {c.track_name}
                          {c.progression_order != null
                            ? ` · Step ${c.progression_order}`
                            : ""}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                          No track assigned
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-zinc-300">
                        <Users
                          className="h-4 w-4 shrink-0 opacity-70"
                          aria-hidden
                        />
                        {c.student_count} student
                        {c.student_count === 1 ? "" : "s"}
                      </span>
                      {stats ? (
                        <div
                          className={cn(
                            "flex flex-wrap gap-2",
                            isAcademic && "mt-0.5"
                          )}
                        >
                          <span
                            className={
                              isAcademic
                                ? academicBadgeReadyClass
                                : "font-medium text-emerald-700 dark:text-emerald-400"
                            }
                          >
                            {stats.readyCount} ready
                          </span>
                          <span
                            className={
                              isAcademic
                                ? academicBadgeReviewClass
                                : "font-medium text-amber-800 dark:text-amber-300"
                            }
                          >
                            {stats.reviewCount} require review
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {c.next_class_name ? (
                      <p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
                        <span className="font-medium text-slate-600 dark:text-zinc-300">
                          Next:
                        </span>
                        {c.next_class_name}
                        <ArrowRight
                          className="h-3 w-3 opacity-60"
                          aria-hidden
                        />
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700/90 dark:text-amber-300/90">
                        No next class in sequence
                      </p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={c.student_count === 0}
                      onClick={() => setActiveClass(c)}
                      className="w-full rounded-lg bg-school-primary px-3 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--school-primary-rgb)/0.45)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900"
                    >
                      Promote class
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeClass ? (
        <PromotionModal
          open
          classRow={activeClass}
          academicYear={academicYear}
          onClose={() => setActiveClass(null)}
          onSuccess={(msg) => setSuccessMessage(msg)}
        />
      ) : null}
    </div>
  );
}

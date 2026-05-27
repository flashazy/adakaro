"use client";

import { useState } from "react";
import { Users } from "lucide-react";
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
}

export function PromotionsClient({
  academicYear,
  tracks,
  classes,
  setupClasses,
}: PromotionsClientProps) {
  const [activeClass, setActiveClass] = useState<PromotionClassRow | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {successMessage ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      <ProgressionSetupPanel tracks={tracks} classes={setupClasses} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
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
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {classes.map((c) => (
              <li
                key={c.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
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
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-zinc-300">
                    <Users className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                    {c.student_count} active student
                    {c.student_count === 1 ? "" : "s"}
                  </p>
                  {c.next_class_name ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                      Next: {c.next_class_name}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-300/90">
                      No next class in sequence
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={c.student_count === 0}
                    onClick={() => setActiveClass(c)}
                    className="w-full rounded-lg bg-school-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Promote class
                  </button>
                </div>
              </li>
            ))}
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

import { BackButton } from "@/components/dashboard/back-button";
import { PromotionsClient } from "./promotions-client";
import type { PromotionsPageSetupClass } from "@/lib/promotions/load-promotions-page-data.server";
import type { PromotionClassRow } from "@/lib/promotions/types";

export interface PromotionsPageViewProps {
  academicYear: number;
  tracks: { id: string; track_name: string }[];
  classes: PromotionClassRow[];
  setupClasses: PromotionsPageSetupClass[];
}

/** School admin promotions page shell (`/dashboard/promotions`). */
export function PromotionsPageView({
  academicYear,
  tracks,
  classes,
  setupClasses,
}: PromotionsPageViewProps) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <BackButton
              href="/dashboard"
              className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              ← Back to dashboard
            </BackButton>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              Year-end promotions
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Move students to the next class, repeat, or graduate. History is
              kept for grades, attendance, and payments.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <PromotionsClient
          academicYear={academicYear}
          tracks={tracks}
          classes={classes}
          setupClasses={setupClasses}
        />
      </main>
    </>
  );
}

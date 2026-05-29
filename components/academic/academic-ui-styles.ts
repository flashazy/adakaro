/** Shared design tokens for the Academic Department workspace. */

export const academicRadiusClass = "rounded-xl";

export const academicCardBaseClass = `${academicRadiusClass} border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`;

/** Standard interactive hover (−2px, shadow, border). */
export const academicCardInteractiveClass =
  "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--school-primary-rgb)/0.35)] focus-visible:ring-offset-2 dark:hover:border-zinc-600 dark:focus-visible:ring-offset-zinc-950";

/** Hero quick-action cards — premium lift (−3px) and shadow. */
export const academicQuickActionHeroClass =
  "cursor-pointer transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-slate-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--school-primary-rgb)/0.4)] focus-visible:ring-offset-2 dark:hover:border-zinc-500 dark:focus-visible:ring-offset-zinc-950";

/** Enterprise status pills (promotions, readiness). */
export const academicBadgeReadyClass =
  "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/50";

export const academicBadgeReviewClass =
  "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-900/40";

export const academicSectionDividerClass =
  "border-t border-slate-200/80 dark:border-zinc-800/80";

/** Standard workspace section label (metrics, reports overview, etc.). */
export const academicSectionHeadingClass =
  "text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-zinc-300";

/** Primary action section label — quick actions hero. */
export const academicSectionHeadingHeroClass =
  "text-xs font-bold uppercase tracking-[0.16em] text-slate-700 dark:text-zinc-200";

/** Vertical rhythm between major workspace blocks. */
export const academicSectionStackClass = "mt-4 pt-4";

export const academicIconContainerMdClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200";

export const academicIconContainerLgClass =
  "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-all duration-200";

export type AcademicKpiAccent =
  | "purple"
  | "blue"
  | "indigo"
  | "green"
  | "amber"
  | "slate";

const accentStyles: Record<
  AcademicKpiAccent,
  { iconWrap: string; icon: string; accentBorder: string }
> = {
  purple: {
    iconWrap: "bg-violet-50 dark:bg-violet-950/35",
    icon: "text-violet-600 dark:text-violet-400",
    accentBorder: "border-l-[3px] border-l-violet-400/60",
  },
  blue: {
    iconWrap: "bg-sky-50 dark:bg-sky-950/35",
    icon: "text-sky-600 dark:text-sky-400",
    accentBorder: "border-l-[3px] border-l-sky-400/60",
  },
  indigo: {
    iconWrap: "bg-indigo-50 dark:bg-indigo-950/35",
    icon: "text-indigo-600 dark:text-indigo-400",
    accentBorder: "border-l-[3px] border-l-indigo-400/60",
  },
  green: {
    iconWrap: "bg-emerald-50 dark:bg-emerald-950/35",
    icon: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "border-l-[3px] border-l-emerald-400/60",
  },
  amber: {
    iconWrap: "bg-amber-50 dark:bg-amber-950/35",
    icon: "text-amber-700 dark:text-amber-400",
    accentBorder: "border-l-[3px] border-l-amber-400/60",
  },
  slate: {
    iconWrap: "bg-slate-100 dark:bg-zinc-800",
    icon: "text-slate-600 dark:text-zinc-400",
    accentBorder: "border-l-[3px] border-l-slate-400/50",
  },
};

export function getAcademicKpiAccentClasses(accent?: AcademicKpiAccent) {
  if (!accent) {
    return {
      iconWrap:
        "bg-[rgb(var(--school-primary-rgb)/0.10)] dark:bg-[rgb(var(--school-primary-rgb)/0.14)]",
      icon: "text-school-primary",
      accentBorder: "",
    };
  }
  return accentStyles[accent];
}

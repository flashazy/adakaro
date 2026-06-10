import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  academicCardBaseClass,
  academicCardInteractiveClass,
  academicIconContainerMdClass,
  getAcademicKpiAccentClasses,
  type AcademicKpiAccent,
} from "./academic-ui-styles";

interface AcademicStatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  className?: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  accent?: AcademicKpiAccent;
  /** Compact value display for long text (e.g. dates). */
  valueSize?: "default" | "compact";
}

export function AcademicStatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  href,
  onClick,
  isActive,
  accent,
  valueSize = "default",
}: AcademicStatCardProps) {
  const accentClasses = getAcademicKpiAccentClasses(accent);

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium leading-snug text-slate-500 dark:text-zinc-400">
          {label}
        </p>
        <span
          className={cn(academicIconContainerMdClass, accentClasses.iconWrap)}
        >
          <Icon className={cn("h-4 w-4", accentClasses.icon)} aria-hidden />
        </span>
      </div>
      <div className="mt-2.5">
        <p
          className={cn(
            "tabular-nums tracking-tight text-slate-900 dark:text-white",
            valueSize === "default"
              ? "text-[1.75rem] font-bold leading-none sm:text-[1.875rem]"
              : "text-xl font-bold leading-tight sm:text-2xl"
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] leading-snug text-slate-500/90 dark:text-zinc-500">
            {hint}
          </p>
        ) : null}
      </div>
    </>
  );

  const cardClass = cn(
    "flex min-h-[88px] flex-col justify-between p-4",
    academicCardBaseClass,
    accentClasses.accentBorder,
    (href || onClick) && academicCardInteractiveClass,
    isActive && "ring-2 ring-violet-400/50 dark:ring-violet-500/40",
    className
  );

  if (href) {
    return (
      <NavLinkWithLoading href={href} className={cardClass}>
        {content}
      </NavLinkWithLoading>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cardClass, "text-left")}>
        {content}
      </button>
    );
  }

  return <div className={cardClass}>{content}</div>;
}

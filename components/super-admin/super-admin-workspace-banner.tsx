import { SuperAdminLoadingAnchor } from "@/components/super-admin/super-admin-loading-action";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const EXIT_HREF = "/api/super-admin/schools/workspace/exit";

interface SuperAdminWorkspaceBannerProps {
  schoolName: string;
  className?: string;
}

export function SuperAdminWorkspaceBanner({
  schoolName,
  className,
}: SuperAdminWorkspaceBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/95 via-sky-50/80 to-amber-50/95 px-4 py-3 shadow-sm ring-1 ring-amber-100/60",
        "dark:border-amber-900/40 dark:from-amber-950/40 dark:via-sky-950/30 dark:to-amber-950/40 dark:ring-amber-900/30",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">
              <Shield className="h-3 w-3 shrink-0" aria-hidden />
              Support Access
            </span>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Super Admin Workspace Mode
            </p>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-zinc-200">
            Viewing: {schoolName}
          </p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
            You are managing this school as Super Admin. Changes affect this
            school.
          </p>
        </div>
        <SuperAdminLoadingAnchor
          href={EXIT_HREF}
          loadingLabel="Returning…"
          className={cn(
            "inline-flex w-full shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold",
            "border border-slate-300/80 bg-white text-slate-800 shadow-sm",
            "transition-colors hover:border-slate-400 hover:bg-slate-50",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600",
            "sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          )}
        >
          Return to Super Admin
        </SuperAdminLoadingAnchor>
      </div>
    </div>
  );
}

"use client";

import { SaKpiCard } from "@/components/super-admin/super-admin-dashboard-ui";
import type { DemoLeadPipelineStats } from "@/lib/demo-requests/types";
import { cn } from "@/lib/utils";

export function DemoLeadsWidget({
  pipelineStats,
}: {
  pipelineStats: DemoLeadPipelineStats;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
          Demo Leads
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Inbound pipeline from the public Contact page.
        </p>
      </div>
      <div
        className={cn(
          "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1",
          "md:grid md:auto-rows-fr md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0"
        )}
      >
        <SaKpiCard
          label="New Leads Today"
          value={pipelineStats.newLeadsToday}
          className="min-w-[9rem] shrink-0 snap-start md:min-w-0"
        />
        <SaKpiCard
          label="New Leads This Week"
          value={pipelineStats.newLeadsThisWeek}
          className="min-w-[9rem] shrink-0 snap-start md:min-w-0"
        />
        <SaKpiCard
          label="Pending Follow Ups"
          value={pipelineStats.pendingFollowUps}
          className="min-w-[9rem] shrink-0 snap-start md:min-w-0"
        />
        <SaKpiCard
          label="Scheduled Demos"
          value={pipelineStats.scheduledDemos}
          className="min-w-[9rem] shrink-0 snap-start md:min-w-0"
        />
        <SaKpiCard
          label="Overdue Leads"
          value={pipelineStats.overdueLeads}
          className="min-w-[9rem] shrink-0 snap-start md:min-w-0"
        />
      </div>
    </section>
  );
}

"use client";

import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import type { RevenueOpportunityRow } from "@/lib/super-admin/smart-intelligence-presentation";
import {
  getRevenueOpportunitiesEmptyCopy,
  schoolProfileHref,
} from "@/lib/super-admin/smart-intelligence-presentation";
import type { SmartIntelligencePayload } from "@/lib/super-admin/smart-intelligence-types";
import type { SuperAdminSchoolRow } from "@/lib/super-admin/types";
import { DollarSign } from "lucide-react";
import { IntelligenceEmptyState, siCardSurface } from "./intelligence-ui-tokens";
import { LikelihoodBar } from "./likelihood-bar";
import { cn } from "@/lib/utils";

export interface RevenueOpportunitiesProps {
  rows: RevenueOpportunityRow[];
  data: SmartIntelligencePayload;
  schools: SuperAdminSchoolRow[];
}

export function RevenueOpportunities({
  rows,
  data,
  schools,
}: RevenueOpportunitiesProps) {
  const emptyCopy = getRevenueOpportunitiesEmptyCopy(data, schools);

  return (
    <article
      id="revenue-opportunities"
      className={cn(siCardSurface, "scroll-mt-28 overflow-hidden")}
    >
      <div className="border-b border-slate-100/80 px-6 py-5">
        <h3 className="text-base font-semibold tracking-tight text-slate-950">
          Revenue Opportunities
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Potential upgrades — free-plan schools most likely to convert based on
          engagement and student volume.
        </p>
      </div>

      {rows.length === 0 ? (
        <IntelligenceEmptyState
          title={emptyCopy.title}
          description={emptyCopy.description}
          icon={<DollarSign className="h-5 w-5" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Engagement</th>
                <th className="px-4 py-3 font-medium">Likelihood</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-indigo-50/20"
                >
                  <td className="px-6 py-3.5">
                    <SuperAdminNavLink
                      href={schoolProfileHref(row.id)}
                      loadingLabel="Opening…"
                      className="font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {row.school}
                    </SuperAdminNavLink>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-700">
                    {row.students.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-semibold tabular-nums text-emerald-700">
                      {row.engagement}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <LikelihoodBar value={row.likelihood} />
                  </td>
                  <td className="px-4 py-3.5">
                    <SuperAdminNavLink
                      href={schoolProfileHref(row.id)}
                      loadingLabel="Opening…"
                      className="text-xs font-medium text-slate-500 hover:text-indigo-600"
                    >
                      Open profile
                    </SuperAdminNavLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

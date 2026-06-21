"use client";

import { SuperAdminNavLink } from "@/components/super-admin/super-admin-loading-action";
import { binaryPlanLabel } from "@/lib/plans";
import type { ChampionSchoolRow } from "@/lib/super-admin/smart-intelligence-presentation";
import {
  getChampionSchoolsEmptyCopy,
  schoolProfileHref,
} from "@/lib/super-admin/smart-intelligence-presentation";
import type { SmartIntelligencePayload } from "@/lib/super-admin/smart-intelligence-types";
import { Trophy } from "lucide-react";
import { IntelligenceEmptyState, siCardSurface } from "./intelligence-ui-tokens";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export interface ChampionSchoolsProps {
  rows: ChampionSchoolRow[];
  data: SmartIntelligencePayload;
}

export function ChampionSchools({ rows, data }: ChampionSchoolsProps) {
  const emptyCopy = getChampionSchoolsEmptyCopy(data);

  return (
    <article className={cn(siCardSurface, "overflow-hidden")}>
      <div className="border-b border-slate-100/80 px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50/80 text-amber-600">
            <Trophy className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-slate-950">
              Champion Schools
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Top performers by engagement — success stories on the platform.
            </p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <IntelligenceEmptyState
          title={emptyCopy.title}
          description={emptyCopy.description}
          icon={<Trophy className="h-5 w-5" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Engagement</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-amber-50/20"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {index < 3 ? (
                        <span className="text-base leading-none" aria-hidden>
                          {MEDALS[index]}
                        </span>
                      ) : (
                        <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-300">
                          {index + 1}
                        </span>
                      )}
                      <SuperAdminNavLink
                        href={schoolProfileHref(row.id)}
                        loadingLabel="Opening…"
                        className="font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {row.school}
                      </SuperAdminNavLink>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-bold tabular-nums text-emerald-700">
                      {row.engagementScore}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-700">
                    {row.students.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {binaryPlanLabel(row.plan)}
                  </td>
                  <td className="px-4 py-3.5">
                    <SuperAdminNavLink
                      href={schoolProfileHref(row.id)}
                      loadingLabel="Opening…"
                      className="text-xs font-medium text-slate-500 hover:text-indigo-600"
                    >
                      View school
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

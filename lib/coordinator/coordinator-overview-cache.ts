import "server-only";

import { unstable_cache, updateTag } from "next/cache";
import {
  loadCoordinatorOverview,
  type CoordinatorOverview,
} from "@/app/(dashboard)/teacher-dashboard/coordinator/data";

/** Short TTL — coordinator data changes when cards are generated/sent. */
const COORDINATOR_OVERVIEW_CACHE_SECONDS = 120;

export function coordinatorOverviewCacheTag(
  userId: string,
  term: string,
  academicYear: string
): string {
  return `coord-overview:${userId}:${term}:${academicYear}`;
}

export async function getCachedCoordinatorOverview(params: {
  userId: string;
  term: "Term 1" | "Term 2";
  academicYear: string;
}): Promise<CoordinatorOverview> {
  const year = params.academicYear.trim();
  const term = params.term;
  const userId = params.userId;

  return unstable_cache(
    async () => loadCoordinatorOverview({ userId, term, academicYear: year }),
    ["coord-overview", userId, term, year],
    {
      revalidate: COORDINATOR_OVERVIEW_CACHE_SECONDS,
      tags: [coordinatorOverviewCacheTag(userId, term, year)],
    }
  )();
}

export function invalidateCoordinatorOverviewCache(
  userId: string,
  term: string,
  academicYear: string
): void {
  updateTag(coordinatorOverviewCacheTag(userId, term.trim(), academicYear.trim()));
}

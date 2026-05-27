import "server-only";

import { unstable_cache, updateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  computeTerm2ReportCardAveragesForStudents,
  type Term2StudentPromotionStats,
} from "@/lib/promotions/compute-term2-report-card-averages";

/** 15 minutes — promotion averages change infrequently during review windows. */
export const PROMOTION_STATS_CACHE_SECONDS = 900;

export function promotionStatsCacheTag(
  classId: string,
  academicYear: number
): string {
  return `promotion-stats:${classId}:${academicYear}`;
}

function studentIdsCacheKey(studentIds: string[]): string {
  if (studentIds.length === 0) return "none";
  return [...studentIds].sort().join(",");
}

type CachedPromotionStats = {
  subjectsCount: number;
  statsEntries: [string, Term2StudentPromotionStats][];
};

function isMapLike(
  v: unknown
): v is Map<string, Term2StudentPromotionStats> {
  return v instanceof Map;
}

function toCachedPayload(res: {
  subjectsCount: number;
  statsByStudentId: Map<string, Term2StudentPromotionStats>;
}): CachedPromotionStats {
  return {
    subjectsCount: res.subjectsCount,
    statsEntries: [...res.statsByStudentId.entries()],
  };
}

function fromCachedPayload(
  payload: unknown
): { subjectsCount: number; statsByStudentId: Map<string, Term2StudentPromotionStats> } | null {
  if (
    payload == null ||
    typeof payload !== "object" ||
    !("subjectsCount" in payload) ||
    !("statsEntries" in payload)
  ) {
    return null;
  }
  const p = payload as Partial<CachedPromotionStats>;
  const subjectsCount =
    typeof p.subjectsCount === "number" ? p.subjectsCount : 0;
  const statsEntries = Array.isArray(p.statsEntries) ? p.statsEntries : null;
  if (!statsEntries) return null;

  const map = new Map<string, Term2StudentPromotionStats>();
  for (const entry of statsEntries) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [studentId, stats] = entry as [unknown, unknown];
    if (typeof studentId !== "string" || !stats || typeof stats !== "object") {
      continue;
    }
    map.set(studentId, stats as Term2StudentPromotionStats);
  }

  return { subjectsCount, statsByStudentId: map };
}

export async function getCachedTerm2PromotionStats(
  admin: SupabaseClient<Database>,
  args: {
    classId: string;
    academicYear: number;
    studentIds: string[];
  }
): Promise<{
  subjectsCount: number;
  statsByStudentId: Map<string, Term2StudentPromotionStats>;
}> {
  const year = args.academicYear;
  const classId = args.classId;
  const studentKey = studentIdsCacheKey(args.studentIds);

  // NOTE: `unstable_cache` must return JSON-serializable data. `Map` will be
  // serialized into a plain object/array and lose `.get()`. We cache entries
  // and rehydrate into a `Map` on read.
  try {
    const cached = await unstable_cache(
      async (): Promise<CachedPromotionStats> => {
        const res = await computeTerm2ReportCardAveragesForStudents(admin, {
          classId,
          academicYear: year,
          studentIds: args.studentIds,
        });
        return toCachedPayload(res);
      },
      ["promotion-term2-stats", classId, String(year), studentKey],
      {
        revalidate: PROMOTION_STATS_CACHE_SECONDS,
        tags: [promotionStatsCacheTag(classId, year)],
      }
    )();

    const parsed = fromCachedPayload(cached);
    if (parsed && isMapLike(parsed.statsByStudentId)) return parsed;
  } catch (e) {
    console.warn(
      "[promotions] term2 stats cache failed, using direct query:",
      e instanceof Error ? e.message : e
    );
  }

  // Fallback path: direct compute (RPC or multi-query, depending on DB).
  try {
    const direct = await computeTerm2ReportCardAveragesForStudents(admin, {
      classId,
      academicYear: year,
      studentIds: args.studentIds,
    });
    const map = isMapLike(direct.statsByStudentId)
      ? direct.statsByStudentId
      : new Map<string, Term2StudentPromotionStats>();
    return { subjectsCount: direct.subjectsCount ?? 0, statsByStudentId: map };
  } catch (e) {
    console.error(
      "[promotions] term2 stats direct compute failed:",
      e instanceof Error ? e.message : e
    );
    return {
      subjectsCount: 0,
      statsByStudentId: new Map<string, Term2StudentPromotionStats>(),
    };
  }
}

export function invalidatePromotionStatsCache(
  classId: string,
  academicYear: number
): void {
  updateTag(promotionStatsCacheTag(classId, academicYear));
}

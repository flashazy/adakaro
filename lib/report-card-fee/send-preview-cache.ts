import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClassSendEligibilityPreview } from "./send-preview";
import type { ClassSendEligibilityPreview } from "./types";

export function sendEligibilityCacheTag(
  classId: string,
  term: string,
  academicYear: string
): string {
  return `coord-send-eligibility:${classId}:${term}:${academicYear}`;
}

export async function getCachedClassSendEligibilityPreview(
  classId: string,
  term: string,
  academicYear: string
): Promise<ClassSendEligibilityPreview> {
  const year = academicYear.trim();
  const termNorm = term.trim();
  return unstable_cache(
    async () => {
      const admin = createAdminClient();
      return buildClassSendEligibilityPreview(admin, {
        classId,
        term: termNorm,
        academicYear: year,
      });
    },
    ["coord-send-eligibility", classId, termNorm, year],
    {
      revalidate: 120,
      tags: [sendEligibilityCacheTag(classId, termNorm, year)],
    }
  )();
}

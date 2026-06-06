"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkSubjectCompatibilityForMoves } from "@/lib/student-subject-enrollment/subject-compatibility";
import type {
  SubjectCompatibilityBatchResult,
  SubjectCompatibilityMove,
} from "@/lib/student-subject-enrollment/subject-compatibility-types";

export async function checkSubjectCompatibilityAction(
  moves: SubjectCompatibilityMove[]
): Promise<
  | { ok: true; result: SubjectCompatibilityBatchResult }
  | { ok: false; error: string }
> {
  try {
    if (!moves?.length) {
      return {
        ok: true,
        result: { status: "allowed", students: [] },
      };
    }

    const admin = createAdminClient();
    const result = await checkSubjectCompatibilityForMoves(admin, moves);
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compatibility check failed.";
    return { ok: false, error: message };
  }
}

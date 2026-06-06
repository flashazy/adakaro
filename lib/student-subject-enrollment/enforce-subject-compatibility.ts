import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  checkSubjectCompatibilityForMoves,
  subjectCompatibilityBlockedMessage,
  studentsRequiringCompatibilityAck,
  type SubjectCompatibilityBatchResult,
  type SubjectCompatibilityMove,
} from "@/lib/student-subject-enrollment/subject-compatibility";

type DbClient = SupabaseClient<Database>;

export type EnforceSubjectCompatibilityResult =
  | { ok: true; ackStudentIds: Set<string> }
  | {
      ok: false;
      blocked: true;
      error: string;
      result: SubjectCompatibilityBatchResult;
    }
  | {
      ok: false;
      blocked: false;
      requiresAck: true;
      result: SubjectCompatibilityBatchResult;
    };

export async function enforceSubjectCompatibilityBeforeMove(
  client: DbClient,
  moves: SubjectCompatibilityMove[],
  acknowledgeWarning: boolean
): Promise<EnforceSubjectCompatibilityResult> {
  if (moves.length === 0) {
    return { ok: true, ackStudentIds: new Set() };
  }

  const result = await checkSubjectCompatibilityForMoves(client, moves);

  if (result.status === "blocked") {
    return {
      ok: false,
      blocked: true,
      error: subjectCompatibilityBlockedMessage(result),
      result,
    };
  }

  if (result.status === "warning" && !acknowledgeWarning) {
    return {
      ok: false,
      blocked: false,
      requiresAck: true,
      result,
    };
  }

  return {
    ok: true,
    ackStudentIds: acknowledgeWarning
      ? studentsRequiringCompatibilityAck(result)
      : new Set(),
  };
}

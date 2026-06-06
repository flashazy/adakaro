import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { RecordStudentClassMoveInput } from "./types";
import { shouldRecordClassMove } from "./should-record-class-move";

type DbClient = SupabaseClient<Database>;

function normalizeClassId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/**
 * Append a class movement row when `from_class_id` and `to_class_id` differ.
 * Does not update students or touch attendance, marks, or report cards.
 */
export async function recordStudentClassMoveIfChanged(
  client: DbClient,
  input: RecordStudentClassMoveInput
): Promise<{ recorded: boolean; historyId?: string; error?: string }> {
  const fromClassId = normalizeClassId(input.fromClassId);
  const toClassId = normalizeClassId(input.toClassId);

  if (!toClassId) {
    return { recorded: false, error: "to_class_id is required." };
  }

  if (!shouldRecordClassMove(fromClassId, toClassId)) {
    return { recorded: false };
  }

  const row = {
    school_id: input.schoolId,
    student_id: input.studentId,
    from_class_id: fromClassId,
    to_class_id: toClassId,
    effective_at: input.effectiveAt ?? new Date().toISOString(),
    source: input.source,
    source_id: input.sourceId ?? null,
    actor_id: input.actorId ?? null,
    academic_year: input.academicYear?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await client
    .from("student_class_history")
    .insert(row as never)
    .select("id")
    .maybeSingle();

  if (error) {
    return { recorded: false, error: error.message };
  }

  return {
    recorded: true,
    historyId: (data as { id: string } | null)?.id,
  };
}

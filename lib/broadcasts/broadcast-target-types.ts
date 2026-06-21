export type BroadcastTargetType =
  | "all"
  | "single_school"
  | "selected_schools"
  | "targeted_admins";

export interface BroadcastTargetRow {
  id: string;
  title: string;
  target_user_ids: string[] | null;
  target_type: BroadcastTargetType | null;
  target_school_id: string | null;
  target_school_ids: string[] | null;
  source: string | null;
  source_context: Record<string, unknown> | null;
}

/** Normalize DB row with legacy fallbacks when targeting columns are absent. */
export function normalizeBroadcastTargetRow(
  row: Record<string, unknown>
): BroadcastTargetRow {
  const targetUserIds = Array.isArray(row.target_user_ids)
    ? (row.target_user_ids as string[])
    : null;

  let targetType = (row.target_type as BroadcastTargetType | null) ?? null;
  const targetSchoolId =
    typeof row.target_school_id === "string" ? row.target_school_id : null;
  const targetSchoolIds = Array.isArray(row.target_school_ids)
    ? (row.target_school_ids as string[])
    : null;

  if (!targetType) {
    if (targetSchoolId) {
      targetType = "single_school";
    } else if (targetSchoolIds?.length) {
      targetType = "selected_schools";
    } else if (targetUserIds?.length) {
      targetType = "targeted_admins";
    } else {
      targetType = "all";
    }
  }

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    target_user_ids: targetUserIds,
    target_type: targetType,
    target_school_id: targetSchoolId,
    target_school_ids: targetSchoolIds,
    source: typeof row.source === "string" ? row.source : null,
    source_context:
      row.source_context && typeof row.source_context === "object"
        ? (row.source_context as Record<string, unknown>)
        : null,
  };
}

export function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === "42703";
}

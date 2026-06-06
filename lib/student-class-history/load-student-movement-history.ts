import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProfilesByIds } from "@/lib/student-profile-admin-client";
import type { Database } from "@/types/supabase";
import { movementHistorySourceLabel } from "./movement-history-labels";
import type { StudentClassHistorySource } from "./types";

export interface StudentMovementHistoryRow {
  id: string;
  fromClassName: string;
  toClassName: string;
  effectiveAt: string;
  source: StudentClassHistorySource;
  sourceLabel: string;
  actorName: string;
}

export async function loadStudentMovementHistory(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<{ rows: StudentMovementHistoryRow[]; error: string | null }> {
  const { data: historyRows, error } = await supabase
    .from("student_class_history")
    .select(
      "id, from_class_id, to_class_id, effective_at, source, actor_id"
    )
    .eq("student_id", studentId)
    .order("effective_at", { ascending: false });

  if (error) {
    return { rows: [], error: error.message };
  }

  const raw = (historyRows ?? []) as {
    id: string;
    from_class_id: string | null;
    to_class_id: string;
    effective_at: string;
    source: StudentClassHistorySource;
    actor_id: string | null;
  }[];

  if (raw.length === 0) {
    return { rows: [], error: null };
  }

  const classIds = [
    ...new Set(
      raw.flatMap((r) =>
        [r.from_class_id, r.to_class_id].filter((id): id is string => Boolean(id))
      )
    ),
  ];
  const actorIds = [
    ...new Set(
      raw.map((r) => r.actor_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const classNameById = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    for (const c of (classes ?? []) as { id: string; name: string }[]) {
      classNameById.set(c.id, c.name?.trim() || "Class");
    }
  }

  const actorNameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const profilesById = await fetchProfilesByIds(supabase, actorIds);
    for (const [id, profile] of profilesById) {
      const name = profile.full_name?.trim();
      if (name) actorNameById.set(id, name);
    }
  }

  const rows: StudentMovementHistoryRow[] = raw.map((r) => ({
    id: r.id,
    fromClassName: r.from_class_id
      ? (classNameById.get(r.from_class_id) ?? "—")
      : "—",
    toClassName: classNameById.get(r.to_class_id) ?? "—",
    effectiveAt: r.effective_at,
    source: r.source,
    sourceLabel: movementHistorySourceLabel(r.source),
    actorName: r.actor_id
      ? (actorNameById.get(r.actor_id) ?? "—")
      : "—",
  }));

  rows.sort(
    (a, b) =>
      new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime()
  );

  return { rows, error: null };
}

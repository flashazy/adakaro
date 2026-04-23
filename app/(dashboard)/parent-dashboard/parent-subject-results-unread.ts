import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster, type ClusterDb } from "@/lib/class-cluster";
import { subjectTextKey } from "@/lib/subject-text-key";
import {
  initialEmptySubjectResultsUnread,
  type SubjectResultsUnreadState,
} from "@/lib/parent-subject-results-unread-types";

type ScoreTimes = { created_at: string; updated_at: string };

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Max activity for an assignment: updates to the assignment or any score row
 * (an insert/update in `teacher_scores` marks the result as "new" for parents
 * until they view the assignment in Subject results).
 */
function assignmentActivityIso(
  g: { created_at: string; updated_at: string },
  scores: ScoreTimes[]
): string {
  let t = maxIso(g.created_at, g.updated_at);
  for (const s of scores) {
    t = maxIso(t, s.created_at);
    t = maxIso(t, s.updated_at);
  }
  return t;
}

function activityMs(iso: string): number {
  return new Date(iso).getTime();
}

type ViewedPick = Pick<
  Database["public"]["Tables"]["parent_viewed_results"]["Row"],
  "assignment_id" | "viewed_at"
>;

/**
 * Load persisted view timestamps using the parent session (RLS). Falls back to
 * the service role if the auth query fails so refresh still reflects DB state.
 */
async function loadViewedAtByAssignment(
  supabaseUser: SupabaseClient<Database>,
  admin: ClusterDb,
  parentId: string,
  studentId: string
): Promise<Map<string, string>> {
  const viewed = new Map<string, string>();

  const { data: userRows, error: userErr } = await supabaseUser
    .from("parent_viewed_results")
    .select("assignment_id, viewed_at")
    .eq("parent_id", parentId)
    .eq("student_id", studentId);

  if (!userErr && userRows) {
    const rows = userRows as ViewedPick[];
    for (const row of rows) {
      viewed.set(row.assignment_id, row.viewed_at);
    }
    return viewed;
  }

  if (userErr && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- diagnose RLS vs admin path
    console.warn(
      "[loadParentSubjectResultsUnread] auth select parent_viewed_results failed, using admin fallback",
      userErr.message
    );
  }

  const { data: adminRows, error: adminErr } = await admin
    .from("parent_viewed_results")
    .select("assignment_id, viewed_at")
    .eq("parent_id", parentId)
    .eq("student_id", studentId);

  if (adminErr && process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error(
      "[loadParentSubjectResultsUnread] admin select parent_viewed_results",
      adminErr.message
    );
    return viewed;
  }

  const fallback = (adminRows ?? []) as ViewedPick[];
  for (const row of fallback) {
    viewed.set(row.assignment_id, row.viewed_at);
  }
  return viewed;
}

/**
 * Read-only: unread class-result assignments for a parent/child, matching
 * which assignments appear in Subject results (cluster + ≥1 `teacher_scores` row).
 *
 * Uses `parent_viewed_results` for last-opened times and compares to assignment +
 * gradebook activity so refresh matches persisted views.
 */
export async function loadParentSubjectResultsUnread(
  supabaseUser: SupabaseClient<Database>,
  parentId: string,
  studentId: string,
  classId: string
): Promise<SubjectResultsUnreadState> {
  const admin = createAdminClient() as ClusterDb;

  const viewed = await loadViewedAtByAssignment(
    supabaseUser,
    admin,
    parentId,
    studentId
  );

  const cluster = await resolveClassCluster(admin, classId);
  const { data: rawAssign } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, subject, created_at, updated_at")
    .in("class_id", cluster.classIds);

  const allAssign = (rawAssign ?? []) as {
    id: string;
    subject: string;
    created_at: string;
    updated_at: string;
  }[];
  if (allAssign.length === 0) {
    return initialEmptySubjectResultsUnread();
  }

  const allAssignmentIds = allAssign.map((a) => a.id);
  const { data: scoreData } = await admin
    .from("teacher_scores")
    .select("assignment_id, created_at, updated_at")
    .in("assignment_id", allAssignmentIds);

  const scoreRows = (scoreData ?? []) as (ScoreTimes & { assignment_id: string })[];
  const byAssignScores = new Map<string, ScoreTimes[]>();
  for (const row of scoreRows) {
    const list = byAssignScores.get(row.assignment_id) ?? [];
    list.push({ created_at: row.created_at, updated_at: row.updated_at });
    byAssignScores.set(row.assignment_id, list);
  }

  const withScores = allAssign.filter(
    (a) => (byAssignScores.get(a.id)?.length ?? 0) > 0
  );
  if (withScores.length === 0) {
    return initialEmptySubjectResultsUnread();
  }

  const byAssignmentUnviewed: Record<string, boolean> = {};
  const assignmentSubjectById: Record<string, string> = {};
  let totalUnviewed = 0;

  for (const a of withScores) {
    const act = assignmentActivityIso(a, byAssignScores.get(a.id) ?? []);
    const sk = subjectTextKey(a.subject);
    assignmentSubjectById[a.id] = sk;
    const vAt = viewed.get(a.id) ?? null;
    const isUnviewed =
      !vAt || activityMs(act) > activityMs(vAt);
    byAssignmentUnviewed[a.id] = isUnviewed;
    if (isUnviewed) {
      totalUnviewed += 1;
    }
  }

  const bySubjectHasUnviewed: Record<string, boolean> = {};
  const subjectKeys = new Set(
    withScores.map((a) => subjectTextKey(a.subject))
  );
  for (const sk of subjectKeys) {
    bySubjectHasUnviewed[sk] = withScores
      .filter((a) => subjectTextKey(a.subject) === sk)
      .some((a) => byAssignmentUnviewed[a.id]);
  }

  return {
    totalUnviewed,
    bySubjectHasUnviewed,
    byAssignmentUnviewed,
    assignmentSubjectById,
  };
}

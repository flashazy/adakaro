"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import { subjectTextKey } from "@/lib/subject-text-key";
import type { Database } from "@/types/supabase";

type ViewedInsert = Database["public"]["Tables"]["parent_viewed_results"]["Insert"];
type StudentClassPick = Pick<
  Database["public"]["Tables"]["students"]["Row"],
  "class_id"
>;

/**
 * Records that the parent has opened this assignment’s Subject results
 * (drives “new / unviewed” state until a teacher next updates scores).
 */
export async function recordParentSubjectResultViewedAction(input: {
  studentId: string;
  classId: string;
  assignmentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated." };
  }

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("parent_students")
    .select("id")
    .eq("parent_id", user.id)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (!link) {
    return { ok: false, error: "Not allowed." };
  }

  const { data: st0 } = await admin
    .from("students")
    .select("class_id")
    .eq("id", input.studentId)
    .maybeSingle();
  const st = st0 as StudentClassPick | null;
  if (!st) {
    return { ok: false, error: "Student not found." };
  }

  const cluster = await resolveClassCluster(admin, input.classId);
  if (!cluster.classIds.includes(st.class_id)) {
    return { ok: false, error: "Student not in this class group." };
  }

  const { data: aRow } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, class_id, subject")
    .eq("id", input.assignmentId)
    .maybeSingle();
  if (!aRow) {
    return { ok: false, error: "Assignment not found." };
  }
  if (!cluster.classIds.includes((aRow as { class_id: string }).class_id)) {
    return { ok: false, error: "Assignment not in this class group." };
  }

  const sk = subjectTextKey((aRow as { subject: string | null }).subject);

  const row: ViewedInsert = {
    parent_id: user.id,
    student_id: input.studentId,
    subject: sk,
    assignment_id: input.assignmentId,
    viewed_at: new Date().toISOString(),
  };

  // Merge on PK so `viewed_at` (and `subject`) refresh when the parent re-opens after new scores.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Postgrest Insert inference for this table
  const { error } = await (supabase as any)
    .from("parent_viewed_results")
    .upsert(row, {
      onConflict: "parent_id,student_id,assignment_id",
      ignoreDuplicates: false,
    });
  if (error) {
    return { ok: false, error: error.message || "Failed to record view." };
  }
  return { ok: true };
}

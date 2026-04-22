"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ParentMajorExamClassResultsPayload } from "@/lib/parent-major-exam-class-results-types";
import { loadParentMajorExamClassResults } from "./load-parent-major-exam-class-results";

/**
 * Fetches class statistics for a single subject (gradebook) on the child’s
 * class, after verifying the current user is linked as parent.
 */
export async function loadParentClassResultsForSubjectAction(input: {
  studentId: string;
  classId: string;
  subject: string;
}): Promise<
  | { ok: true; payload: ParentMajorExamClassResultsPayload }
  | { ok: false; error: string }
> {
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

  const { data: st } = await admin
    .from("students")
    .select("id")
    .eq("id", input.studentId)
    .eq("class_id", input.classId)
    .maybeSingle();
  if (!st) {
    return { ok: false, error: "Student not in this class." };
  }

  const payload = await loadParentMajorExamClassResults(
    input.classId,
    input.subject
  );
  return { ok: true, payload };
}

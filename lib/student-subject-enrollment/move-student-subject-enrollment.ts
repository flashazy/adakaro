import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { reportSubjectEnrollmentDrift } from "@/lib/watchdog/health-alert-reporters";

type DbClient = SupabaseClient<Database>;

export interface MoveStudentSubjectEnrollmentSkipped {
  subjectId: string;
  subjectName: string;
  academicYear: number;
  term: string;
}

export interface MoveStudentSubjectEnrollmentResult {
  migratedCount: number;
  removedCount: number;
  skipped: MoveStudentSubjectEnrollmentSkipped[];
  error: string | null;
  warning: string | null;
}

function normalizeId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

type EnrollmentRow = {
  id: string;
  subject_id: string;
  class_id: string;
  academic_year: number;
  term: string;
};

/**
 * Aligns all stale `student_subject_enrollment` rows (class_id ≠ student's current
 * class) to `toClassId` when the subject is offered there. Removes rows for
 * subjects not offered in the new class.
 *
 * Handles multi-hop moves (e.g. 2C → 2A → 2B) where enrollment may still point
 * at any prior class, not only the immediate previous one.
 */
export async function reconcileStudentSubjectEnrollmentToClass(
  client: DbClient,
  params: {
    schoolId: string;
    studentId: string;
    toClassId: string;
  }
): Promise<MoveStudentSubjectEnrollmentResult> {
  const schoolId = normalizeId(params.schoolId);
  const studentId = normalizeId(params.studentId);
  const toClassId = normalizeId(params.toClassId);

  const empty: MoveStudentSubjectEnrollmentResult = {
    migratedCount: 0,
    removedCount: 0,
    skipped: [],
    error: null,
    warning: null,
  };

  if (!schoolId || !studentId || !toClassId) {
    return { ...empty, error: "Invalid school, student, or class id." };
  }

  const { data: studentRow, error: studentErr } = await client
    .from("students")
    .select("id, school_id, class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (studentErr) {
    return { ...empty, error: studentErr.message };
  }

  const student = studentRow as
    | { id: string; school_id: string; class_id: string }
    | null;

  if (!student) {
    return { ...empty, error: "Student not found in this school." };
  }

  if (student.class_id !== toClassId) {
    return {
      ...empty,
      error:
        "Student class_id does not match the target class. Run enrollment reconciliation after the class update.",
    };
  }

  const { data: classRow, error: classErr } = await client
    .from("classes")
    .select("id, school_id")
    .eq("id", toClassId)
    .maybeSingle();

  if (classErr) {
    return { ...empty, error: classErr.message };
  }

  const targetClass = classRow as { id: string; school_id: string } | null;
  if (!targetClass || targetClass.school_id !== schoolId) {
    return { ...empty, error: "Target class not found in this school." };
  }

  const { data: enrollmentRows, error: enrollErr } = await client
    .from("student_subject_enrollment")
    .select("id, subject_id, class_id, academic_year, term")
    .eq("student_id", studentId)
    .neq("class_id", toClassId);

  if (enrollErr) {
    return { ...empty, error: enrollErr.message };
  }

  const rows = (enrollmentRows ?? []) as EnrollmentRow[];

  if (rows.length === 0) {
    return empty;
  }

  const { data: offeredRows, error: offeredErr } = await client
    .from("subject_classes")
    .select("subject_id")
    .eq("class_id", toClassId);

  if (offeredErr) {
    return { ...empty, error: offeredErr.message };
  }

  const offeredSubjectIds = new Set(
    ((offeredRows ?? []) as { subject_id: string }[]).map((r) => r.subject_id)
  );

  const skippedSubjectIds = new Set<string>();
  const toMigrate: EnrollmentRow[] = [];
  const toRemove: EnrollmentRow[] = [];

  for (const row of rows) {
    if (offeredSubjectIds.has(row.subject_id)) {
      toMigrate.push(row);
    } else {
      toRemove.push(row);
      skippedSubjectIds.add(row.subject_id);
    }
  }

  let migratedCount = 0;
  let removedCount = 0;
  const updateErrors: string[] = [];

  for (const row of toMigrate) {
    const { data: existingAtNew, error: existErr } = await client
      .from("student_subject_enrollment")
      .select("id")
      .eq("student_id", studentId)
      .eq("subject_id", row.subject_id)
      .eq("academic_year", row.academic_year)
      .eq("term", row.term)
      .eq("class_id", toClassId)
      .maybeSingle();

    if (existErr) {
      updateErrors.push(existErr.message);
      continue;
    }

    if (existingAtNew) {
      const { error: delErr } = await client
        .from("student_subject_enrollment")
        .delete()
        .eq("id", row.id);
      if (delErr) {
        updateErrors.push(delErr.message);
      } else {
        removedCount += 1;
      }
      continue;
    }

    const { error: updErr } = await client
      .from("student_subject_enrollment")
      .update({ class_id: toClassId } as never)
      .eq("id", row.id)
      .eq("student_id", studentId);

    if (updErr) {
      updateErrors.push(updErr.message);
      continue;
    }

    migratedCount += 1;
  }

  for (const row of toRemove) {
    const { error: delErr } = await client
      .from("student_subject_enrollment")
      .delete()
      .eq("id", row.id);

    if (delErr) {
      updateErrors.push(delErr.message);
      continue;
    }

    removedCount += 1;
  }

  const skipped: MoveStudentSubjectEnrollmentSkipped[] = [];
  if (skippedSubjectIds.size > 0) {
    const { data: subjectRows } = await client
      .from("subjects")
      .select("id, name")
      .in("id", [...skippedSubjectIds]);

    const nameById = new Map(
      ((subjectRows ?? []) as { id: string; name: string }[]).map((s) => [
        s.id,
        s.name?.trim() || "Subject",
      ])
    );

    for (const row of toRemove) {
      skipped.push({
        subjectId: row.subject_id,
        subjectName: nameById.get(row.subject_id) ?? "Subject",
        academicYear: row.academic_year,
        term: row.term,
      });
    }
  }

  let warning: string | null = null;

  if (skipped.length > 0) {
    const labels = [...new Set(skipped.map((s) => s.subjectName))].join(", ");
    warning = `Subject enrollment not moved (not offered in new class): ${labels}.`;
    console.warn("[reconcileStudentSubjectEnrollmentToClass] skipped subjects", {
      schoolId,
      studentId,
      toClassId,
      staleClassIds: [...new Set(rows.map((r) => r.class_id))],
      skipped,
    });
  }

  if (toMigrate.length > 0 && migratedCount === 0 && skipped.length === 0) {
    warning = "No subject enrollment rows were migrated.";
  }

  if (updateErrors.length > 0) {
    const errMsg = updateErrors[0] ?? "Enrollment update failed.";
    console.error("[reconcileStudentSubjectEnrollmentToClass] partial failure", {
      schoolId,
      studentId,
      toClassId,
      errors: updateErrors,
    });
    return {
      migratedCount,
      removedCount,
      skipped,
      error: errMsg,
      warning:
        warning ??
        "Some subject enrollment rows could not be updated. Check server logs.",
    };
  }

  return {
    migratedCount,
    removedCount,
    skipped,
    error: null,
    warning,
  };
}

/**
 * Moves active subject enrollment to the student's new class for subjects
 * offered there (`subject_classes`). Reconciles **all** stale enrollment rows
 * (any prior class), not only the immediate `fromClassId`.
 *
 * Call only after `students.class_id` has been updated to `toClassId`.
 */
export async function moveStudentSubjectEnrollment(
  client: DbClient,
  params: {
    schoolId: string;
    studentId: string;
    fromClassId: string;
    toClassId: string;
  }
): Promise<MoveStudentSubjectEnrollmentResult> {
  const fromClassId = normalizeId(params.fromClassId);
  const toClassId = normalizeId(params.toClassId);

  if (fromClassId && toClassId && fromClassId === toClassId) {
    return {
      migratedCount: 0,
      removedCount: 0,
      skipped: [],
      error: null,
      warning: null,
    };
  }

  const result = await reconcileStudentSubjectEnrollmentToClass(client, {
    schoolId: params.schoolId,
    studentId: params.studentId,
    toClassId: params.toClassId,
  });

  if (result.error) {
    reportSubjectEnrollmentDrift(
      {
        phase: "reconcile_after_class_move",
        student_id: params.studentId,
        from_class_id: params.fromClassId,
        to_class_id: params.toClassId,
        error: result.error,
        migrated_count: result.migratedCount,
        removed_count: result.removedCount,
      },
      params.schoolId
    );
  }

  return result;
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  SubjectCompatibilityBatchResult,
  SubjectCompatibilityMove,
  SubjectCompatibilityStudentResult,
  SubjectCompatibilityStatus,
} from "@/lib/student-subject-enrollment/subject-compatibility-types";

export type {
  SubjectCompatibilityBatchResult,
  SubjectCompatibilityMove,
  SubjectCompatibilityStudentResult,
  SubjectCompatibilityStatus,
} from "@/lib/student-subject-enrollment/subject-compatibility-types";
export { SUBJECT_COMPATIBILITY_AUDIT_NOTE } from "@/lib/student-subject-enrollment/subject-compatibility-types";

type DbClient = SupabaseClient<Database>;

function classifyCompatibility(
  enrolledSubjectIds: string[],
  offeredSubjectIds: Set<string>,
  nameBySubjectId: Map<string, string>
): Pick<
  SubjectCompatibilityStudentResult,
  "status" | "compatibleSubjectNames" | "missingSubjectNames"
> {
  if (enrolledSubjectIds.length === 0) {
    return {
      status: "allowed",
      compatibleSubjectNames: [],
      missingSubjectNames: [],
    };
  }

  const compatibleSubjectNames: string[] = [];
  const missingSubjectNames: string[] = [];

  for (const subjectId of enrolledSubjectIds) {
    const name = nameBySubjectId.get(subjectId) ?? "Subject";
    if (offeredSubjectIds.has(subjectId)) {
      compatibleSubjectNames.push(name);
    } else {
      missingSubjectNames.push(name);
    }
  }

  compatibleSubjectNames.sort((a, b) => a.localeCompare(b));
  missingSubjectNames.sort((a, b) => a.localeCompare(b));

  if (compatibleSubjectNames.length === 0) {
    return { status: "blocked", compatibleSubjectNames, missingSubjectNames };
  }
  if (missingSubjectNames.length > 0) {
    return { status: "warning", compatibleSubjectNames, missingSubjectNames };
  }
  return { status: "allowed", compatibleSubjectNames, missingSubjectNames };
}

function mergeBatchStatus(
  students: SubjectCompatibilityStudentResult[]
): SubjectCompatibilityStatus {
  if (students.some((s) => s.status === "blocked")) return "blocked";
  if (students.some((s) => s.status === "warning")) return "warning";
  return "allowed";
}

/**
 * Compare each student's enrolled subjects against subjects offered on the
 * target class (`subject_classes`). Used before streaming, promotion, or
 * manual class changes.
 */
export async function checkSubjectCompatibilityForMoves(
  client: DbClient,
  moves: SubjectCompatibilityMove[]
): Promise<SubjectCompatibilityBatchResult> {
  const uniqueMoves = [
    ...new Map(
      moves.map((m) => [
        `${m.studentId}|${m.targetClassId}`,
        { studentId: m.studentId.trim(), targetClassId: m.targetClassId.trim() },
      ] as const)
    ).values(),
  ].filter((m) => m.studentId && m.targetClassId);

  if (uniqueMoves.length === 0) {
    return { status: "allowed", students: [] };
  }

  const studentIds = [...new Set(uniqueMoves.map((m) => m.studentId))];
  const targetClassIds = [...new Set(uniqueMoves.map((m) => m.targetClassId))];

  const { data: studentRows, error: studentErr } = await client
    .from("students")
    .select("id, full_name")
    .in("id", studentIds);

  if (studentErr) {
    throw new Error(studentErr.message);
  }

  const nameByStudentId = new Map(
    ((studentRows ?? []) as { id: string; full_name: string | null }[]).map(
      (s) => [s.id, (s.full_name ?? "").trim() || "Student"]
    )
  );

  const { data: enrollmentRows, error: enrollErr } = await client
    .from("student_subject_enrollment")
    .select("student_id, subject_id")
    .in("student_id", studentIds);

  if (enrollErr) {
    throw new Error(enrollErr.message);
  }

  const enrolledByStudent = new Map<string, Set<string>>();
  const allSubjectIds = new Set<string>();

  for (const row of (enrollmentRows ?? []) as {
    student_id: string;
    subject_id: string;
  }[]) {
    if (!enrolledByStudent.has(row.student_id)) {
      enrolledByStudent.set(row.student_id, new Set());
    }
    enrolledByStudent.get(row.student_id)!.add(row.subject_id);
    allSubjectIds.add(row.subject_id);
  }

  const { data: offeredRows, error: offeredErr } = await client
    .from("subject_classes")
    .select("class_id, subject_id")
    .in("class_id", targetClassIds);

  if (offeredErr) {
    throw new Error(offeredErr.message);
  }

  const offeredByClass = new Map<string, Set<string>>();
  for (const row of (offeredRows ?? []) as {
    class_id: string;
    subject_id: string;
  }[]) {
    if (!offeredByClass.has(row.class_id)) {
      offeredByClass.set(row.class_id, new Set());
    }
    offeredByClass.get(row.class_id)!.add(row.subject_id);
    allSubjectIds.add(row.subject_id);
  }

  let nameBySubjectId = new Map<string, string>();
  if (allSubjectIds.size > 0) {
    const { data: subjectRows } = await client
      .from("subjects")
      .select("id, name")
      .in("id", [...allSubjectIds]);

    nameBySubjectId = new Map(
      ((subjectRows ?? []) as { id: string; name: string }[]).map((s) => [
        s.id,
        s.name?.trim() || "Subject",
      ])
    );
  }

  const students: SubjectCompatibilityStudentResult[] = uniqueMoves.map((move) => {
    const enrolledSubjectIds = [
      ...Array.from(enrolledByStudent.get(move.studentId) ?? []),
    ];
    const offeredSubjectIds =
      offeredByClass.get(move.targetClassId) ?? new Set<string>();
    const classified = classifyCompatibility(
      enrolledSubjectIds,
      offeredSubjectIds,
      nameBySubjectId
    );

    return {
      studentId: move.studentId,
      studentName: nameByStudentId.get(move.studentId) ?? "Student",
      targetClassId: move.targetClassId,
      ...classified,
    };
  });

  return {
    status: mergeBatchStatus(students),
    students,
  };
}

export function subjectCompatibilityBlockedMessage(
  result: SubjectCompatibilityBatchResult
): string {
  const blocked = result.students.filter((s) => s.status === "blocked");
  if (blocked.length === 1) {
    return "This class does not offer any of the student's enrolled subjects. Moving this student would leave them without a valid subject pathway.";
  }
  const names = blocked.map((s) => s.studentName).join(", ");
  return `Cannot move ${names}. Their destination class does not offer any of their enrolled subjects.`;
}

export function studentsRequiringCompatibilityAck(
  result: SubjectCompatibilityBatchResult
): Set<string> {
  return new Set(
    result.students
      .filter((s) => s.status === "warning")
      .map((s) => s.studentId)
  );
}

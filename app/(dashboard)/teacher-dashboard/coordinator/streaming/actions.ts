"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import { parseGradebookExamType } from "@/lib/gradebook-major-exams";
import { streamingExamLabel } from "@/lib/student-streaming/exam-labels";
import {
  formatPerformanceValue,
  isDivisionRule,
  isNumericRule,
} from "@/lib/student-streaming/evaluate-rules";
import { loadStreamingHistory } from "@/lib/student-streaming/load-streaming-history.server";
import { loadStreamingWorkspaceData } from "@/lib/student-streaming/load-streaming-page.server";
import { resolveStreamClassesForParent } from "@/lib/student-streaming/resolve-stream-classes.server";
import {
  assertCoordinatorForParentClass,
  getCoordinatorSchoolIdsForUser,
  loadStreamingParentClassesForUser,
  requireStreamingUser,
} from "@/lib/student-streaming/streaming-access.server";
import type {
  StreamingExamOption,
  StreamingHistoryRow,
  StreamingOverviewStats,
  StreamingParentClassOption,
  StreamingPerformanceMeasure,
  StreamingRuleEntry,
  StreamingStreamClass,
  StreamingStudentRow,
} from "@/lib/student-streaming/types";
import type { GradebookMajorExamTypeValue } from "@/lib/gradebook-major-exams";

const STREAMING_PATHS = [
  "/teacher-dashboard/coordinator/streaming",
  "/teacher-dashboard/coordinator/streaming/history",
];

function parseMeasure(raw: string): StreamingPerformanceMeasure | null {
  if (
    raw === "average_score" ||
    raw === "division" ||
    raw === "total_marks"
  ) {
    return raw;
  }
  return null;
}

function parseExamType(raw: string): GradebookMajorExamTypeValue | null {
  return parseGradebookExamType(raw);
}

function validateRules(
  measure: StreamingPerformanceMeasure,
  rules: StreamingRuleEntry[]
): string | null {
  if (rules.length === 0) return null;
  for (const rule of rules) {
    if (!rule.targetClassId?.trim()) {
      return "Each rule must specify a target stream.";
    }
    if (measure === "division") {
      if (!isDivisionRule(rule) || rule.divisions.length === 0) {
        return "Division rules must list at least one division.";
      }
    } else if (!isNumericRule(rule)) {
      return "Score and marks rules must include min and max values.";
    } else if (rule.min > rule.max) {
      return "Rule minimum cannot exceed maximum.";
    }
  }
  return null;
}

export async function loadStreamingParentClassesAction(): Promise<
  | { ok: true; classes: StreamingParentClassOption[]; isCoordinator: boolean }
  | { ok: false; error: string }
> {
  const auth = await requireStreamingUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };
  const schoolIds = await getCoordinatorSchoolIdsForUser(auth.user.id);
  if (schoolIds.length === 0) {
    return { ok: true, classes: [], isCoordinator: false };
  }
  const classes = await loadStreamingParentClassesForUser(auth.user.id);
  return { ok: true, classes, isCoordinator: true };
}

export async function loadStreamingWorkspaceAction(input: {
  parentClassId: string;
  academicYear: string;
  examType: string;
  performanceMeasure: string;
}): Promise<
  | {
      ok: true;
      examOptions: StreamingExamOption[];
      rules: StreamingRuleEntry[];
      stats: StreamingOverviewStats;
      students: StreamingStudentRow[];
      streamClasses: StreamingStreamClass[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireStreamingUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };

  const access = await assertCoordinatorForParentClass(
    auth.user.id,
    input.parentClassId
  );
  if (!access.ok) return { ok: false, error: access.error };

  const measure = parseMeasure(input.performanceMeasure);
  if (!measure) return { ok: false, error: "Invalid performance measure." };

  const examType = input.examType.trim()
    ? parseExamType(input.examType)
    : null;
  if (input.examType.trim() && !examType) {
    return { ok: false, error: "Invalid exam selection." };
  }

  const data = await loadStreamingWorkspaceData({
    parentClassId: input.parentClassId,
    academicYear: input.academicYear.trim(),
    examType,
    performanceMeasure: measure,
  });

  if (!data.ok) return data;
  return {
    ok: true,
    examOptions: data.examOptions,
    rules: data.rules,
    stats: data.stats,
    students: data.students,
    streamClasses: data.streamClasses,
  };
}

export async function saveStreamingRulesAction(input: {
  parentClassId: string;
  academicYear: string;
  examType: string;
  performanceMeasure: string;
  rules: StreamingRuleEntry[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireStreamingUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };

  const access = await assertCoordinatorForParentClass(
    auth.user.id,
    input.parentClassId
  );
  if (!access.ok) return { ok: false, error: access.error };

  const measure = parseMeasure(input.performanceMeasure);
  const examType = parseExamType(input.examType);
  if (!measure || !examType) {
    return { ok: false, error: "Invalid exam or performance measure." };
  }

  const validationError = validateRules(measure, input.rules);
  if (validationError) return { ok: false, error: validationError };

  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, input.parentClassId);

  const { data: existing } = await admin
    .from("streaming_placement_rules")
    .select("id")
    .eq("parent_class_id", cluster.rootClassId)
    .eq("academic_year", input.academicYear.trim())
    .eq("exam_type", examType)
    .eq("performance_measure", measure)
    .maybeSingle();

  const payload = {
    school_id: access.schoolId,
    parent_class_id: cluster.rootClassId,
    academic_year: input.academicYear.trim(),
    exam_type: examType,
    performance_measure: measure,
    rules: input.rules,
    updated_by: auth.user.id,
  };

  if (existing) {
    const { error } = await admin
      .from("streaming_placement_rules")
      .update(payload as never)
      .eq("id", (existing as { id: string }).id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("streaming_placement_rules").insert({
      ...payload,
      created_by: auth.user.id,
    } as never);
    if (error) return { ok: false, error: error.message };
  }

  for (const path of STREAMING_PATHS) revalidatePath(path);
  return { ok: true };
}

export interface StreamingPlacementEntry {
  studentId: string;
  targetClassId: string;
}

export async function applyStudentStreamingAction(input: {
  parentClassId: string;
  academicYear: string;
  examType: string;
  performanceMeasure: string;
  placements: StreamingPlacementEntry[];
}): Promise<
  | { ok: true; placed: number; message: string }
  | { ok: false; error: string }
> {
  const auth = await requireStreamingUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };

  if (input.placements.length === 0) {
    return { ok: false, error: "Select at least one student to place." };
  }

  const access = await assertCoordinatorForParentClass(
    auth.user.id,
    input.parentClassId
  );
  if (!access.ok) return { ok: false, error: access.error };

  const measure = parseMeasure(input.performanceMeasure);
  const examType = parseExamType(input.examType);
  if (!measure || !examType) {
    return { ok: false, error: "Invalid exam or performance measure." };
  }

  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, input.parentClassId);

  const { data: parentRow } = await admin
    .from("classes")
    .select("id, name, school_id")
    .eq("id", cluster.rootClassId)
    .maybeSingle();

  if (!parentRow) {
    return { ok: false, error: "Class not found." };
  }

  const parent = parentRow as { id: string; name: string; school_id: string };
  const streamClasses = await resolveStreamClassesForParent(admin, {
    rootClassId: cluster.rootClassId,
    schoolId: parent.school_id,
    parentName: parent.name,
  });

  if (streamClasses.length === 0) {
    return {
      ok: false,
      error:
        "No stream classes found. Add stream sections (e.g. FORM ONE A, B, C) under Classes.",
    };
  }

  const validStreamIds = new Set(streamClasses.map((s) => s.id));
  const streamNameById = new Map(streamClasses.map((s) => [s.id, s.name]));

  for (const p of input.placements) {
    if (!validStreamIds.has(p.targetClassId)) {
      return { ok: false, error: "Invalid target stream selected." };
    }
  }

  const studentIds = [...new Set(input.placements.map((p) => p.studentId))];
  const { data: studentRows, error: studentErr } = await admin
    .from("students")
    .select("id, full_name, admission_number, class_id")
    .in("id", studentIds)
    .in("class_id", cluster.classIds);

  if (studentErr) return { ok: false, error: studentErr.message };
  const studentsById = new Map(
    ((studentRows ?? []) as {
      id: string;
      full_name: string;
      admission_number: string | null;
      class_id: string;
    }[]).map((s) => [s.id, s])
  );

  for (const p of input.placements) {
    if (!studentsById.has(p.studentId)) {
      return {
        ok: false,
        error: "One or more students are not in this class group.",
      };
    }
  }

  const workspace = await loadStreamingWorkspaceData({
    parentClassId: input.parentClassId,
    academicYear: input.academicYear.trim(),
    examType,
    performanceMeasure: measure,
  });
  if (!workspace.ok) return { ok: false, error: workspace.error };

  const performanceByStudent = new Map(
    workspace.students.map((s) => [s.id, s.performance])
  );
  const classNameById = new Map<string, string>();
  for (const s of workspace.students) {
    classNameById.set(s.currentClassId, s.currentClassName);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  const coordinatorName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    "Coordinator";

  const examLabel = streamingExamLabel(examType);
  let placed = 0;

  for (const entry of input.placements) {
    const student = studentsById.get(entry.studentId)!;
    if (student.class_id === entry.targetClassId) continue;

    const previousClassName =
      classNameById.get(student.class_id) ??
      streamNameById.get(student.class_id) ??
      "—";
    const newClassName = streamNameById.get(entry.targetClassId) ?? "—";
    const performance = performanceByStudent.get(entry.studentId);
    const performanceValue =
      performance != null
        ? (formatPerformanceValue(measure, performance) ?? "—")
        : "—";

    const { error: updateErr } = await admin
      .from("students")
      .update({ class_id: entry.targetClassId } as never)
      .eq("id", entry.studentId)
      .eq("school_id", access.schoolId);

    if (updateErr) return { ok: false, error: updateErr.message };

    const { error: historyErr } = await admin
      .from("student_streaming_history")
      .insert({
        school_id: access.schoolId,
        parent_class_id: cluster.rootClassId,
        student_id: entry.studentId,
        student_name: student.full_name,
        admission_number: student.admission_number,
        previous_class_id: student.class_id,
        previous_class_name: previousClassName,
        new_class_id: entry.targetClassId,
        new_class_name: newClassName,
        performance_measure: measure,
        performance_value: performanceValue,
        exam_type: examType,
        exam_label: examLabel,
        academic_year: input.academicYear.trim(),
        coordinator_id: auth.user.id,
        coordinator_name: coordinatorName,
      } as never);

    if (historyErr) return { ok: false, error: historyErr.message };
    placed += 1;
  }

  for (const path of STREAMING_PATHS) revalidatePath(path);
  revalidatePath("/teacher-dashboard/coordinator");

  return {
    ok: true,
    placed,
    message:
      placed === 1
        ? "1 student placed successfully."
        : `${placed} students placed successfully.`,
  };
}

export async function loadStreamingHistoryAction(input: {
  academicYear?: string;
  parentClassId?: string;
  studentQuery?: string;
  coordinatorQuery?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<
  | {
      ok: true;
      rows: StreamingHistoryRow[];
      parentClasses: StreamingParentClassOption[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireStreamingUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };

  const parentClasses = await loadStreamingParentClassesForUser(auth.user.id);
  const allowedIds = new Set(parentClasses.map((c) => c.id));

  let parentClassIds = parentClasses.map((c) => c.id);
  if (input.parentClassId?.trim()) {
    if (!allowedIds.has(input.parentClassId.trim())) {
      return { ok: false, error: "That class is not eligible for streaming." };
    }
    parentClassIds = [input.parentClassId.trim()];
  }

  const rows = await loadStreamingHistory({
    parentClassIds,
    academicYear: input.academicYear,
    studentQuery: input.studentQuery,
    coordinatorQuery: input.coordinatorQuery,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  return { ok: true, rows, parentClasses };
}

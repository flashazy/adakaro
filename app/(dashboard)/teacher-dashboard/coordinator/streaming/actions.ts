"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import { parseGradebookExamType } from "@/lib/gradebook-major-exams";
import { streamingExamLabel } from "@/lib/student-streaming/exam-labels";
import {
  detectOverlappingDivisionPointsRules,
  filterRulesForDivisionMode,
  formatPerformanceValue,
  isDivisionPointsRule,
  isDivisionRule,
  isNumericRule,
  isPointsBasedDivisionMode,
  recommendStreamClassId,
  resolveDivisionRuleMode,
  serializeStreamingRulesPayload,
  sortStreamClassesByName,
  validateDivisionPointsRule,
} from "@/lib/student-streaming/evaluate-rules";
import type { DivisionRuleMode } from "@/lib/student-streaming/types";
import { normalizeSchoolLevel } from "@/lib/school-level";
import { recordStudentClassMoveIfChanged } from "@/lib/student-class-history/record-student-class-move";
import { enforceSubjectCompatibilityBeforeMove } from "@/lib/student-subject-enrollment/enforce-subject-compatibility";
import { notifyClassTeachersOfStudentMovements } from "@/lib/notifications/notify-class-teachers-of-movements";
import { moveStudentSubjectEnrollment } from "@/lib/student-subject-enrollment/move-student-subject-enrollment";
import type { SubjectCompatibilityBatchResult } from "@/lib/student-subject-enrollment/subject-compatibility-types";
import { SUBJECT_COMPATIBILITY_AUDIT_NOTE } from "@/lib/student-subject-enrollment/subject-compatibility-types";
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
  rules: StreamingRuleEntry[],
  schoolLevel: string | null | undefined,
  options?: {
    requireNonEmpty?: boolean;
    divisionRuleMode?: DivisionRuleMode | null;
  }
): string | null {
  if (rules.length === 0) {
    if (options?.requireNonEmpty) {
      return "Add at least one streaming rule before saving.";
    }
    return null;
  }

  const level = normalizeSchoolLevel(schoolLevel);
  const divisionMode =
    measure === "division"
      ? resolveDivisionRuleMode(options?.divisionRuleMode, rules)
      : null;
  const activeRules =
    measure === "division" && divisionMode
      ? filterRulesForDivisionMode(rules, divisionMode)
      : rules;

  if (
    options?.requireNonEmpty &&
    measure === "division" &&
    activeRules.length === 0
  ) {
    return "Add at least one streaming rule for the selected mode before saving.";
  }
  const hasPointsRules = activeRules.some(isDivisionPointsRule);

  if (hasPointsRules && level !== "secondary") {
    return "Points-based division rules are only available for secondary schools.";
  }

  if (
    measure === "division" &&
    isPointsBasedDivisionMode(divisionMode!) &&
    activeRules.filter(isDivisionPointsRule).length === 0
  ) {
    return "Add at least one points rule for this mode.";
  }

  for (const rule of activeRules) {
    if (!rule.targetClassId?.trim()) {
      return "Each rule must specify a target stream.";
    }
    if (measure === "division") {
      if (isDivisionPointsRule(rule)) {
        if (level !== "secondary") {
          return "Points-based division rules are only available for secondary schools.";
        }
        const pointsError = validateDivisionPointsRule(rule);
        if (pointsError) return pointsError;
      } else if (isDivisionRule(rule)) {
        if (rule.divisions.length === 0) {
          return "Division rules must list at least one division.";
        }
      } else {
        return "Invalid division rule format.";
      }
    } else if (!isNumericRule(rule)) {
      return "Score and marks rules must include min and max values.";
    } else if (rule.min > rule.max) {
      return "Rule minimum cannot exceed maximum.";
    }
  }

  if (measure === "division" && hasPointsRules) {
    const overlap = detectOverlappingDivisionPointsRules(activeRules);
    if (overlap) return overlap;
  }

  return null;
}

function normalizeRulesForPersistence(
  measure: StreamingPerformanceMeasure,
  rules: StreamingRuleEntry[],
  divisionRuleMode: DivisionRuleMode | null
): StreamingRuleEntry[] {
  if (measure !== "division") return rules;
  const mode = resolveDivisionRuleMode(divisionRuleMode, rules);
  const active = filterRulesForDivisionMode(rules, mode);
  return active.map((rule) => {
    if (isDivisionRule(rule)) {
      return { ...rule, mode: "division_only" as const };
    }
    if (isDivisionPointsRule(rule)) {
      const ruleMode: DivisionRuleMode =
        rule.mode === "custom_points" ? "custom_points" : "necta_points";
      return { ...rule, mode: ruleMode };
    }
    return rule;
  });
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
      schoolLevel: string | null;
      divisionRuleMode: DivisionRuleMode | null;
    }
  | { ok: false; error: string }
> {
  noStore();
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
    schoolLevel: data.schoolLevel,
    divisionRuleMode: data.divisionRuleMode,
  };
}

export async function saveStreamingRulesAction(input: {
  parentClassId: string;
  academicYear: string;
  examType: string;
  performanceMeasure: string;
  rules: StreamingRuleEntry[];
  divisionRuleMode?: DivisionRuleMode | null;
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

  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, input.parentClassId);

  const { data: schoolRow } = await admin
    .from("schools")
    .select("school_level")
    .eq("id", access.schoolId)
    .maybeSingle();

  const schoolLevel =
    (schoolRow as { school_level?: string | null } | null)?.school_level ??
    null;

  const divisionRuleMode =
    measure === "division"
      ? resolveDivisionRuleMode(input.divisionRuleMode, input.rules)
      : null;

  const validationError = validateRules(measure, input.rules, schoolLevel, {
    requireNonEmpty: true,
    divisionRuleMode,
  });
  if (validationError) return { ok: false, error: validationError };

  const rulesToSave = normalizeRulesForPersistence(
    measure,
    input.rules,
    divisionRuleMode
  );
  const rulesPayload = serializeStreamingRulesPayload(
    rulesToSave,
    measure,
    divisionRuleMode
  );

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
    rules: rulesPayload,
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
  acknowledgeSubjectCompatibilityWarning?: boolean;
}): Promise<
  | { ok: true; placed: number; message: string; warning?: string }
  | {
      ok: false;
      requiresSubjectCompatibilityAck: true;
      compatibility: SubjectCompatibilityBatchResult;
    }
  | { ok: false; error: string }
> {
  noStore();
  const auth = await requireStreamingUser();
  if (!auth.user) return { ok: false, error: auth.error ?? "Unauthorized." };

  if (input.placements.length === 0) {
    return { ok: false, error: "Select at least one student to place." };
  }

  const PLACEMENT_SAVE_FAILED =
    "Placement was not saved. Please try again.";

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
  const streamClasses = sortStreamClassesByName(
    await resolveStreamClassesForParent(admin, {
      rootClassId: cluster.rootClassId,
      schoolId: parent.school_id,
      parentName: parent.name,
    })
  );

  if (streamClasses.length === 0) {
    return {
      ok: false,
      error:
        "No stream classes found for this level. Please create streams/classes first.",
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
    .select("id, full_name, admission_number, class_id, school_id")
    .in("id", studentIds)
    .in("class_id", cluster.classIds);

  if (studentErr) return { ok: false, error: studentErr.message };
  const studentsById = new Map(
    ((studentRows ?? []) as {
      id: string;
      full_name: string;
      admission_number: string | null;
      class_id: string;
      school_id: string;
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
  const recommendedByStudent = new Map(
    workspace.students.map((s) => {
      const recommendedClassId =
        workspace.rules.length > 0
          ? recommendStreamClassId(
              measure,
              s.performance,
              workspace.rules,
              workspace.divisionRuleMode
            )
          : s.recommendedClassId;
      return [s.id, recommendedClassId] as const;
    })
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
  let skippedAlreadyPlaced = 0;
  const historyWarnings: string[] = [];

  const compatibilityMoves = input.placements
    .filter((entry) => {
      const student = studentsById.get(entry.studentId);
      return student && student.class_id !== entry.targetClassId;
    })
    .map((entry) => ({
      studentId: entry.studentId,
      targetClassId: entry.targetClassId,
    }));

  const compatibilityGate = await enforceSubjectCompatibilityBeforeMove(
    admin,
    compatibilityMoves,
    Boolean(input.acknowledgeSubjectCompatibilityWarning)
  );

  if (!compatibilityGate.ok) {
    if (compatibilityGate.blocked) {
      return { ok: false, error: compatibilityGate.error };
    }
    return {
      ok: false,
      requiresSubjectCompatibilityAck: true,
      compatibility: compatibilityGate.result,
    };
  }

  const compatibilityAckStudentIds = compatibilityGate.ackStudentIds;
  const movementNotificationEntries: {
    schoolId: string;
    studentId: string;
    studentName: string;
    fromClassId: string;
    toClassId: string;
    source: "streaming";
  }[] = [];

  for (const entry of input.placements) {
    const student = studentsById.get(entry.studentId)!;
    if (student.class_id === entry.targetClassId) {
      skippedAlreadyPlaced += 1;
      continue;
    }

    const previousClassId = student.class_id;
    const previousClassName =
      classNameById.get(previousClassId) ??
      streamNameById.get(previousClassId) ??
      "—";
    const newClassName = streamNameById.get(entry.targetClassId) ?? "—";
    const performance = performanceByStudent.get(entry.studentId);
    const performanceValue =
      performance != null
        ? (formatPerformanceValue(
            measure,
            performance,
            workspace.divisionRuleMode
          ) ?? "—")
        : "—";
    const recommendedClassId = recommendedByStudent.get(entry.studentId) ?? null;
    const recommendedClassName = recommendedClassId
      ? (streamNameById.get(recommendedClassId) ?? null)
      : null;
    const isManualChange =
      recommendedClassId != null
        ? entry.targetClassId !== recommendedClassId
        : (performance?.subjectsScored ?? 0) === 0;

    const { data: updatedRow, error: updateErr } = await admin
      .from("students")
      .update({ class_id: entry.targetClassId } as never)
      .eq("id", entry.studentId)
      .eq("school_id", student.school_id)
      .select("id, class_id")
      .maybeSingle();

    if (updateErr) {
      return { ok: false, error: PLACEMENT_SAVE_FAILED };
    }

    if (
      !updatedRow ||
      (updatedRow as { class_id: string }).class_id !== entry.targetClassId
    ) {
      return { ok: false, error: PLACEMENT_SAVE_FAILED };
    }

    const { data: verifiedRow, error: verifyErr } = await admin
      .from("students")
      .select("id, class_id, school_id")
      .eq("id", entry.studentId)
      .maybeSingle();

    if (verifyErr) {
      return { ok: false, error: PLACEMENT_SAVE_FAILED };
    }

    const verified = verifiedRow as
      | { id: string; class_id: string; school_id: string }
      | null;

    if (
      !verified ||
      verified.class_id !== entry.targetClassId ||
      verified.school_id !== student.school_id
    ) {
      return { ok: false, error: PLACEMENT_SAVE_FAILED };
    }

    const { data: streamingHistoryRow, error: historyErr } = await admin
      .from("student_streaming_history")
      .insert({
        school_id: student.school_id,
        parent_class_id: cluster.rootClassId,
        student_id: entry.studentId,
        student_name: student.full_name,
        admission_number: student.admission_number,
        previous_class_id: previousClassId,
        previous_class_name: previousClassName,
        new_class_id: entry.targetClassId,
        new_class_name: newClassName,
        recommended_class_id: recommendedClassId,
        recommended_class_name: recommendedClassName,
        placement_target_class_id: entry.targetClassId,
        placement_target_class_name: newClassName,
        is_manual_change: isManualChange,
        performance_measure: measure,
        performance_value: performanceValue,
        exam_type: examType,
        exam_label: examLabel,
        academic_year: input.academicYear.trim(),
        coordinator_id: auth.user.id,
        coordinator_name: coordinatorName,
      } as never)
      .select("id")
      .maybeSingle();

    if (historyErr) {
      console.error(
        "[streaming] Placement saved but history insert failed:",
        historyErr.message,
        {
          studentId: entry.studentId,
          targetClassId: entry.targetClassId,
        }
      );
      historyWarnings.push(student.full_name);
    }

    const classHistoryResult = await recordStudentClassMoveIfChanged(admin, {
      schoolId: student.school_id,
      studentId: entry.studentId,
      fromClassId: previousClassId,
      toClassId: entry.targetClassId,
      source: "streaming",
      sourceId: (streamingHistoryRow as { id: string } | null)?.id ?? null,
      actorId: auth.user.id,
      academicYear: input.academicYear.trim(),
      effectiveAt: new Date().toISOString(),
      notes: compatibilityAckStudentIds.has(entry.studentId)
        ? SUBJECT_COMPATIBILITY_AUDIT_NOTE
        : null,
    });

    if (classHistoryResult.error) {
      console.error(
        "[streaming] Placement saved but student_class_history insert failed:",
        classHistoryResult.error,
        {
          studentId: entry.studentId,
          targetClassId: entry.targetClassId,
        }
      );
      if (!historyWarnings.includes(student.full_name)) {
        historyWarnings.push(student.full_name);
      }
    }

    const enrollmentMove = await moveStudentSubjectEnrollment(admin, {
      schoolId: student.school_id,
      studentId: entry.studentId,
      fromClassId: previousClassId,
      toClassId: entry.targetClassId,
    });

    if (enrollmentMove.error) {
      console.error(
        "[streaming] Placement saved but subject enrollment migration failed:",
        enrollmentMove.error,
        {
          studentId: entry.studentId,
          fromClassId: previousClassId,
          toClassId: entry.targetClassId,
        }
      );
    } else if (enrollmentMove.warning) {
      console.warn(
        "[streaming] Subject enrollment migration warning:",
        enrollmentMove.warning,
        {
          studentId: entry.studentId,
          fromClassId: previousClassId,
          toClassId: entry.targetClassId,
          skipped: enrollmentMove.skipped,
        }
      );
    }

    student.class_id = entry.targetClassId;
    placed += 1;

    if (classHistoryResult.recorded) {
      movementNotificationEntries.push({
        schoolId: student.school_id,
        studentId: entry.studentId,
        studentName: (student.full_name ?? "").trim() || "Student",
        fromClassId: previousClassId,
        toClassId: entry.targetClassId,
        source: "streaming",
      });
    }
  }

  if (movementNotificationEntries.length > 0) {
    await notifyClassTeachersOfStudentMovements(movementNotificationEntries);
  }

  if (placed === 0) {
    if (skippedAlreadyPlaced > 0) {
      return {
        ok: false,
        error:
          "No placements were saved. The selected students are already in their target streams.",
      };
    }
    return {
      ok: false,
      error: "No placements were saved. Refresh the page and try again.",
    };
  }

  for (const path of STREAMING_PATHS) revalidatePath(path);
  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/dashboard/students");

  const warning =
    historyWarnings.length > 0
      ? `${placed} student${placed === 1 ? "" : "s"} placed, but history could not be recorded for: ${historyWarnings.join(", ")}.`
      : undefined;

  return {
    ok: true,
    placed,
    message: placed === 1 ? "Placement saved" : `${placed} placements saved`,
    warning,
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

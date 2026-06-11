import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";
import {
  computeStudentExamPerformanceBatch,
  loadExamsWithResultsForCluster,
} from "@/lib/student-streaming/compute-performance";
import { streamingExamLabel } from "@/lib/student-streaming/exam-labels";
import {
  formatPerformanceValue,
  parseStreamingRulesPayload,
  recommendStreamClassId,
  resolveDivisionRuleMode,
  sortStreamClassesByName,
} from "@/lib/student-streaming/evaluate-rules";
import type {
  DivisionRuleMode,
  StreamingExamOption,
  StreamingOverviewStats,
  StreamingRuleEntry,
  StreamingStreamClass,
  StreamingStudentRow,
} from "@/lib/student-streaming/types";
import {
  GRADEBOOK_MAJOR_EXAM_TYPE_VALUES,
  type GradebookMajorExamTypeValue,
} from "@/lib/gradebook-major-exams";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { resolveStreamClassesForParent } from "@/lib/student-streaming/resolve-stream-classes.server";

export async function loadStreamingWorkspaceData(params: {
  parentClassId: string;
  academicYear: string;
  examType: GradebookMajorExamTypeValue | null;
  performanceMeasure: "average_score" | "division" | "total_marks";
}): Promise<
  | {
      ok: true;
      examOptions: StreamingExamOption[];
      rules: StreamingRuleEntry[];
      divisionRuleMode: DivisionRuleMode | null;
      stats: StreamingOverviewStats;
      students: StreamingStudentRow[];
      streamClasses: StreamingStreamClass[];
      schoolLevel: string | null;
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, params.parentClassId);

  const { data: parentRow } = await admin
    .from("classes")
    .select("id, name, school_id")
    .eq("id", cluster.rootClassId)
    .maybeSingle();

  if (!parentRow) return { ok: false, error: "Class not found." };

  const parent = parentRow as { id: string; name: string; school_id: string };
  const schoolId = parent.school_id;

  const { data: schoolRow } = await admin
    .from("schools")
    .select("school_level")
    .eq("id", schoolId)
    .maybeSingle();

  const schoolLevel =
    (schoolRow as { school_level?: string | null } | null)?.school_level ??
    null;

  const { data: clusterClassRows } = await admin
    .from("classes")
    .select("id, name")
    .in("id", cluster.classIds);

  const classNameById = new Map(
    ((clusterClassRows ?? []) as { id: string; name: string }[]).map((c) => [
      c.id,
      c.name,
    ])
  );

  const streamClasses = sortStreamClassesByName(
    await resolveStreamClassesForParent(admin, {
      rootClassId: cluster.rootClassId,
      schoolId,
      parentName: parent.name,
    })
  );

  const streamNameById = new Map(streamClasses.map((s) => [s.id, s.name]));
  const streamIdSet = new Set(streamClasses.map((s) => s.id));
  const parentClassName = parent.name;

  const studentRows = await fetchAllRows<{
    id: string;
    full_name: string;
    admission_number: string | null;
    class_id: string;
  }>({
    label: "student-streaming: students in cluster",
    fetchPage: async (from, to) =>
      await admin
        .from("students")
        .select("id, full_name, admission_number, class_id")
        .in("class_id", cluster.classIds)
        .order("full_name", { ascending: true })
        .range(from, to),
  });

  const studentIds = studentRows.map((s) => s.id);
  const examsWithResults = await loadExamsWithResultsForCluster(admin, {
    classIds: cluster.classIds,
    academicYear: params.academicYear,
    studentIds,
  });

  const performanceByStudent = params.examType
    ? await computeStudentExamPerformanceBatch(admin, {
        classIds: cluster.classIds,
        academicYear: params.academicYear,
        examType: params.examType,
        studentIds,
        schoolLevel,
      })
    : new Map();

  const examOptions: StreamingExamOption[] = await Promise.all(
    GRADEBOOK_MAJOR_EXAM_TYPE_VALUES.filter((t) =>
      examsWithResults.has(t)
    ).map(async (examType) => {
      let studentsWithResults = 0;
      if (examType === params.examType) {
        for (const perf of performanceByStudent.values()) {
          if (perf.subjectsScored > 0) studentsWithResults += 1;
        }
      } else {
        const perfMap = await computeStudentExamPerformanceBatch(admin, {
          classIds: cluster.classIds,
          academicYear: params.academicYear,
          examType,
          studentIds,
          schoolLevel,
        });
        for (const perf of perfMap.values()) {
          if (perf.subjectsScored > 0) studentsWithResults += 1;
        }
      }
      return {
        examType,
        label: streamingExamLabel(examType),
        studentsWithResults,
      };
    })
  );

  const { data: rulesRow } = params.examType
    ? await admin
        .from("streaming_placement_rules")
        .select("rules")
        .eq("parent_class_id", cluster.rootClassId)
        .eq("academic_year", params.academicYear)
        .eq("exam_type", params.examType)
        .eq("performance_measure", params.performanceMeasure)
        .maybeSingle()
    : { data: null };

  const parsedRules = parseStreamingRulesPayload(
    (rulesRow as { rules?: unknown } | null)?.rules
  );
  const rules = parsedRules.rules;
  const divisionRuleMode =
    params.performanceMeasure === "division"
      ? resolveDivisionRuleMode(
          parsedRules.divisionRuleMode,
          parsedRules.rules
        )
      : null;

  const { data: lastHistoryRow } = await admin
    .from("student_streaming_history")
    .select("created_at")
    .eq("parent_class_id", cluster.rootClassId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const appliedPlacementByStudentId = new Map<string, string>();
  const examType = params.examType;
  if (examType && studentIds.length > 0) {
    const historyRows = await fetchAllRows<{
      student_id: string;
      new_class_id: string;
      placement_target_class_id: string | null;
      created_at: string;
    }>({
      label: "student-streaming: applied placements",
      fetchPage: async (from, to) =>
        await admin
          .from("student_streaming_history")
          .select(
            "student_id, new_class_id, placement_target_class_id, created_at"
          )
          .eq("parent_class_id", cluster.rootClassId)
          .eq("academic_year", params.academicYear)
          .eq("exam_type", examType)
          .eq("performance_measure", params.performanceMeasure)
          .in("student_id", studentIds)
          .order("created_at", { ascending: false })
          .range(from, to),
    });

    for (const row of historyRows) {
      if (appliedPlacementByStudentId.has(row.student_id)) continue;
      appliedPlacementByStudentId.set(
        row.student_id,
        row.placement_target_class_id ?? row.new_class_id
      );
    }
  }

  const students: StreamingStudentRow[] = studentRows.map((s) => {
    const performance =
      performanceByStudent.get(s.id) ?? {
        averageScorePercent: null,
        totalMarks: null,
        division: null,
        divisionPoints: null,
        subjectsScored: 0,
      };
    const recommendedClassId = recommendStreamClassId(
      params.performanceMeasure,
      performance,
      rules,
      divisionRuleMode
    );
    const latestAppliedTarget = appliedPlacementByStudentId.get(s.id) ?? null;
    const appliedPlacementClassId =
      latestAppliedTarget && latestAppliedTarget === s.class_id
        ? latestAppliedTarget
        : null;
    const currentStreamName =
      s.class_id === cluster.rootClassId
        ? "Unassigned"
        : streamIdSet.has(s.class_id)
          ? (streamNameById.get(s.class_id) ?? "Unassigned")
          : (classNameById.get(s.class_id) ?? "Unassigned");
    return {
      id: s.id,
      fullName: s.full_name,
      admissionNumber: s.admission_number,
      currentClassId: s.class_id,
      currentClassName: currentStreamName,
      parentClassName,
      currentStreamName,
      performance,
      recommendedClassId,
      recommendedClassName: recommendedClassId
        ? (streamNameById.get(recommendedClassId) ?? null)
        : null,
      appliedPlacementClassId,
      performanceDisplay: formatPerformanceValue(
        params.performanceMeasure,
        performance,
        divisionRuleMode
      ),
    };
  });

  let totalEligible = 0;
  let alreadyStreamed = 0;
  let awaitingPlacement = 0;

  for (const s of students) {
    if (s.performance.subjectsScored === 0) continue;
    totalEligible += 1;
    if (s.recommendedClassId && s.currentClassId === s.recommendedClassId) {
      alreadyStreamed += 1;
    } else if (s.recommendedClassId) {
      awaitingPlacement += 1;
    } else {
      awaitingPlacement += 1;
    }
  }

  return {
    ok: true,
    examOptions,
    rules,
    divisionRuleMode,
    stats: {
      totalEligible,
      alreadyStreamed,
      awaitingPlacement,
      availableStreams: streamClasses.length,
      lastStreamingActivityAt:
        (lastHistoryRow as { created_at?: string } | null)?.created_at ?? null,
    },
    students,
    streamClasses,
    schoolLevel,
  };
}

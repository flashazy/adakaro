import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  StreamingHistoryRow,
  StreamingPerformanceMeasure,
} from "@/lib/student-streaming/types";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export async function loadStreamingHistory(params: {
  parentClassIds: string[];
  academicYear?: string;
  studentQuery?: string;
  coordinatorQuery?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<StreamingHistoryRow[]> {
  const admin = createAdminClient();
  if (params.parentClassIds.length === 0) return [];

  let query = admin
    .from("student_streaming_history")
    .select(
      "id, student_name, admission_number, previous_class_name, new_class_name, recommended_class_name, is_manual_change, performance_measure, performance_value, exam_label, academic_year, coordinator_name, created_at, parent_class_id"
    )
    .in("parent_class_id", params.parentClassIds)
    .order("created_at", { ascending: false });

  if (params.academicYear?.trim()) {
    query = query.eq("academic_year", params.academicYear.trim());
  }
  if (params.dateFrom?.trim()) {
    query = query.gte("created_at", `${params.dateFrom.trim()}T00:00:00.000Z`);
  }
  if (params.dateTo?.trim()) {
    query = query.lte("created_at", `${params.dateTo.trim()}T23:59:59.999Z`);
  }

  const rows = await fetchAllRows<{
    id: string;
    student_name: string;
    admission_number: string | null;
    previous_class_name: string;
    new_class_name: string;
    recommended_class_name: string | null;
    is_manual_change: boolean;
    performance_measure: string;
    performance_value: string;
    exam_label: string;
    academic_year: string;
    coordinator_name: string;
    created_at: string;
    parent_class_id: string;
  }>({
    label: "student-streaming: history",
    fetchPage: async (from, to) => await query.range(from, to),
  });

  const parentIds = [...new Set(rows.map((r) => r.parent_class_id))];
  const { data: parentRows } = await admin
    .from("classes")
    .select("id, name")
    .in("id", parentIds);
  const parentNameById = new Map(
    ((parentRows ?? []) as { id: string; name: string }[]).map((p) => [
      p.id,
      p.name,
    ])
  );

  const studentQ = params.studentQuery?.trim().toLowerCase() ?? "";
  const coordinatorQ = params.coordinatorQuery?.trim().toLowerCase() ?? "";

  return rows
    .filter((r) => {
      if (studentQ) {
        const hay = `${r.student_name} ${r.admission_number ?? ""}`.toLowerCase();
        if (!hay.includes(studentQ)) return false;
      }
      if (coordinatorQ && !r.coordinator_name.toLowerCase().includes(coordinatorQ)) {
        return false;
      }
      return true;
    })
    .map((r) => ({
      id: r.id,
      studentName: r.student_name,
      admissionNumber: r.admission_number,
      previousClassName: r.previous_class_name,
      newClassName: r.new_class_name,
      recommendedClassName: r.recommended_class_name,
      isManualChange: r.is_manual_change,
      performanceMeasure: r.performance_measure as StreamingPerformanceMeasure,
      performanceValue: r.performance_value,
      examLabel: r.exam_label,
      academicYear: r.academic_year,
      coordinatorName: r.coordinator_name,
      createdAt: r.created_at,
      parentClassName: parentNameById.get(r.parent_class_id) ?? "—",
    }));
}

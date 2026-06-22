import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { CopilotSnapshot } from "./types";
import { followUpActionsForTool } from "./follow-ups";

function formatTzs(amount: number): string {
  return `TSh ${amount.toLocaleString("en-US")}`;
}

export async function loadCopilotSnapshot(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  schoolName: string
): Promise<CopilotSnapshot> {
  const [studentsRes, attendanceRes, syllabusRes] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("approval_status", "approved"),
    supabase
      .from("class_attendance")
      .select("status")
      .eq("school_id", schoolId)
      .order("attendance_date", { ascending: false })
      .limit(200),
    supabase
      .from("syllabus_subtopic_progress")
      .select("status")
      .eq("school_id", schoolId)
      .limit(300),
  ]);

  const studentCount = studentsRes.count ?? 0;
  const attRows = (attendanceRes.data ?? []) as Array<{ status: string }>;
  const present = attRows.filter(
    (r) => r.status === "present" || r.status === "late"
  ).length;
  const attendanceRate =
    attRows.length > 0 ? Math.round((present / attRows.length) * 100) : 0;

  const syllabusRows = (syllabusRes.data ?? []) as Array<{ status: string }>;
  const syllabusAlerts = syllabusRows.filter(
    (r) => r.status === "not_started"
  ).length;

  let outstandingFees = 0;
  const { data: studentSample } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("approval_status", "approved")
    .limit(40);

  for (const row of studentSample ?? []) {
    const { data: payments } = await supabase.rpc("get_student_payments", {
      p_student_id: (row as { id: string }).id,
    } as never);
    for (const p of (payments ?? []) as Array<{ balance?: number }>) {
      outstandingFees += Number(p.balance ?? 0);
    }
  }

  const actions = followUpActionsForTool("school_performance_summary", "");

  return {
    schoolName,
    studentCount,
    attendanceRate,
    outstandingFees,
    syllabusAlerts: Math.min(syllabusAlerts, 99),
    actions: [
      { id: "review-fees", label: "Review Fees", prompt: "Show students with fee balances." },
      { id: "review-coverage", label: "Review Coverage", prompt: "Which classes are behind syllabus coverage?" },
      { id: "generate-report", label: "Generate Report", prompt: "Generate management report." },
    ],
  };
}

export function formatSnapshotFees(amount: number): string {
  return formatTzs(amount);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { CopilotContext, ToolResult } from "@/lib/ai/types";
import { canUseTool } from "@/lib/ai/permissions";
import {
  buildPriorContext,
  parseConversationFilters,
} from "@/lib/ai/copilot/context-filters";
import { detectCopilotIntent } from "@/lib/ai/copilot/intent";
import type { ConversationFilters } from "@/lib/ai/copilot/types";

function formatTzs(amount: number): string {
  return `TSh ${amount.toLocaleString("en-US")}`;
}

function matchesClassFilter(className: string, filter?: string): boolean {
  if (!filter) return true;
  return className.toLowerCase().includes(filter.toLowerCase());
}

async function feeBalancesSummary(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  filters: ConversationFilters
): Promise<ToolResult> {
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class:classes(name)")
    .eq("school_id", schoolId)
    .eq("approval_status", "approved")
    .limit(500);

  let rows = (students ?? []) as Array<{
    id: string;
    full_name: string;
    class: { name: string } | null;
  }>;

  const classNeedle = filters.gradeFilter
    ? `grade ${filters.gradeFilter}`
    : filters.classFilter;
  if (classNeedle) {
    rows = rows.filter((r) =>
      matchesClassFilter(r.class?.name ?? "", classNeedle)
    );
  }

  let totalOutstanding = 0;
  let studentsWithBalance = 0;
  const debtors: Array<{ name: string; className: string; balance: number }> =
    [];

  for (const student of rows.slice(0, 120)) {
    const { data: payments } = await supabase.rpc("get_student_payments", {
      p_student_id: student.id,
    } as never);

    const balance = ((payments ?? []) as Array<{ balance?: number }>).reduce(
      (sum, p) => sum + Number(p.balance ?? 0),
      0
    );

    if (balance > 0) {
      studentsWithBalance += 1;
      totalOutstanding += balance;
      debtors.push({
        name: student.full_name,
        className: student.class?.name ?? "—",
        balance,
      });
    }
  }

  debtors.sort((a, b) => b.balance - a.balance);
  const limit = filters.limit ?? (filters.sortByBalance ? 10 : 8);
  const top = debtors.slice(0, limit);

  return {
    tool: filters.sortByBalance ? "top_debtors" : "fee_balances_summary",
    summary: `Found ${studentsWithBalance} students with outstanding balances totaling ${formatTzs(totalOutstanding)}.`,
    data: {
      totalOutstanding,
      studentsWithBalance,
      checked: Math.min(rows.length, 120),
      debtors: top,
    },
  };
}

async function attendanceOverview(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  classFilter?: string
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from("class_attendance")
    .select("id, status, attendance_date, students(full_name), classes(name)")
    .eq("school_id", schoolId)
    .order("attendance_date", { ascending: false })
    .limit(500);

  if (error) {
    return {
      tool: "attendance_overview",
      summary:
        "I could not load attendance data right now. Please try again from the Attendance page.",
    };
  }

  let rows = (data ?? []) as Array<{
    status: string;
    classes: { name: string } | null;
    students: { full_name: string } | null;
  }>;

  if (classFilter) {
    rows = rows.filter((r) =>
      matchesClassFilter(r.classes?.name ?? "", classFilter)
    );
  }

  const present = rows.filter(
    (r) => r.status === "present" || r.status === "late"
  ).length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const total = rows.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    tool: "attendance_overview",
    summary: `Attendance rate is ${rate}% across ${total} recent records.`,
    data: { rate, present, absent, total },
  };
}

async function absentStudents(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  classFilter?: string
): Promise<ToolResult> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("class_attendance")
    .select("status, students(full_name), classes(name)")
    .eq("school_id", schoolId)
    .eq("status", "absent")
    .gte("attendance_date", today)
    .limit(100);

  let rows = (data ?? []) as Array<{
    students: { full_name: string } | null;
    classes: { name: string } | null;
  }>;

  if (classFilter) {
    rows = rows.filter((r) =>
      matchesClassFilter(r.classes?.name ?? "", classFilter)
    );
  }

  const names = [
    ...new Set(rows.map((r) => r.students?.full_name).filter(Boolean)),
  ] as string[];

  return {
    tool: "absent_students",
    summary:
      names.length > 0
        ? `${names.length} students absent in recent records.`
        : "No absent students found in recent attendance records.",
    data: {
      rate: 0,
      present: 0,
      absent: names.length,
      total: names.length,
      absentStudents: names.slice(0, 15),
    },
  };
}

async function reportCardCompletion(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from("report_cards")
    .select("id, status, is_complete")
    .eq("school_id", schoolId)
    .limit(500);

  if (error) {
    return {
      tool: "report_card_completion",
      summary:
        "I could not load report card data. Check the Report Cards section in your dashboard.",
    };
  }

  const rows = (data ?? []) as Array<{ is_complete: boolean }>;
  const total = rows.length;
  const complete = rows.filter((r) => r.is_complete).length;

  return {
    tool: "report_card_completion",
    summary: `${complete} of ${total} report cards are complete.`,
    data: { total, complete },
  };
}

async function syllabusCoverageSummary(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from("syllabus_subtopic_progress")
    .select("id, status")
    .eq("school_id", schoolId)
    .limit(500);

  if (error) {
    return {
      tool: "syllabus_coverage_summary",
      summary:
        "Syllabus coverage data is not available. Open Syllabus Coverage in the dashboard for details.",
    };
  }

  const rows = (data ?? []) as Array<{ status: string }>;
  if (rows.length === 0) {
    return {
      tool: "syllabus_coverage_summary",
      summary:
        "No syllabus progress tracked yet. Set up syllabus topics to start tracking coverage.",
      data: { pct: 0, atRisk: 0, behindClasses: [] },
    };
  }

  const completed = rows.filter((r) => r.status === "completed").length;
  const pct = Math.round((completed / rows.length) * 100);
  const atRisk = rows.filter((r) => r.status === "not_started").length;
  const behindClasses =
    atRisk > 0 ? [`${Math.min(atRisk, 5)} areas behind target`] : [];

  return {
    tool: "syllabus_coverage_summary",
    summary: `Syllabus coverage is at ${pct}% with ${behindClasses.length} classes behind.`,
    data: { pct, atRisk, behindClasses },
  };
}

async function studentCount(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<ToolResult> {
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("approval_status", "approved");

  return {
    tool: "student_count",
    summary: `The school has ${count ?? 0} approved students.`,
    data: { total: count ?? 0, admissionsThisMonth: 0 },
  };
}

async function admissionsSummary(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<ToolResult> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ count: total }, { count: admissions }] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("approval_status", "approved"),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("created_at", monthStart.toISOString()),
  ]);

  return {
    tool: "admissions_summary",
    summary: `${admissions ?? 0} new admissions this month out of ${total ?? 0} total students.`,
    data: {
      total: total ?? 0,
      admissionsThisMonth: admissions ?? 0,
    },
  };
}

async function composeReport(
  supabase: SupabaseClient<Database>,
  ctx: CopilotContext,
  reportTool: string,
  filters: ConversationFilters,
  classFilter?: string
): Promise<ToolResult> {
  const sections: ToolResult[] = [];
  const tools =
    reportTool === "finance_report"
      ? ["fee_balances_summary"]
      : reportTool === "attendance_report"
        ? ["attendance_overview", "absent_students"]
        : reportTool === "academic_report"
          ? ["syllabus_coverage_summary", "report_card_completion"]
          : [
              "fee_balances_summary",
              "attendance_overview",
              "syllabus_coverage_summary",
              "report_card_completion",
            ];

  for (const tool of tools) {
    if (!canUseTool(ctx, tool)) continue;
    const result = await runTool(
      supabase,
      ctx,
      tool,
      classFilter,
      filters
    );
    if (result) sections.push(result);
  }

  return {
    tool: reportTool,
    summary: sections.map((s) => s.summary).join("\n\n"),
    data: sections.reduce(
      (acc, s) => ({ ...acc, ...(s.data ?? {}) }),
      {} as Record<string, unknown>
    ),
  };
}

export async function executeCopilotTools(
  supabase: SupabaseClient<Database>,
  ctx: CopilotContext,
  userMessage: string,
  history: Array<{ role: string; content: string }>
): Promise<ToolResult | null> {
  if (!ctx.schoolId) {
    return {
      tool: "none",
      summary:
        "I need an active school workspace to access operational data. Please ensure you are signed in to a school.",
    };
  }

  const priorContext = buildPriorContext(history);
  const filters = parseConversationFilters(userMessage, priorContext);
  const intent = detectCopilotIntent(userMessage, priorContext, filters);
  if (!intent) return null;

  const reportTools = [
    "finance_report",
    "attendance_report",
    "academic_report",
    "management_report",
    "school_performance_summary",
  ];

  if (reportTools.includes(intent.tool)) {
    const mappedTool =
      intent.tool === "school_performance_summary"
        ? "management_report"
        : intent.tool;
    if (!canUseTool(ctx, "attendance_overview") && !canUseTool(ctx, "fee_balances_summary")) {
      return {
        tool: intent.tool,
        summary: `Your role (${ctx.role}) does not have access to generate this report.`,
      };
    }
    return composeReport(
      supabase,
      ctx,
      mappedTool,
      filters,
      intent.classFilter
    );
  }

  if (!canUseTool(ctx, intent.tool)) {
    return {
      tool: intent.tool,
      summary: `Your role (${ctx.role}) does not have access to that data. Contact a school admin for help.`,
    };
  }

  return runTool(
    supabase,
    ctx,
    intent.tool,
    intent.classFilter,
    filters
  );
}

async function runTool(
  supabase: SupabaseClient<Database>,
  ctx: CopilotContext,
  tool: string,
  classFilter?: string,
  filters: ConversationFilters = {}
): Promise<ToolResult | null> {
  const schoolId = ctx.schoolId!;
  switch (tool) {
    case "fee_balances_summary":
    case "top_debtors":
    case "collection_performance":
      return feeBalancesSummary(supabase, schoolId, filters);
    case "attendance_overview":
      return attendanceOverview(supabase, schoolId, classFilter);
    case "absent_students":
      return absentStudents(supabase, schoolId, classFilter);
    case "report_card_completion":
      return reportCardCompletion(supabase, schoolId);
    case "syllabus_coverage_summary":
      return syllabusCoverageSummary(supabase, schoolId);
    case "student_count":
      return studentCount(supabase, schoolId);
    case "admissions_summary":
      return admissionsSummary(supabase, schoolId);
    default:
      return null;
  }
}

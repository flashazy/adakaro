import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { CopilotContext, ToolResult } from "@/lib/ai/types";
import { canUseTool } from "@/lib/ai/permissions";
import { permissionDeniedMessage } from "@/lib/ai/copilot/permissions";
import {
  buildPriorContext,
  parseConversationFilters,
} from "@/lib/ai/copilot/context-filters";
import { detectCopilotIntent, type DetectedIntent } from "@/lib/ai/copilot/intent";
import { moduleForTool } from "@/lib/ai/dashboard-context";
import type { ConversationFilters } from "@/lib/ai/copilot/types";
import { logCopilotEvent } from "@/lib/ai/copilot-events";
import { getRegistryModule } from "@/lib/ai/adakaro-registry";

function formatTzs(amount: number): string {
  return `TSh ${amount.toLocaleString("en-US")}`;
}

async function schoolStudentIds(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("approval_status", "approved")
    .limit(2000);

  return ((data ?? []) as Array<{ id: string }>).map((s) => s.id);
}

function matchesClassFilter(className: string, filter?: string): boolean {
  if (!filter) return true;
  return className.toLowerCase().includes(filter.toLowerCase());
}

async function getSchoolStudentIds(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<string[]> {
  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("approval_status", "approved")
    .limit(2000);

  return ((students ?? []) as Array<{ id: string }>).map((s) => s.id);
}

async function monthlyIncome(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<ToolResult> {
  const studentIds = await getSchoolStudentIds(supabase, schoolId);
  if (studentIds.length === 0) {
    return {
      tool: "monthly_income",
      summary: "No student records found yet, so monthly income is TSh 0.",
      data: {
        thisMonth: 0,
        paymentCount: 0,
        lastMonth: 0,
        changePct: 0,
        monthLabel: monthLabel(new Date()),
      },
    };
  }

  const now = new Date();
  const thisMonthStart = monthStartIso(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = monthStartIso(lastMonthDate);

  const { data: payments, error } = await supabase
    .from("payments")
    .select("amount, payment_date")
    .in("student_id", studentIds)
    .gte("payment_date", lastMonthStart)
    .limit(5000);

  if (error) {
    return {
      tool: "monthly_income",
      summary:
        "I couldn't load payment records right now. Please try again from the Finance dashboard.",
    };
  }

  const rows = (payments ?? []) as Array<{ amount: number; payment_date: string }>;
  const currentMonthKey = thisMonthStart.slice(0, 7);
  const lastMonthKey = lastMonthStart.slice(0, 7);

  let thisMonth = 0;
  let lastMonth = 0;
  let paymentCount = 0;

  for (const row of rows) {
    const monthKey = row.payment_date.slice(0, 7);
    const amount = Number(row.amount) || 0;
    if (monthKey === currentMonthKey) {
      thisMonth += amount;
      paymentCount += 1;
    } else if (monthKey === lastMonthKey) {
      lastMonth += amount;
    }
  }

  const changePct =
    lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : thisMonth > 0
        ? 100
        : 0;

  const monthName = monthLabel(now);
  const summary = `Your monthly income for ${monthName} is ${formatTzs(thisMonth)} from ${paymentCount} payment${paymentCount === 1 ? "" : "s"}.`;

  return {
    tool: "monthly_income",
    summary,
    data: {
      thisMonth,
      paymentCount,
      lastMonth,
      changePct,
      monthLabel: monthName,
    },
  };
}

function monthStartIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

async function collectionPerformance(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<ToolResult> {
  const income = await monthlyIncome(supabase, schoolId);
  const studentIds = await getSchoolStudentIds(supabase, schoolId);

  let totalExpected = 0;
  let collected = 0;

  if (studentIds.length > 0) {
    const { data: balances } = await supabase
      .from("student_fee_balances")
      .select("total_fee, total_paid")
      .in("student_id", studentIds)
      .limit(2000);

    for (const row of (balances ?? []) as Array<{
      total_fee: number;
      total_paid: number;
    }>) {
      totalExpected += Number(row.total_fee) || 0;
      collected += Number(row.total_paid) || 0;
    }
  }

  const collectionRate =
    totalExpected > 0 ? Math.round((collected / totalExpected) * 100) : 0;
  const thisMonth = Number(income.data?.thisMonth ?? 0);

  return {
    tool: "collection_performance",
    summary: `Collection rate is ${collectionRate}%. ${formatTzs(thisMonth)} collected this month.`,
    data: {
      ...income.data,
      collectionRate,
      totalExpected,
      collected,
    },
  };
}

async function classCount(
  supabase: SupabaseClient<Database>,
  schoolId: string
): Promise<ToolResult> {
  const { count } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  const total = count ?? 0;
  return {
    tool: "class_count",
    summary: `Your school has ${total} active class${total === 1 ? "" : "es"}.`,
    data: { total },
  };
}

async function attendanceToday(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  classFilter?: string
): Promise<ToolResult> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("class_attendance")
    .select("status, students(full_name), classes(name)")
    .eq("school_id", schoolId)
    .eq("attendance_date", today)
    .limit(500);

  if (error) {
    return {
      tool: "attendance_today",
      summary:
        "I couldn't load today's attendance. Please check the Attendance page.",
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

  const absentNames = [
    ...new Set(
      rows
        .filter((r) => r.status === "absent")
        .map((r) => r.students?.full_name)
        .filter(Boolean)
    ),
  ] as string[];

  return {
    tool: "attendance_today",
    summary:
      total > 0
        ? `Today's attendance is ${rate}% — ${present} present, ${absent} absent.`
        : "No attendance has been recorded for today yet.",
    data: {
      rate,
      present,
      absent,
      total,
      absentStudents: absentNames.slice(0, 15),
      date: today,
    },
  };
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
  const priorContext = buildPriorContext(history);
  const filters = parseConversationFilters(userMessage, priorContext);
  const intent = detectCopilotIntent(
    userMessage,
    priorContext,
    filters,
    history
  );

  if (!intent) return null;

  if (intent.ambiguous) {
    logCopilotEvent({
      type: "ambiguous_query",
      message: userMessage,
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: ctx.role,
    });
    return {
      tool: "clarification",
      summary: "ambiguous",
      navigation: true,
      data: {
        ambiguous: true,
        options: intent.ambiguousOptions ?? [],
      },
    };
  }

  // Navigation / explanation intents — no school data required.
  if (intent.kind === "navigation") {
    const mod = intent.topicId
      ? getRegistryModule(intent.topicId as never)
      : null;
    return {
      tool: intent.tool,
      summary: intent.description ?? `${intent.label ?? "This page"} is part of your dashboard.`,
      navigation: true,
      data: {
        label: intent.label ?? "",
        description: intent.description ?? "",
        href: intent.href ?? "",
        page: intent.dashboardPage ?? "",
        intentType: intent.intentType,
        registryModuleId: mod?.id ?? intent.topicId ?? "",
      },
    };
  }

  // Data intents require an active school workspace.
  if (!ctx.schoolId) {
    return {
      tool: "none",
      summary:
        "I need an active school workspace to access operational data. Please ensure you are signed in to a school.",
    };
  }

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
        summary: permissionDeniedMessage(intent.tool, ctx.role),
        denied: true,
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
    logCopilotEvent({
      type: "permission_denied",
      message: userMessage,
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: ctx.role,
      module: intent.module,
      tool: intent.tool,
    });
    return {
      tool: intent.tool,
      summary: permissionDeniedMessage(intent.tool, ctx.role),
      denied: true,
    };
  }

  const result = await runTool(
    supabase,
    ctx,
    intent.tool,
    intent.classFilter,
    filters
  );

  // Guard: never return a response from a different module than the one the
  // user asked about (e.g. answering "monthly income" with syllabus coverage).
  if (result && !resultMatchesIntent(result.tool, intent.module)) {
    return null;
  }

  return result;
}

/** True when the produced tool belongs to the intended module (or is neutral). */
function resultMatchesIntent(
  resultTool: string,
  intentModule: DetectedIntent["module"]
): boolean {
  if (resultTool === "none") return true;
  const resultModule = moduleForTool(resultTool);
  if (!resultModule) return true;
  return resultModule === intentModule;
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
    case "monthly_income":
      return monthlyIncome(supabase, schoolId);
    case "collection_performance":
      return collectionPerformance(supabase, schoolId);
    case "fee_balances_summary":
    case "top_debtors":
      return feeBalancesSummary(supabase, schoolId, filters);
    case "attendance_today":
      return attendanceToday(supabase, schoolId, classFilter);
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
    case "class_count":
      return classCount(supabase, schoolId);
    case "admissions_summary":
      return admissionsSummary(supabase, schoolId);
    default:
      return null;
  }
}

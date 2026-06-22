import type { ToolResult } from "@/lib/ai/types";
import type { CopilotContext } from "@/lib/ai/types";
import type { ConversationFilters } from "./types";
import type { CopilotBlock, CopilotMessageMeta } from "./types";
import { followUpActionsForTool } from "./follow-ups";

function formatTzs(amount: number): string {
  return `TSh ${amount.toLocaleString("en-US")}`;
}

function schoolHeader(schoolName: string, title: string): string {
  return `**${schoolName}**\n\n**${title}**`;
}

export function buildCopilotResponse(
  toolResult: ToolResult,
  ctx: CopilotContext,
  userMessage: string,
  filters: ConversationFilters
): { content: string; meta: CopilotMessageMeta } {
  const schoolName = ctx.schoolName ?? "Your School";
  const data = toolResult.data ?? {};
  const blocks: CopilotBlock[] = [];
  let responseType: CopilotMessageMeta["responseType"] = "summary";

  switch (toolResult.tool) {
    case "fee_balances_summary":
    case "top_debtors": {
      responseType = "table";
      const totalOutstanding = Number(data.totalOutstanding ?? 0);
      const studentsWithBalance = Number(data.studentsWithBalance ?? 0);
      const debtors = (data.debtors ?? []) as Array<{
        name: string;
        className: string;
        balance: number;
      }>;

      blocks.push({
        type: "metrics",
        items: [
          { label: "Outstanding", value: formatTzs(totalOutstanding), highlight: true },
          { label: "Students with balance", value: String(studentsWithBalance) },
          { label: "Checked", value: String(data.checked ?? "—") },
        ],
      });

      if (debtors.length > 0) {
        blocks.push({
          type: "table",
          title: "Students with outstanding balances",
          headers: ["Student", "Class", "Balance"],
          rows: debtors.map((d) => [
            d.name,
            d.className,
            formatTzs(d.balance),
          ]),
        });
      }

      if (totalOutstanding > 1_000_000) {
        blocks.push({
          type: "insight",
          icon: "alert",
          title: "Fee Collection Alert",
          body: `Outstanding balance: ${formatTzs(totalOutstanding)}`,
          recommendation: "Follow up with the top 10 debtors this week.",
        });
      }

      const content = [
        schoolHeader(schoolName, "Finance Summary"),
        "",
        `Collected context: ${studentsWithBalance} students currently have outstanding balances.`,
        "",
        debtors.length
          ? `**Students with outstanding balances:**\n${debtors
              .slice(0, 8)
              .map((d) => `• ${d.name} (${d.className}) — ${formatTzs(d.balance)}`)
              .join("\n")}`
          : "No outstanding balances found in the checked student records.",
        "",
        `**Total outstanding:** ${formatTzs(totalOutstanding)}`,
      ].join("\n");

      return {
        content,
        meta: {
          schoolName,
          responseType,
          confidence: "high",
          blocks,
          actions: followUpActionsForTool(toolResult.tool, userMessage),
        },
      };
    }

    case "attendance_overview":
    case "absent_students": {
      responseType = "metrics";
      const rate = Number(data.rate ?? 0);
      const present = Number(data.present ?? 0);
      const absent = Number(data.absent ?? 0);
      const total = Number(data.total ?? 0);
      const trend = data.trend as string | undefined;

      blocks.push({
        type: "metrics",
        items: [
          { label: "Attendance rate", value: `${rate}%`, highlight: true },
          { label: "Present / late", value: String(present) },
          { label: "Absent", value: String(absent) },
        ],
      });

      if (trend) {
        blocks.push({
          type: "insight",
          icon: "trend",
          title: "Attendance Insight",
          body: trend,
        });
      } else if (rate >= 85) {
        blocks.push({
          type: "insight",
          icon: "trend",
          title: "Attendance Insight",
          body: `Attendance is at ${rate}% across ${total} recent records.`,
          recommendation: "Maintain daily marking to keep trends accurate.",
        });
      }

      const absentList = (data.absentStudents ?? []) as string[];
      if (absentList.length > 0) {
        blocks.push({
          type: "table",
          title: "Absent students",
          headers: ["Student"],
          rows: absentList.map((name) => [name]),
        });
      }

      const content = [
        schoolHeader(schoolName, "Attendance Summary"),
        "",
        `**Overall rate:** ${rate}%`,
        `**Present / late:** ${present} · **Absent:** ${absent}`,
        filters.classFilter || filters.gradeFilter
          ? `Filter: ${filters.classFilter ?? `Grade ${filters.gradeFilter}`}`
          : "",
        absentList.length
          ? `\n**Absent students:**\n${absentList.map((n) => `• ${n}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content,
        meta: {
          schoolName,
          responseType,
          confidence: total > 0 ? "high" : "low",
          blocks,
          actions: followUpActionsForTool(toolResult.tool, userMessage),
        },
      };
    }

    case "syllabus_coverage_summary": {
      responseType = "metrics";
      const pct = Number(data.pct ?? 0);
      const atRisk = Number(data.atRisk ?? 0);
      const behindClasses = (data.behindClasses ?? []) as string[];

      blocks.push({
        type: "metrics",
        items: [
          { label: "Coverage", value: `${pct}%`, highlight: true },
          { label: "Not started", value: String(atRisk) },
          { label: "Classes behind", value: String(behindClasses.length) },
        ],
      });

      if (behindClasses.length > 0) {
        blocks.push({
          type: "insight",
          icon: "academic",
          title: "Academic Alert",
          body: `${behindClasses[0]} syllabus completion is behind target.`,
          recommendation: "Review coverage with class teachers this week.",
        });
      }

      const content = [
        schoolHeader(schoolName, "Syllabus Coverage"),
        "",
        `**Overall completion:** ${pct}%`,
        behindClasses.length
          ? `**Classes behind:** ${behindClasses.join(", ")}`
          : "All tracked classes are progressing on schedule.",
      ].join("\n");

      return {
        content,
        meta: {
          schoolName,
          responseType,
          confidence: "high",
          blocks,
          actions: followUpActionsForTool(toolResult.tool, userMessage),
        },
      };
    }

    case "report_card_completion": {
      responseType = "metrics";
      const total = Number(data.total ?? 0);
      const complete = Number(data.complete ?? 0);
      const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

      blocks.push({
        type: "metrics",
        items: [
          { label: "Complete", value: `${pct}%`, highlight: true },
          { label: "Report cards", value: String(total) },
          { label: "Finished", value: String(complete) },
        ],
      });

      const content = [
        schoolHeader(schoolName, "Report Card Status"),
        "",
        `**Completion:** ${complete} of ${total} (${pct}%)`,
      ].join("\n");

      return {
        content,
        meta: {
          schoolName,
          responseType,
          confidence: total > 0 ? "high" : "low",
          blocks,
          actions: followUpActionsForTool(toolResult.tool, userMessage),
        },
      };
    }

    case "student_count":
    case "admissions_summary": {
      responseType = "summary";
      const total = Number(data.total ?? 0);
      const admissions = Number(data.admissionsThisMonth ?? 0);

      blocks.push({
        type: "metrics",
        items: [
          { label: "Total students", value: String(total), highlight: true },
          { label: "Admissions this month", value: String(admissions) },
        ],
      });

      const content = [
        schoolHeader(schoolName, "Student Overview"),
        "",
        `**Total approved students:** ${total}`,
        `**New admissions this month:** ${admissions}`,
      ].join("\n");

      return {
        content,
        meta: {
          schoolName,
          responseType,
          confidence: "high",
          blocks,
          actions: followUpActionsForTool(toolResult.tool, userMessage),
        },
      };
    }

    case "finance_report":
    case "attendance_report":
    case "academic_report":
    case "management_report":
    case "school_performance_summary": {
      responseType = "report";
      blocks.push({
        type: "recommendations",
        items: [
          "Share this summary with school leadership",
          "Schedule follow-ups on flagged areas",
          "Export detailed reports from the dashboard",
        ],
      });

      const reportTitle =
        toolResult.tool === "finance_report"
          ? "Finance Report"
          : toolResult.tool === "attendance_report"
            ? "Attendance Report"
            : toolResult.tool === "academic_report"
              ? "Academic Report"
              : toolResult.tool === "management_report"
                ? "Management Report"
                : "School Performance Report";

      const content = [
        schoolHeader(schoolName, reportTitle),
        "",
        toolResult.summary,
        "",
        "_This summary is ready to share with school leadership. Open Finance, Attendance, or Academics in the dashboard for full export options._",
      ].join("\n");

      return {
        content,
        meta: {
          schoolName,
          responseType,
          confidence: "high",
          blocks,
          actions: followUpActionsForTool(toolResult.tool, userMessage),
        },
      };
    }

    default:
      return {
        content: [schoolHeader(schoolName, "Summary"), "", toolResult.summary].join("\n"),
        meta: {
          schoolName,
          responseType: "summary",
          confidence: "high",
          blocks,
          actions: followUpActionsForTool(toolResult.tool, userMessage),
        },
      };
  }
}

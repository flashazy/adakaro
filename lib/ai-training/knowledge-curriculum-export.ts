import type { CurriculumDashboardData, CurriculumModuleRow } from "./knowledge-curriculum";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportCurriculumCsv(data: CurriculumDashboardData): string {
  const lines: string[] = [
    "Module,Description,Target Lessons,Completed,Remaining,Completion %,Health,Status",
  ];

  for (const mod of data.modules) {
    lines.push(
      [
        mod.name,
        mod.description,
        String(mod.targetLessons),
        String(mod.completedLessons),
        String(mod.remainingLessons),
        String(mod.completionPercent),
        mod.health,
        mod.status,
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  lines.push("");
  lines.push("Lesson #,Module,Question,Intent,Priority,Status,Health,Created,Updated,Checklist %");

  for (const mod of data.modules) {
    for (const lesson of mod.lessons) {
      lines.push(
        [
          String(lesson.lessonNumber),
          mod.name,
          lesson.question,
          lesson.intentKey ?? lesson.intentName ?? "",
          lesson.priority,
          lesson.status,
          lesson.health,
          lesson.createdAt,
          lesson.updatedAt,
          String(lesson.checklistScore),
        ]
          .map(escapeCsv)
          .join(",")
      );
    }
  }

  return lines.join("\n");
}

export function exportCurriculumMarkdown(data: CurriculumDashboardData): string {
  const s = data.summary;
  const lines = [
    `# Adakaro AI Knowledge Curriculum`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Overall Progress`,
    ``,
    `- **Completion:** ${s.overallCompletionPercent}%`,
    `- **Lessons completed:** ${s.lessonsCompleted} / ${s.knowledgeTarget}`,
    `- **Lessons remaining:** ${s.lessonsRemaining}`,
    `- **Total entries:** ${s.totalEntries}`,
    `- **Modules complete:** ${s.completedModules} / ${s.totalModules}`,
    ``,
    `## Modules`,
    ``,
    `| Module | Target | Completed | Remaining | % | Health |`,
    `|--------|--------|-----------|-----------|---|--------|`,
  ];

  for (const mod of data.modules) {
    lines.push(
      `| ${mod.name} | ${mod.targetLessons} | ${mod.completedLessons} | ${mod.remainingLessons} | ${mod.completionPercent}% | ${mod.health} |`
    );
  }

  lines.push("", "## Coverage", "");
  if (data.coverage.strongAreas.length) {
    lines.push(`**Strong areas:** ${data.coverage.strongAreas.join(", ")}`);
  }
  if (data.coverage.weakAreas.length) {
    lines.push(`**Weak areas:** ${data.coverage.weakAreas.join(", ")}`);
  }
  if (data.coverage.emptyModules.length) {
    lines.push(`**Empty modules:** ${data.coverage.emptyModules.join(", ")}`);
  }

  for (const mod of data.modules) {
    if (mod.lessons.length === 0) continue;
    lines.push("", `### ${mod.name}`, "");
    for (const lesson of mod.lessons) {
      lines.push(
        `${lesson.lessonNumber}. **${lesson.question}** — ${lesson.status} (${lesson.checklistScore}% checklist)`
      );
    }
  }

  return lines.join("\n");
}

export function printCurriculumPdfHtml(data: CurriculumDashboardData): string {
  const md = exportCurriculumMarkdown(data);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Knowledge Curriculum</title>
<style>
body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#0f172a;line-height:1.5}
h1{font-size:1.5rem} h2{font-size:1.15rem;margin-top:1.5rem} table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left} th{background:#f8fafc}
pre{white-space:pre-wrap;font-family:inherit;font-size:13px}
</style></head><body><pre>${md.replace(/</g, "&lt;")}</pre></body></html>`;
}

export function downloadCurriculumExport(
  data: CurriculumDashboardData,
  format: "csv" | "markdown" | "pdf"
): void {
  if (format === "pdf") {
    const html = printCurriculumPdfHtml(data);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    return;
  }

  const content =
    format === "csv" ? exportCurriculumCsv(data) : exportCurriculumMarkdown(data);
  const mime = format === "csv" ? "text/csv" : "text/markdown";
  const ext = format === "csv" ? "csv" : "md";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adakaro-knowledge-curriculum.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSingleModuleMarkdown(mod: CurriculumModuleRow): string {
  return [
    `# ${mod.name}`,
    ``,
    mod.description,
    ``,
    `**Progress:** ${mod.completedLessons} / ${mod.targetLessons} lessons (${mod.completionPercent}%)`,
    ``,
    `| # | Question | Intent | Status | Health | Checklist |`,
    `|---|----------|--------|--------|--------|-----------|`,
    ...mod.lessons.map(
      (l) =>
        `| ${l.lessonNumber} | ${l.question.replace(/\|/g, "\\|")} | ${l.intentKey ?? "—"} | ${l.status} | ${l.health} | ${l.checklistScore}% |`
    ),
  ].join("\n");
}

import type { AITestMatchResult } from "./test-match";

export function serializeDebugReportJson(
  question: string,
  result: AITestMatchResult
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      question,
      result,
    },
    null,
    2
  );
}

export function serializeDebugReportMarkdown(
  question: string,
  result: AITestMatchResult
): string {
  const c = result.console;
  const lines: string[] = [
    "# Adakaro AI Debug Report",
    "",
    `**Exported:** ${new Date().toLocaleString()}`,
    "",
    "## Question",
    question,
    "",
    "## Outcome",
    `- **Matched:** ${result.matched}`,
    `- **Confidence:** ${result.confidence}% (${c.confidenceReasons.filter((r) => r.met).length}/${c.confidenceReasons.length} signals)`,
    `- **Intent:** ${result.matchedIntent ?? "None"}`,
    `- **Retrieval method:** ${result.retrievalMethod ?? "—"}`,
    `- **Retrieval time:** ${c.performance.totalMs}ms (${c.performance.speedLabel})`,
    "",
    "## Knowledge Entry",
    `- **Question:** ${result.matchedQuestion ?? "—"}`,
    `- **Version:** ${result.knowledgeVersion ?? "—"}`,
    `- **Health:** ${result.healthStatus ?? "—"}`,
    "",
    "## Candidates",
    ...c.kbStatistics.candidateMatches > 0
      ? result.advanced.candidates.map(
          (item) =>
            `${item.isWinner ? "🏆" : "•"} #${item.rank} ${item.question} — ${item.scorePercent}%`
        )
      : ["No candidates"],
    "",
    "## Answer Preview",
    result.answerPreview ?? "_No preview_",
    "",
    "## Recommendations",
    ...c.actionableRecommendations.map((r) => `- ${r.message}`),
  ];
  return lines.join("\n");
}

export function downloadDebugReport(
  question: string,
  result: AITestMatchResult,
  format: "json" | "markdown"
): void {
  const content =
    format === "json"
      ? serializeDebugReportJson(question, result)
      : serializeDebugReportMarkdown(question, result);
  const mime =
    format === "json" ? "application/json" : "text/markdown;charset=utf-8";
  const ext = format === "json" ? "json" : "md";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `adakaro-ai-debug-${Date.now()}.${ext}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printDebugReportPdf(question: string, result: AITestMatchResult): void {
  const html = `<!DOCTYPE html><html><head><title>Adakaro AI Debug Report</title>
<style>
body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a;line-height:1.5}
h1{font-size:20px}h2{font-size:14px;margin-top:24px;color:#475569;text-transform:uppercase;letter-spacing:.05em}
pre{background:#f8fafc;padding:12px;border-radius:8px;white-space:pre-wrap;font-size:12px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#ecfdf5;color:#065f46;font-size:12px;font-weight:600}
</style></head><body>
<h1>Adakaro AI Debug Report</h1>
<p><span class="badge">${result.confidence}% confidence</span></p>
<h2>Question</h2><p>${escapeHtml(question)}</p>
<h2>Matched Intent</h2><p>${escapeHtml(result.matchedIntent ?? "None")}</p>
<h2>Entry</h2><p>${escapeHtml(result.matchedQuestion ?? "—")}</p>
<h2>Answer Preview</h2><pre>${escapeHtml(result.answerPreview ?? "")}</pre>
<h2>Candidates</h2><pre>${escapeHtml(
    result.advanced.candidates
      .map((c) => `#${c.rank} ${c.scorePercent}% ${c.question}`)
      .join("\n")
  )}</pre>
<p style="margin-top:32px;font-size:11px;color:#94a3b8">Generated ${new Date().toLocaleString()}</p>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

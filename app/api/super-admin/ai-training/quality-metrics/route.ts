import { NextResponse } from "next/server";
import { aggregateQualityMetrics } from "@/lib/ai-training/knowledge-quality-report";
import type { KnowledgeQualityReport } from "@/lib/ai-training/knowledge-quality-report";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.dataClient
    .from("ai_knowledge_approval_queue")
    .select("source_metadata, quality_score, proposed_curriculum_module, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reports: KnowledgeQualityReport[] = [];
  const moduleWeak = new Map<string, number>();

  for (const row of data ?? []) {
    const meta = (row as { source_metadata?: Record<string, unknown> }).source_metadata;
    const report = meta?.qualityReport as KnowledgeQualityReport | undefined;
    if (report) {
      reports.push(report);
      if (report.status !== "ready") {
        const mod =
          (row as { proposed_curriculum_module?: string }).proposed_curriculum_module ??
          "unknown";
        moduleWeak.set(mod, (moduleWeak.get(mod) ?? 0) + 1);
      }
    }
  }

  const metrics = aggregateQualityMetrics(reports);
  metrics.topWeakModules = [...moduleWeak.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([moduleId, count]) => ({ moduleId, count }));

  const recentScores = reports.slice(0, 20).map((r) => r.overallQuality);
  const qualityTrend =
    recentScores.length >= 2
      ? recentScores[0]! - recentScores[recentScores.length - 1]!
      : 0;

  return NextResponse.json({
    metrics,
    qualityTrend,
    sampleSize: reports.length,
  });
}

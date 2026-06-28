import { NextRequest, NextResponse } from "next/server";
import type { GeneratedLessonDraft } from "@/lib/ai-training/lesson-generator";
import {
  bulkApproveQueueItems,
  bulkDeleteQueueItems,
  bulkPublishQueueItems,
  bulkRejectQueueItems,
  createApprovalQueueItems,
  listApprovalQueue,
  previewBulkPublish,
  type ApprovalQueueFilters,
} from "@/lib/ai-training/knowledge-approval-queue";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";
import type {
  ApprovalSourceType,
  ApprovalStatus,
  KnowledgePriority,
} from "@/lib/ai-training/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const filters: ApprovalQueueFilters = {
    status: (params.get("status") as ApprovalStatus | "all") ?? "all",
    module: params.get("module") ?? undefined,
    category: params.get("category") ?? undefined,
    priority: (params.get("priority") as KnowledgePriority) ?? "",
    intent: params.get("intent") ?? undefined,
    qualityGrade: params.get("qualityGrade") ?? undefined,
    duplicateRisk: (params.get("duplicateRisk") as ApprovalQueueFilters["duplicateRisk"]) ?? "",
    sourceType: (params.get("sourceType") as ApprovalSourceType) ?? "",
    search: params.get("search") ?? undefined,
    page: Number(params.get("page") ?? "1"),
    pageSize: Number(params.get("pageSize") ?? "25"),
  };

  try {
    const result = await listApprovalQueue(auth.dataClient, filters);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load queue." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    ids?: string[];
    lessons?: GeneratedLessonDraft[];
    sourceMetadata?: Record<string, unknown>;
    reason?: string;
    allowNearDuplicate?: boolean;
    skipBlocked?: boolean;
  };

  if (body.action === "bulk_approve" && body.ids?.length) {
    const count = await bulkApproveQueueItems(
      auth.dataClient,
      body.ids,
      auth.userId
    );
    return NextResponse.json({ ok: true, count });
  }

  if (body.action === "bulk_reject" && body.ids?.length) {
    const count = await bulkRejectQueueItems(
      auth.dataClient,
      body.ids,
      auth.userId,
      body.reason
    );
    return NextResponse.json({ ok: true, count });
  }

  if (body.action === "bulk_publish" && body.ids?.length) {
    const result = await bulkPublishQueueItems(
      auth.dataClient,
      body.ids,
      auth.userId,
      {
        allowNearDuplicate: body.allowNearDuplicate,
        skipBlocked: body.skipBlocked,
      }
    );
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === "bulk_delete" && body.ids?.length) {
    const count = await bulkDeleteQueueItems(auth.dataClient, body.ids);
    return NextResponse.json({ ok: true, count });
  }

  if (body.action === "preview_publish" && body.ids?.length) {
    const preview = await previewBulkPublish(auth.dataClient, body.ids);
    return NextResponse.json(preview);
  }

  if (body.lessons?.length) {
    const result = await createApprovalQueueItems(
      auth.dataClient,
      body.lessons,
      body.sourceMetadata ?? {}
    );
    return NextResponse.json({
      ok: true,
      count: result.count,
      ids: result.ids,
      message: "Lessons saved to Approval Queue. Review and publish them when ready.",
    });
  }

  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}

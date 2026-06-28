import { NextRequest, NextResponse } from "next/server";
import {
  approveQueueItem,
  buildDuplicateReportForItem,
  deleteQueueItem,
  getApprovalQueueItem,
  publishQueueItem,
  rejectQueueItem,
  updateApprovalQueueItem,
  type ApprovalQueueUpdatePayload,
} from "@/lib/ai-training/knowledge-approval-queue";
import { loadEntriesForDuplicateCheck } from "@/lib/ai-training/knowledge-entry-mutations";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const item = await getApprovalQueueItem(auth.dataClient, id);
  if (!item) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const entries = await loadEntriesForDuplicateCheck(auth.dataClient);
  const duplicateReport = buildDuplicateReportForItem(item, entries);

  return NextResponse.json({ item, duplicateReport });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "approve" | "reject" | "publish" | "edit";
    reason?: string;
    allowNearDuplicate?: boolean;
    patch?: ApprovalQueueUpdatePayload;
  };

  if (body.action === "approve") {
    const item = await approveQueueItem(auth.dataClient, id, auth.userId);
    if (!item) {
      return NextResponse.json({ error: "Could not approve item." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, item });
  }

  if (body.action === "reject") {
    const item = await rejectQueueItem(
      auth.dataClient,
      id,
      auth.userId,
      body.reason
    );
    if (!item) {
      return NextResponse.json({ error: "Could not reject item." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, item });
  }

  if (body.action === "publish") {
    const result = await publishQueueItem(auth.dataClient, id, auth.userId, {
      allowNearDuplicate: body.allowNearDuplicate,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, preview: result.preview },
        { status: result.preview?.outcome === "warning" ? 409 : 400 }
      );
    }
    return NextResponse.json({ ok: true, entry: result.entry, item: result.item });
  }

  if (body.action === "edit" && body.patch) {
    const item = await updateApprovalQueueItem(
      auth.dataClient,
      id,
      body.patch,
      auth.userId
    );
    if (!item) {
      return NextResponse.json({ error: "Could not update item." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, item });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const ok = await deleteQueueItem(auth.dataClient, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Could not delete item (may already be published)." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}

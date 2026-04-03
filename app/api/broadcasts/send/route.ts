import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type BroadcastRow = Database["public"]["Tables"]["broadcasts"]["Row"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[broadcasts/send] admin client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  let body: {
    title?: string;
    message?: string;
    is_urgent?: boolean;
    target_user_ids?: string[] | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const title = body.title?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  if (!title || !message) {
    return NextResponse.json(
      { error: "Title and message are required." },
      { status: 400 }
    );
  }

  let targetUserIds: string[] | null = null;
  if (Array.isArray(body.target_user_ids) && body.target_user_ids.length > 0) {
    targetUserIds = [
      ...new Set(
        body.target_user_ids.map((x) => String(x).trim()).filter(Boolean)
      ),
    ];
  }

  const insertRow: Record<string, unknown> = {
    title,
    message,
    is_urgent: Boolean(body.is_urgent),
    sent_by: user.id,
  };
  if (targetUserIds && targetUserIds.length > 0) {
    insertRow.target_user_ids = targetUserIds;
  }

  const { data: inserted, error } = await (admin as any)
    .from("broadcasts")
    .insert(insertRow)
    .select("id, sent_at");

  if (error) {
    console.error("[broadcasts/send]", error);
    return NextResponse.json(
      { error: error.message || "Failed to send broadcast." },
      { status: 500 }
    );
  }

  const rows = Array.isArray(inserted) ? inserted : inserted ? [inserted] : [];
  const row = rows[0] as Pick<BroadcastRow, "id" | "sent_at"> | undefined;
  if (!row) {
    console.error("[broadcasts/send] insert returned no rows", { inserted });
    return NextResponse.json(
      {
        error:
          "Broadcast was not saved (no row returned). If this was a targeted reminder, ensure migration 00046_broadcast_target_user_ids.sql is applied so broadcasts.target_user_ids exists.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ broadcast: row });
}

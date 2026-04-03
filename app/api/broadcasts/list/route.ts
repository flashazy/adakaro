import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSchoolAdminBroadcastAudience } from "@/lib/broadcasts/school-admin-audience";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type BroadcastRow = Database["public"]["Tables"]["broadcasts"]["Row"];

export interface BroadcastListItem extends BroadcastRow {
  read_at: string | null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[broadcasts/list] admin client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const isSuper = await checkIsSuperAdmin(supabase, user.id);
  if (isSuper) {
    const { data, error } = await admin
      .from("broadcasts")
      .select("*")
      .order("sent_at", { ascending: false });

    if (error) {
      console.error("[broadcasts/list] super", error);
      return NextResponse.json(
        { error: error.message || "Query failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      scope: "super_admin" as const,
      items: (data ?? []) as BroadcastRow[],
    });
  }

  const canView = await isSchoolAdminBroadcastAudience(
    user.id,
    supabase,
    false
  );
  if (!canView) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { data: broadcasts, error: bErr } = await admin
    .from("broadcasts")
    .select("*")
    .order("sent_at", { ascending: false });

  if (bErr) {
    console.error("[broadcasts/list] broadcasts", bErr);
    return NextResponse.json(
      { error: bErr.message || "Query failed." },
      { status: 500 }
    );
  }

  const { data: reads, error: rErr } = await admin
    .from("broadcast_reads")
    .select("broadcast_id, read_at")
    .eq("user_id", user.id);

  if (rErr) {
    console.error("[broadcasts/list] reads", rErr);
    return NextResponse.json(
      { error: rErr.message || "Query failed." },
      { status: 500 }
    );
  }

  const readMap = new Map(
    (reads ?? []).map((r) => [
      (r as { broadcast_id: string; read_at: string }).broadcast_id,
      (r as { broadcast_id: string; read_at: string }).read_at,
    ])
  );

  const rows = (broadcasts ?? []) as BroadcastRow[];
  const targeted = rows.filter((b) => {
    const t = b.target_user_ids;
    if (t == null || t.length === 0) return true;
    return t.includes(user.id);
  });

  const items: BroadcastListItem[] = targeted.map((b) => ({
    ...b,
    read_at: readMap.get(b.id) ?? null,
  }));

  const unread = items.filter((i) => !i.read_at);
  const unreadCount = unread.length;
  const primaryUnread =
    unread.length > 0
      ? [...unread].sort(
          (a, b) =>
            new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
        )[0]
      : null;

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode === "banner") {
    return NextResponse.json({
      scope: "school_admin" as const,
      unreadCount,
      primaryUnread,
    });
  }

  return NextResponse.json({
    scope: "school_admin" as const,
    items,
    unreadCount,
    primaryUnread,
  });
}

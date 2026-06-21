import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

interface SuperAdminNotificationRow {
  id: string;
  category: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export async function GET() {
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

  const { data, error } = await supabase
    .from("super_admin_notifications")
    .select("id, category, title, message, metadata, read_at, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[super-admin-notifications] load:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = (data ?? []) as SuperAdminNotificationRow[];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
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

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: "read" | "read_all";
  };

  if (body.action === "read_all") {
    const { error } = await supabase
      .from("super_admin_notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("recipient_id", user.id)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Notification id required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("super_admin_notifications")
    .update({ read_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("recipient_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

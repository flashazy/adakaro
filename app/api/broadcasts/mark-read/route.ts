import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSchoolAdminBroadcastAudience } from "@/lib/broadcasts/school-admin-audience";
import { checkIsSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (await checkIsSuperAdmin(supabase, user.id)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const canMark = await isSchoolAdminBroadcastAudience(
    user.id,
    supabase,
    false
  );
  if (!canMark) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[broadcasts/mark-read] admin client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  let body: { broadcast_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const broadcastId = body.broadcast_id?.trim() ?? "";
  if (!broadcastId) {
    return NextResponse.json({ error: "broadcast_id is required." }, { status: 400 });
  }

  const { error } = await (admin as any).from("broadcast_reads").insert({
    broadcast_id: broadcastId,
    user_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[broadcasts/mark-read]", error);
    return NextResponse.json(
      { error: error.message || "Failed to record read." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

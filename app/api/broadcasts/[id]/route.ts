import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>
) {
  const { id } = await context.params;
  const broadcastId = id?.trim() ?? "";
  if (!broadcastId) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

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
    console.error("[broadcasts/delete] admin client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const { error } = await admin.from("broadcasts").delete().eq("id", broadcastId);

  if (error) {
    console.error("[broadcasts/delete]", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete broadcast." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

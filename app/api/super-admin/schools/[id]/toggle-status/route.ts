import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/super-admin/schools/[id]/toggle-status?action=suspend|activate
 * Optional: reason (suspend only)
 */
export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>
) {
  const { id: schoolId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action");
  const reasonRaw = request.nextUrl.searchParams.get("reason");
  const reason =
    reasonRaw && reasonRaw.trim() !== "" ? reasonRaw.trim() : null;

  if (action !== "suspend" && action !== "activate") {
    return NextResponse.json(
      { error: "Query parameter action must be suspend or activate." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const patch =
    action === "suspend"
      ? {
          status: "suspended" as const,
          suspension_reason: reason,
          updated_at: now,
        }
      : {
          status: "active" as const,
          suspension_reason: null as string | null,
          updated_at: now,
        };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[toggle-status] service role client", e);
    return NextResponse.json(
      {
        error:
          "Server configuration error. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
      },
      { status: 500 }
    );
  }

  const { data, error } = await admin
    .from("schools")
    .update(patch as never)
    .eq("id", schoolId)
    .select("id, status, suspension_reason")
    .maybeSingle();

  if (error) {
    console.error("[toggle-status]", error);
    return NextResponse.json(
      { error: error.message || "Update failed." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    school: data,
  });
}

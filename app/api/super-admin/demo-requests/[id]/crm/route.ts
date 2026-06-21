import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  applyDemoCrmAction,
  CRM_ACTION_TYPES,
  type CrmActionType,
} from "@/lib/demo-requests/crm-actions";

export const dynamic = "force-dynamic";

async function resolveActorName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as { full_name: string | null; email: string | null } | null;
  return profile?.full_name?.trim() || profile?.email?.trim() || "Super Admin";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action as CrmActionType | undefined;
  if (!action || !CRM_ACTION_TYPES.includes(action)) {
    return NextResponse.json({ error: "Invalid CRM action." }, { status: 400 });
  }

  const actorName = await resolveActorName(supabase, user.id);
  const result = await applyDemoCrmAction(supabase, id, action, {
    actorId: user.id,
    actorName,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({
    row: result.row,
    invitation: result.invitation,
    meetingLink: result.meetingLink,
  });
}

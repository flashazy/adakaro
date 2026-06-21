import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  audienceScopeLabel,
  resolveBroadcastAudience,
  type ResolvedBroadcastAudience,
} from "@/lib/broadcasts/broadcast-audience";
import { loadBroadcastTargetRow } from "@/lib/broadcasts/load-broadcast-target";
import { checkIsSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

const READERS_LOAD_ERROR = "Unable to load readers. Please try again.";

export interface ReaderRow {
  user_id: string;
  full_name: string;
  school_name: string;
  read_at: string;
}

export interface NotReadRow {
  user_id: string;
  full_name: string;
  school_name: string;
}

export async function GET(
  _request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>
) {
  const { id: broadcastId } = await context.params;
  const id = broadcastId?.trim() ?? "";
  if (!id) {
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
    console.error("[broadcasts/readers] admin client", e);
    return NextResponse.json({ error: READERS_LOAD_ERROR }, { status: 500 });
  }

  const { row, error: loadError } = await loadBroadcastTargetRow(admin, id);
  if (loadError) {
    console.error("[broadcasts/readers] broadcast load failed", loadError);
    return NextResponse.json({ error: READERS_LOAD_ERROR }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
  }

  let audience: ResolvedBroadcastAudience;
  try {
    audience = await resolveBroadcastAudience(admin, {
      target_type: row.target_type,
      target_user_ids: row.target_user_ids,
      target_school_id: row.target_school_id,
      target_school_ids: row.target_school_ids,
    });
  } catch (err) {
    console.error("[broadcasts/readers] audience resolution failed", err);
    return NextResponse.json({ error: READERS_LOAD_ERROR }, { status: 500 });
  }

  const schoolAdminIds = audience.recipientUserIds;
  const title = row.title;

  const { data: reads, error: rErr } = await admin
    .from("broadcast_reads")
    .select("user_id, read_at")
    .eq("broadcast_id", id);

  if (rErr) {
    console.error("[broadcasts/readers] reads", rErr);
    return NextResponse.json({ error: READERS_LOAD_ERROR }, { status: 500 });
  }

  const readRows = (reads ?? []) as { user_id: string; read_at: string }[];
  const readByUser = new Map(readRows.map((r) => [r.user_id, r.read_at]));

  const readUserIdsInAudience = schoolAdminIds.filter((uid) =>
    readByUser.has(uid)
  );
  const notReadUserIds = schoolAdminIds.filter((uid) => !readByUser.has(uid));

  let nameById = new Map<string, string>();
  if (schoolAdminIds.length > 0) {
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", schoolAdminIds);
    if (pErr) {
      console.error("[broadcasts/readers] profiles", pErr);
      return NextResponse.json({ error: READERS_LOAD_ERROR }, { status: 500 });
    }
    nameById = new Map(
      (profiles ?? []).map((p) => [
        (p as { id: string; full_name: string }).id,
        (p as { id: string; full_name: string }).full_name?.trim() || "Unknown",
      ])
    );
  }

  let schoolNameById = new Map<string, string>();
  let memberships: { user_id: string; school_id: string }[] = [];
  if (schoolAdminIds.length > 0) {
    const { data: mem, error: mErr } = await admin
      .from("school_members")
      .select("user_id, school_id")
      .in("user_id", schoolAdminIds)
      .eq("role", "admin");
    if (mErr) {
      console.error("[broadcasts/readers] school_members", mErr);
      return NextResponse.json({ error: READERS_LOAD_ERROR }, { status: 500 });
    }
    memberships = (mem ?? []) as { user_id: string; school_id: string }[];

    const allowedSchoolIds = new Set([
      ...(audience.targetSchoolId ? [audience.targetSchoolId] : []),
      ...audience.schoolIds,
    ]);
    if (allowedSchoolIds.size > 0) {
      memberships = memberships.filter((m) =>
        allowedSchoolIds.has(m.school_id)
      );
    }

    const schoolIds = [...new Set(memberships.map((m) => m.school_id))];
    if (schoolIds.length > 0) {
      const { data: schools, error: sErr } = await admin
        .from("schools")
        .select("id, name")
        .in("id", schoolIds);
      if (sErr) {
        console.error("[broadcasts/readers] schools", sErr);
        return NextResponse.json({ error: READERS_LOAD_ERROR }, { status: 500 });
      }
      schoolNameById = new Map(
        (schools ?? []).map((s) => [
          (s as { id: string; name: string }).id,
          (s as { id: string; name: string }).name?.trim() || "—",
        ])
      );
    }
  }

  function schoolLabelForUser(uid: string): string {
    const names = memberships
      .filter((m) => m.user_id === uid)
      .map((m) => schoolNameById.get(m.school_id) ?? "—")
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return names[0] ?? audience.targetSchoolName ?? "—";
  }

  const readList: ReaderRow[] = readUserIdsInAudience
    .map((user_id) => ({
      user_id,
      full_name: nameById.get(user_id) ?? "Unknown",
      school_name: schoolLabelForUser(user_id),
      read_at: readByUser.get(user_id) ?? "",
    }))
    .sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
    );

  const notReadList: NotReadRow[] = notReadUserIds
    .map((user_id) => ({
      user_id,
      full_name: nameById.get(user_id) ?? "Unknown",
      school_name: schoolLabelForUser(user_id),
    }))
    .sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
    );

  const total = schoolAdminIds.length;
  const readCount = readList.length;
  const notReadCount = notReadList.length;
  const readPercent = total > 0 ? Math.round((readCount / total) * 1000) / 10 : 0;

  return NextResponse.json({
    broadcast_id: id,
    broadcast_title: title,
    audience_scope: audience.scope,
    audience_scope_label: audienceScopeLabel(audience.scope),
    target_school_id: audience.targetSchoolId,
    target_school_name: audience.targetSchoolName,
    total_school_admins: total,
    recipient_count: total,
    read_count: readCount,
    not_read_count: notReadCount,
    read_percent: readPercent,
    read: readList,
    not_read: notReadList,
    unread_user_ids: notReadUserIds,
  });
}

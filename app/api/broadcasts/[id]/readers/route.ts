import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSchoolAdminUserIds } from "@/lib/broadcasts/school-admin-user-ids";
import { checkIsSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const { data: broadcast, error: bErr } = await admin
    .from("broadcasts")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  if (bErr) {
    console.error("[broadcasts/readers] broadcast", bErr);
    return NextResponse.json(
      { error: bErr.message || "Query failed." },
      { status: 500 }
    );
  }
  if (!broadcast) {
    return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
  }

  const title = (broadcast as { title: string }).title;

  const schoolAdminIds = await getSchoolAdminUserIds(admin);

  const { data: reads, error: rErr } = await admin
    .from("broadcast_reads")
    .select("user_id, read_at")
    .eq("broadcast_id", id);

  if (rErr) {
    console.error("[broadcasts/readers] reads", rErr);
    return NextResponse.json(
      { error: rErr.message || "Query failed." },
      { status: 500 }
    );
  }

  const readRows = (reads ?? []) as { user_id: string; read_at: string }[];
  const readByUser = new Map(readRows.map((r) => [r.user_id, r.read_at]));

  const readUserIdsInAudience = schoolAdminIds.filter((uid) =>
    readByUser.has(uid)
  );
  const notReadUserIds = schoolAdminIds.filter((uid) => !readByUser.has(uid));

  let nameById = new Map<string, string>();
  if (schoolAdminIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", schoolAdminIds);
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
    const { data: mem } = await admin
      .from("school_members")
      .select("user_id, school_id")
      .in("user_id", schoolAdminIds);
    memberships = (mem ?? []) as { user_id: string; school_id: string }[];
    const schoolIds = [...new Set(memberships.map((m) => m.school_id))];
    if (schoolIds.length > 0) {
      const { data: schools } = await admin
        .from("schools")
        .select("id, name")
        .in("id", schoolIds);
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
    return names[0] ?? "—";
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
    total_school_admins: total,
    read_count: readCount,
    not_read_count: notReadCount,
    read_percent: readPercent,
    read: readList,
    not_read: notReadList,
    unread_user_ids: notReadUserIds,
  });
}

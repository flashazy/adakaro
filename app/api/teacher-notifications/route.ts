import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ClassMovementNotificationMetadata,
  ClassMovementNotificationMetadataClient,
} from "@/lib/notifications/in-app-notification-types";
import {
  resolveStudentProfileAccessForMoves,
  studentProfilePath,
} from "@/lib/notifications/notification-student-profile";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  helper_text: string | null;
  type: string;
  metadata: ClassMovementNotificationMetadata | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
};

async function enrichNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  notifications: NotificationRow[]
) {
  const allMoves = notifications.flatMap((n) =>
    n.type === "class_movement" && n.metadata?.moves?.length
      ? n.metadata.moves.map((m) => ({
          studentId: m.studentId,
        }))
      : []
  );
  const accessByStudent = await resolveStudentProfileAccessForMoves(
    supabase,
    userId,
    allMoves
  );

  return notifications.map((n) => {
    if (n.type !== "class_movement" || !n.metadata?.moves?.length) {
      return n;
    }
    const metadata: ClassMovementNotificationMetadataClient = {
      ...n.metadata,
      moves: n.metadata.moves.map((m) => ({
        ...m,
        profilePath: studentProfilePath(m.studentId, {
          fromClassTeacherNotification: true,
        }),
        canOpenProfile: accessByStudent.get(m.studentId) ?? false,
      })),
    };
    return { ...n, metadata };
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "archived" ? "archived" : "inbox";

  const { count: unreadCount, error: countErr } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null)
    .is("archived_at", null);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  let query = supabase
    .from("notifications")
    .select(
      "id, title, message, helper_text, type, metadata, read_at, archived_at, created_at"
    )
    .eq("recipient_id", user.id);

  if (view === "archived") {
    query = query
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(50);
  } else {
    query = query
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(30);
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = await enrichNotifications(
    supabase,
    user.id,
    (rows ?? []) as NotificationRow[]
  );

  return NextResponse.json({
    view,
    unreadCount: unreadCount ?? 0,
    notifications,
  });
}

type PatchBody = {
  id?: string;
  markAll?: boolean;
  action?: "read" | "archive";
};

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now } as never)
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .is("archived_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "Notification id is required." },
      { status: 400 }
    );
  }

  const action = body.action ?? "read";

  if (action === "archive") {
    const { data: existing, error: fetchErr } = await supabase
      .from("notifications")
      .select("read_at")
      .eq("id", id)
      .eq("recipient_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Notification not found." },
        { status: 404 }
      );
    }

    const readAt =
      (existing as { read_at: string | null }).read_at ?? now;

    const { error } = await supabase
      .from("notifications")
      .update({ archived_at: now, read_at: readAt } as never)
      .eq("id", id)
      .eq("recipient_id", user.id)
      .is("archived_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now } as never)
    .eq("id", id)
    .eq("recipient_id", user.id)
    .is("archived_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

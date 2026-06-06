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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("notifications")
    .select(
      "id, title, message, helper_text, type, metadata, read_at, created_at"
    )
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    title: string;
    message: string;
    helper_text: string | null;
    type: string;
    metadata: ClassMovementNotificationMetadata | null;
    read_at: string | null;
    created_at: string;
  };

  const notifications = (rows ?? []) as Row[];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const allMoves = notifications.flatMap((n) =>
    n.type === "class_movement" && n.metadata?.moves?.length
      ? n.metadata.moves.map((m) => ({
          studentId: m.studentId,
        }))
      : []
  );
  const accessByStudent = await resolveStudentProfileAccessForMoves(
    supabase,
    user.id,
    allMoves
  );

  const enriched = notifications.map((n) => {
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

  return NextResponse.json({ unreadCount, notifications: enriched });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { id?: string; markAll?: boolean };
  try {
    body = (await request.json()) as { id?: string; markAll?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now } as never)
      .eq("recipient_id", user.id)
      .is("read_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now } as never)
    .eq("id", id)
    .eq("recipient_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

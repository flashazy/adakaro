import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { filterLeafClassOptions } from "@/lib/class-options";
import { readCaptureCardSession } from "@/lib/capture-card/session";
import {
  CaptureCardClient,
  type CaptureLatestStudent,
} from "./capture-card-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function parsePage(sp: Record<string, string | string[] | undefined>): number {
  const raw = sp.page;
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const n = Number.parseInt(String(v || "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function CaptureCardHomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const page = parsePage(sp);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE; // fetch one extra (inclusive range)

  const session = await readCaptureCardSession();
  const trace = `[capture-card] id=${Math.random().toString(36).slice(2, 10)}`;

  // Preferred: cookie-based capture session (no Supabase auth required).
  if (session) {
    console.info(`${trace} session(cookie)`, {
      ccuId: session.ccuId,
      schoolId: session.schoolId,
      username: session.username,
    });

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      console.error(`${trace} createAdminClient failed`);
      redirect("/login");
    }

    const { data: ccuRow, error: ccuErr } = await admin
      .from("capture_card_users")
      .select("id, auth_user_id, is_active, expires_at, requires_approval")
      .eq("id", session.ccuId)
      .maybeSingle();
    if (ccuErr) {
      console.error(`${trace} capture_card_users lookup error`, {
        message: ccuErr.message,
        code: (ccuErr as unknown as { code?: string }).code,
        details: (ccuErr as unknown as { details?: string }).details,
      });
    }

    const ccu = ccuRow as {
      id: string;
      auth_user_id: string;
      is_active: boolean;
      expires_at: string | null;
      requires_approval: boolean;
    } | null;

    if (!ccu || !ccu.is_active) redirect("/login");
    if (ccu.expires_at && new Date(ccu.expires_at).getTime() <= Date.now()) {
      redirect("/login");
    }
    const schoolId = session.schoolId;

    const { data: schoolRow, error: schoolErr } = await admin
      .from("schools")
      .select("name, logo_url, updated_at")
      .eq("id", schoolId)
      .maybeSingle();
    if (schoolErr) {
      console.error(`${trace} schools lookup error`, {
        message: schoolErr.message,
      });
    }

    const schoolName =
      (schoolRow as { name: string } | null)?.name?.trim() || "Your school";
    const schoolLogoUrl =
      (schoolRow as { logo_url?: string | null } | null)?.logo_url?.trim() ||
      null;
    const schoolLogoVersion = (() => {
      const raw = (schoolRow as { updated_at?: string } | null)?.updated_at;
      const t = raw ? new Date(raw).getTime() : NaN;
      return Number.isFinite(t) ? t : null;
    })();

    const requiresApproval =
      (ccu as { requires_approval: boolean } | null)?.requires_approval !==
      false;

    const { data: classRows, error: classErr } = await admin
      .from("classes")
      .select("id, name, parent_class_id")
      .eq("school_id", schoolId)
      .order("name");
    if (classErr) {
      console.error(`${trace} classes query error`, {
        message: classErr.message,
      });
    }

    const classes = filterLeafClassOptions(
      (classRows ?? []) as {
        id: string;
        name: string;
        parent_class_id: string | null;
      }[]
    ).map((c) => ({ id: c.id, name: c.name }));

    const { data: latestRows } = await admin
      .from("students")
      .select(
        "id, full_name, admission_number, enrollment_date, approval_status, avatar_url, date_of_birth, class:classes(name)"
      )
      .eq("enrolled_by", ccu.auth_user_id)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: myRows, error: stErr } = await admin
      .from("students")
      .select(
        "id, full_name, admission_number, enrollment_date, approval_status, avatar_url, date_of_birth, class:classes(name)"
      )
      .eq("enrolled_by", ccu.auth_user_id)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (stErr) {
      console.error(`${trace} students query error`, { message: stErr.message });
    }

    const hasMore = (myRows?.length ?? 0) > PAGE_SIZE;
    const pageRows = (myRows ?? []).slice(0, PAGE_SIZE);

    console.info(`${trace} data ready`, {
      schoolNameLen: schoolName.length,
      classesCount: classes.length,
      studentsCount: pageRows.length,
      latestId: (latestRows?.[0] as { id?: string } | undefined)?.id ?? null,
      page,
      hasMore,
    });

    const myStudents = pageRows as unknown as CaptureLatestStudent[];
    const latest = (latestRows?.[0] as unknown as CaptureLatestStudent) ?? null;

    return (
      <CaptureCardClient
        schoolName={schoolName}
        schoolLogoUrl={schoolLogoUrl}
        schoolLogoVersion={schoolLogoVersion}
        requiresApproval={requiresApproval}
        classes={classes}
        latest={latest}
        myStudents={myStudents}
        page={page}
        hasMore={hasMore}
      />
    );
  }

  // Fallback: legacy Supabase-authenticated capture users (so they can still see Capture Card).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "capture_card_user") {
    redirect("/login");
  }

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) redirect("/login");

  const { data: schoolRow } = await supabase
    .from("schools")
    .select("name, logo_url, updated_at")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName =
    (schoolRow as { name: string } | null)?.name?.trim() || "Your school";
  const schoolLogoUrl =
    (schoolRow as { logo_url?: string | null } | null)?.logo_url?.trim() || null;
  const schoolLogoVersion = (() => {
    const raw = (schoolRow as { updated_at?: string } | null)?.updated_at;
    const t = raw ? new Date(raw).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  })();

  const { data: ccuRow } = await supabase
    .from("capture_card_users")
    .select("requires_approval")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const requiresApproval =
    (ccuRow as { requires_approval: boolean } | null)?.requires_approval !==
    false;

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, parent_class_id")
    .eq("school_id", schoolId)
    .order("name");
  const classes = filterLeafClassOptions(
    (classRows ?? []) as {
      id: string;
      name: string;
      parent_class_id: string | null;
    }[]
  ).map((c) => ({ id: c.id, name: c.name }));

  const { data: latestRows } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_number, enrollment_date, approval_status, avatar_url, date_of_birth, class:classes(name)"
    )
    .eq("enrolled_by", user.id)
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: myRows } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_number, enrollment_date, approval_status, avatar_url, date_of_birth, class:classes(name)"
    )
    .eq("enrolled_by", user.id)
    .eq("approval_status", "pending")
    .order("created_at", { ascending: false })
    .range(from, to);

  const hasMore = (myRows?.length ?? 0) > PAGE_SIZE;
  const pageRows = (myRows ?? []).slice(0, PAGE_SIZE);
  const myStudents = pageRows as unknown as CaptureLatestStudent[];
  const latest = (latestRows?.[0] as unknown as CaptureLatestStudent) ?? null;

  return (
    <CaptureCardClient
      schoolName={schoolName}
      schoolLogoUrl={schoolLogoUrl}
      schoolLogoVersion={schoolLogoVersion}
      requiresApproval={requiresApproval}
      classes={classes}
      latest={latest}
      myStudents={myStudents}
      page={page}
      hasMore={hasMore}
    />
  );
}

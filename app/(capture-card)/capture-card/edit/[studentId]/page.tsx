import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { filterLeafClassOptions } from "@/lib/class-options";
import { readCaptureCardSession } from "@/lib/capture-card/session";
import { CaptureCardEditStudentClient } from "./edit-student-client";

export const dynamic = "force-dynamic";

export default async function CaptureCardEditStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await readCaptureCardSession();
  const trace = `[capture-edit] id=${Math.random().toString(36).slice(2, 10)}`;

  // Preferred: cookie-based session
  if (session) {
    console.info(`${trace} session(cookie)`, {
      ccuId: session.ccuId,
      schoolId: session.schoolId,
      username: session.username,
      studentId,
    });

    let admin;
    try {
      admin = createAdminClient();
    } catch (e) {
      console.error(`${trace} createAdminClient failed`, e);
      redirect("/login");
    }

    const { data: ccuRow, error: ccuErr } = await admin
      .from("capture_card_users")
      .select("id, auth_user_id, is_active, expires_at")
      .eq("id", session.ccuId)
      .maybeSingle();
    if (ccuErr) {
      console.error(`${trace} capture_card_users lookup error`, {
        message: ccuErr.message,
        code: (ccuErr as unknown as { code?: string }).code,
      });
    }

    const ccu = ccuRow as {
      id: string;
      auth_user_id: string;
      is_active: boolean;
      expires_at: string | null;
    } | null;

    if (!ccu || !ccu.is_active) redirect("/login");
    if (ccu.expires_at && new Date(ccu.expires_at).getTime() <= Date.now()) {
      redirect("/login");
    }

    const schoolId = session.schoolId;

    const { data: st, error } = await admin
      .from("students")
      .select(
        "id, full_name, date_of_birth, class_id, gender, parent_name, parent_phone, parent_email, allergies, disability, insurance_provider, insurance_policy, approval_status, avatar_url, enrolled_by, school_id"
      )
      .eq("id", studentId)
      .maybeSingle();

    const row = st as {
      id: string;
      full_name: string;
      date_of_birth: string | null;
      class_id: string;
      gender: string | null;
      parent_name: string | null;
      parent_phone: string | null;
      parent_email: string | null;
      allergies: string | null;
      disability: string | null;
      insurance_provider: string | null;
      insurance_policy: string | null;
      approval_status: string;
      avatar_url: string | null;
      enrolled_by: string | null;
      school_id: string;
    } | null;

    if (error) {
      console.error(`${trace} students lookup error`, { message: error.message });
    }

    if (
      error ||
      !row ||
      row.school_id !== schoolId ||
      row.enrolled_by !== ccu.auth_user_id
    ) {
      console.warn(`${trace} notFound`, {
        hasRow: Boolean(row),
        rowSchoolId: row?.school_id ?? null,
        expectedSchoolId: schoolId,
        rowEnrolledBy: row?.enrolled_by ?? null,
        expectedEnrolledBy: ccu.auth_user_id,
      });
      notFound();
    }

    const { data: classRows, error: classErr } = await admin
      .from("classes")
      .select("id, name, parent_class_id")
      .eq("school_id", schoolId)
      .order("name");
    if (classErr) {
      console.error(`${trace} classes lookup error`, { message: classErr.message });
    }

    const classes = filterLeafClassOptions(
      (classRows ?? []) as {
        id: string;
        name: string;
        parent_class_id: string | null;
      }[]
    ).map((c) => ({ id: c.id, name: c.name }));

    return (
      <CaptureCardEditStudentClient
        student={{
          id: row.id,
          full_name: row.full_name,
          date_of_birth: row.date_of_birth,
          class_id: row.class_id,
          gender: row.gender,
          parent_name: row.parent_name,
          parent_phone: row.parent_phone,
          parent_email: row.parent_email,
          allergies: row.allergies,
          disability: row.disability,
          insurance_provider: row.insurance_provider,
          insurance_policy: row.insurance_policy,
          approval_status: row.approval_status,
          avatar_url: row.avatar_url,
        }}
        classes={classes}
      />
    );
  }

  // Fallback: legacy Supabase-authenticated capture users (matches Capture Card dashboard behavior).
  console.info(`${trace} session(legacy-supabase)`, { studentId });
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

  const { data: st, error } = await supabase
    .from("students")
    .select(
      "id, full_name, date_of_birth, class_id, gender, parent_name, parent_phone, parent_email, allergies, disability, insurance_provider, insurance_policy, approval_status, avatar_url, enrolled_by, school_id"
    )
    .eq("id", studentId)
    .maybeSingle();

  const row = st as {
    id: string;
    full_name: string;
    date_of_birth: string | null;
    class_id: string;
    gender: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    parent_email: string | null;
    allergies: string | null;
    disability: string | null;
    insurance_provider: string | null;
    insurance_policy: string | null;
    approval_status: string;
    avatar_url: string | null;
    enrolled_by: string | null;
    school_id: string;
  } | null;

  if (error) console.error(`${trace} students lookup error(legacy)`, error);
  if (error || !row || row.school_id !== schoolId || row.enrolled_by !== user.id) {
    console.warn(`${trace} notFound(legacy)`, {
      hasRow: Boolean(row),
      rowSchoolId: row?.school_id ?? null,
      expectedSchoolId: schoolId,
      rowEnrolledBy: row?.enrolled_by ?? null,
      expectedEnrolledBy: user.id,
    });
    notFound();
  }

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

  return (
    <CaptureCardEditStudentClient
      student={{
        id: row.id,
        full_name: row.full_name,
        date_of_birth: row.date_of_birth,
        class_id: row.class_id,
        gender: row.gender,
        parent_name: row.parent_name,
        parent_phone: row.parent_phone,
        parent_email: row.parent_email,
        allergies: row.allergies,
        disability: row.disability,
        insurance_provider: row.insurance_provider,
        insurance_policy: row.insurance_policy,
        approval_status: row.approval_status,
        avatar_url: row.avatar_url,
      }}
      classes={classes}
    />
  );
}

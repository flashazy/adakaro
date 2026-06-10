import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClassCluster } from "@/lib/class-cluster";

export async function requireSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: "You must be signed in." as const };
  return { user, error: null as null };
}

export async function assertCoordinatorForClass(
  userId: string,
  classId: string
): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, classId);
  const classIds = cluster.classIds;

  const { data: classRow } = await admin
    .from("classes")
    .select("school_id")
    .eq("id", cluster.rootClassId)
    .maybeSingle();
  if (!classRow) return { ok: false, error: "Class not found." };
  const schoolId = (classRow as { school_id: string }).school_id;

  const { data: coordRows } = await admin
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", userId)
    .in("class_id", [...new Set(classIds)])
    .limit(1);

  if (!coordRows?.length) {
    return {
      ok: false,
      error: "You must coordinate this class to manage its syllabus.",
    };
  }
  return { ok: true, schoolId };
}

export async function assertTeacherAssignedToClassSubject(
  userId: string,
  classId: string,
  subjectId: string | null
): Promise<{ ok: true; schoolId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const cluster = await resolveClassCluster(admin, classId);
  const classIds = cluster.classIds;

  const { data: classRow } = await admin
    .from("classes")
    .select("school_id")
    .eq("id", cluster.rootClassId)
    .maybeSingle();
  if (!classRow) return { ok: false, error: "Class not found." };
  const schoolId = (classRow as { school_id: string }).school_id;

  let query = admin
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", userId)
    .in("class_id", classIds)
    .limit(1);

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data: rows } = await query;
  if (!rows?.length) {
    return {
      ok: false,
      error: "You are not assigned to teach this class and subject.",
    };
  }
  return { ok: true, schoolId };
}

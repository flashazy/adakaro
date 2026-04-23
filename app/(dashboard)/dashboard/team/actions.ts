"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { normalizeTeacherDisplayName } from "@/lib/teacher-display-name";
import { checkAdminLimit } from "@/lib/plan-limits";
import type { Database } from "@/types/supabase";
import { assertSchoolAdminForUser } from "../teachers/actions";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/** Manual Database types omit Relationships required by Supabase v2 generics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin .update/.insert resolves to `never` without Relationships
type Db = any;

export type TeamAdminActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function syntheticAdminEmail(userId: string): string {
  return `a.${userId.replace(/-/g, "")}@admins.adakaro.app`;
}

/** True if another admin at this school already uses this normalised display name. */
async function adminDisplayNameTaken(
  admin: Db,
  schoolId: string,
  normalizedName: string,
  excludeUserId?: string
): Promise<boolean> {
  const { data: rows } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "admin");
  const ids = ((rows ?? []) as { user_id: string }[])
    .map((r) => r.user_id)
    .filter((id) => id !== excludeUserId);
  if (ids.length === 0) return false;
  const { data: profs } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
    if (
      normalizeTeacherDisplayName(p.full_name ?? "") === normalizedName
    ) {
      return true;
    }
  }
  return false;
}

export async function createSchoolAdminAccountAction(
  _prev: TeamAdminActionState | null,
  formData: FormData
): Promise<TeamAdminActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || fullName.length < 2) {
    return {
      ok: false,
      error: "Please enter the administrator's full name (at least 2 characters).",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Unauthorized." };
  }

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return { ok: false, error: "No school found for your account." };
  }

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return {
      ok: false,
      error: "Only school administrators can manage the team.",
    };
  }

  const normalized = normalizeTeacherDisplayName(fullName);
  if (!normalized) {
    return { ok: false, error: "Please enter a valid full name." };
  }

  const limitCheck = await checkAdminLimit(supabase, schoolId);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      error: "Your plan does not allow more administrators.",
    };
  }

  const admin = createAdminClient();

  if (await adminDisplayNameTaken(admin as Db, schoolId, normalized)) {
    return {
      ok: false,
      error: "An administrator with this name already exists for your school.",
    };
  }

  const userId = randomUUID();
  const email = syntheticAdminEmail(userId);
  let createdUserId: string | null = null;

  try {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        id: userId,
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "admin",
          password_changed: false,
        },
      });

    if (createErr || !created.user) {
      return {
        ok: false,
        error: createErr?.message || "Could not create the administrator account.",
      };
    }
    createdUserId = created.user.id;

    const { error: profErr } = await (admin as Db)
      .from("profiles")
      .update({
        full_name: fullName,
        role: "admin",
        password_changed: false,
      } satisfies ProfileUpdate)
      .eq("id", createdUserId);

    if (profErr) {
      throw new Error(profErr.message || "Could not finalize profile.");
    }

    const insertRow: Database["public"]["Tables"]["school_members"]["Insert"] = {
      school_id: schoolId,
      user_id: createdUserId,
      role: "admin",
      promoted_from_teacher_at: null,
      created_by: user.id,
    };

    const { error: mErr } = await (admin as Db)
      .from("school_members")
      .insert(insertRow);

    if (mErr) {
      throw new Error(mErr.message || "Could not add administrator to your school.");
    }

    revalidatePath("/dashboard/team");
    return {
      ok: true,
      message:
        "Administrator account created. They should sign in using their full name (exactly as you entered) and this password, then choose a new password when prompted.",
    };
  } catch (e) {
    if (createdUserId) {
      try {
        await admin.auth.admin.deleteUser(createdUserId);
      } catch {
        /* */
      }
    }
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Could not create administrator. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
    };
  }
}

export async function promoteTeacherToAdminAction(
  _prev: TeamAdminActionState | null,
  formData: FormData
): Promise<TeamAdminActionState> {
  const teacherUserId = String(formData.get("teacher_user_id") ?? "").trim();
  if (!teacherUserId) {
    return { ok: false, error: "Select a teacher to promote." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Unauthorized." };
  }

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return { ok: false, error: "No school found for your account." };
  }

  if (!(await assertSchoolAdminForUser(user.id, schoolId))) {
    return {
      ok: false,
      error: "Only school administrators can manage the team.",
    };
  }

  if (teacherUserId === user.id) {
    return { ok: false, error: "You cannot promote yourself." };
  }

  const limitCheck = await checkAdminLimit(supabase, schoolId);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      error: "Your plan does not allow more administrators.",
    };
  }

  const admin = createAdminClient();

  const { data: mem, error: memErr } = await (admin as Db)
    .from("school_members")
    .select("id, role")
    .eq("school_id", schoolId)
    .eq("user_id", teacherUserId)
    .maybeSingle();

  const row = mem as { id: string; role: string } | null;
  if (memErr || !row) {
    return { ok: false, error: "That teacher is not a member of your school." };
  }
  if (row.role !== "teacher") {
    return {
      ok: false,
      error: "Selected user is not a teacher at your school.",
    };
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await (admin as Db)
    .from("school_members")
    .update({
      role: "admin",
      promoted_from_teacher_at: nowIso,
      created_by: user.id,
    } satisfies Database["public"]["Tables"]["school_members"]["Update"])
    .eq("id", row.id)
    .eq("school_id", schoolId)
    .eq("user_id", teacherUserId)
    .eq("role", "teacher");

  if (upErr) {
    console.error("[promoteTeacherToAdmin]", upErr);
    return {
      ok: false,
      error: upErr.message || "Could not promote this teacher.",
    };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/teachers");
  return {
    ok: true,
    message:
      "Teacher promoted to administrator. They can open the school admin dashboard using the role switch in the header when available.",
  };
}

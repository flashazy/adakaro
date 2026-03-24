"use server";

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePlanId, planDisplayName } from "@/lib/plans";
import {
  effectiveAdminLimit,
  type SchoolPlanRow,
} from "@/lib/plan-limits";

export type InviteAdminResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LOG_PREFIX = "[invite-admin]";

function inviteLog(
  message: string,
  details?: Record<string, unknown>
): void {
  if (details && Object.keys(details).length > 0) {
    console.log(LOG_PREFIX, message, details);
  } else {
    console.log(LOG_PREFIX, message);
  }
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function loadSchoolPlanRowForInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string
): Promise<SchoolPlanRow | null> {
  const mapRow = (r: {
    plan: string | null;
    student_limit?: number | null;
    admin_limit?: number | null;
  } | null): SchoolPlanRow | null => {
    if (!r) return null;
    return {
      plan: r.plan ?? "free",
      student_limit: r.student_limit ?? null,
      admin_limit: r.admin_limit ?? null,
    };
  };

  const { data: userRow, error: uErr } = await supabase
    .from("schools")
    .select("plan, student_limit, admin_limit")
    .eq("id", schoolId)
    .maybeSingle();

  if (!uErr && userRow) {
    return mapRow(
      userRow as {
        plan: string | null;
        student_limit: number | null;
        admin_limit: number | null;
      }
    );
  }

  try {
    const admin = createAdminClient();
    const { data: adminRow, error: aErr } = await admin
      .from("schools")
      .select("plan, student_limit, admin_limit")
      .eq("id", schoolId)
      .maybeSingle();
    if (!aErr && adminRow) {
      return mapRow(
        adminRow as {
          plan: string | null;
          student_limit: number | null;
          admin_limit: number | null;
        }
      );
    }
  } catch {
    /* no service role */
  }

  return null;
}

async function countAdmins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string
): Promise<number | null> {
  const r = await supabase
    .from("school_members")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("role", "admin");
  if (!r.error && r.count != null) return r.count;
  try {
    const admin = createAdminClient();
    const ar = await admin
      .from("school_members")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("role", "admin");
    return ar.count ?? null;
  } catch {
    return null;
  }
}

async function countPendingInvites(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string
): Promise<number> {
  const r = await supabase
    .from("school_invitations")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());
  if (!r.error && r.count != null) return r.count;
  try {
    const admin = createAdminClient();
    const ar = await admin
      .from("school_invitations")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());
    return ar.count ?? 0;
  } catch {
    return 0;
  }
}

/** Resolve profiles.id for an existing account (profiles.email mirrors auth). */
async function findProfileIdByEmail(emailNorm: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: exact } = await admin
      .from("profiles")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();
    if (exact) return (exact as { id: string }).id;

    const { data: ci } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", emailNorm)
      .limit(1)
      .maybeSingle();
    if (ci) return (ci as { id: string }).id;
  } catch {
    /* */
  }
  return null;
}

/**
 * Team page: invite an existing Adakaro user (must have a profile row) as school admin.
 * No email is sent; the invitee sees the pending invite after signing in.
 */
export async function submitSchoolAdminInvite(
  formData: FormData
): Promise<InviteAdminResult> {
  const rawEmail = String(formData.get("email") ?? "").trim();
  const email = normalizeEmail(rawEmail);

  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
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

  const { data: isAdmin, error: adminRpcErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );

  if (adminRpcErr || !isAdmin) {
    return {
      ok: false,
      error: "You must be a school admin to send invitations.",
    };
  }

  const schoolPlanRow = await loadSchoolPlanRowForInvite(supabase, schoolId);
  if (schoolPlanRow === null) {
    return {
      ok: false,
      error:
        "Could not load school. If this continues, confirm SUPABASE_SERVICE_ROLE_KEY is set on the server.",
    };
  }

  const plan = normalizePlanId(schoolPlanRow.plan);
  const maxAdmins = effectiveAdminLimit(schoolPlanRow);

  const adminCount = await countAdmins(supabase, schoolId);
  if (adminCount === null) {
    return { ok: false, error: "Could not verify admin seats." };
  }

  const pendingCount = await countPendingInvites(supabase, schoolId);
  const usedSlots = adminCount + pendingCount;

  inviteLog("plan limit check", {
    plan,
    maxAdmins,
    currentAdminCount: adminCount,
    pendingInviteCount: pendingCount,
    usedSlots,
    withinLimit: maxAdmins == null || usedSlots < maxAdmins,
    schoolId,
  });

  if (maxAdmins != null && usedSlots >= maxAdmins) {
    return {
      ok: false,
      error: `You've reached your admin limit (${maxAdmins}). Upgrade to add more admins. Current plan: ${planDisplayName(plan)}.`,
    };
  }

  const callerEmail = normalizeEmail(user.email ?? "");
  if (callerEmail && email === callerEmail) {
    return { ok: false, error: "You cannot invite yourself." };
  }

  const { data: alreadyAdmin, error: dupErr } = await supabase.rpc(
    "is_email_already_school_admin",
    { p_school_id: schoolId, p_email: email } as never
  );

  if (dupErr) {
    return { ok: false, error: "Could not verify invitee." };
  }

  if (alreadyAdmin) {
    return {
      ok: false,
      error: "This user is already an administrator for your school.",
    };
  }

  const inviteeProfileId = await findProfileIdByEmail(email);
  if (!inviteeProfileId) {
    inviteLog("profile lookup: no profile for email", {
      email,
      schoolId,
      inviterUserId: user.id,
    });
    return {
      ok: false,
      error:
        "User does not have an Adakaro account. They need to sign up first.",
    };
  }
  inviteLog("profile lookup: found existing user", {
    email,
    profileId: inviteeProfileId,
    schoolId,
  });

  const token = randomBytes(32).toString("hex");

  const payload = {
    school_id: schoolId,
    invited_email: email,
    invited_by: user.id,
    token,
    status: "pending" as const,
  };

  function isTablePermissionError(err: {
    code?: string;
    message?: string;
  } | null): boolean {
    if (!err) return false;
    const code = String(err.code ?? "");
    const msg = String(err.message ?? "").toLowerCase();
    return (
      code === "42501" ||
      code === "PGRST301" ||
      msg.includes("permission denied") ||
      msg.includes("42501") ||
      msg.includes("infinite recursion") ||
      msg.includes("row-level security")
    );
  }

  async function insertInvitationWithAdminFallback(): Promise<{
    ok: true;
  } | { ok: false; error: string }> {
    const insertPayloadLog = {
      school_id: payload.school_id,
      invited_email: payload.invited_email,
      invited_by: payload.invited_by,
      status: payload.status,
      tokenLength: payload.token.length,
      tokenPrefix: `${payload.token.slice(0, 8)}…`,
    };

    inviteLog("insert attempt: user client (RLS)", {
      ...insertPayloadLog,
    });

    const userInsert = await supabase
      .from("school_invitations")
      .insert(payload as never);

    if (!userInsert.error) {
      const inserted = userInsert.data as unknown;
      const rowCount = Array.isArray(inserted)
        ? inserted.length
        : inserted
          ? 1
          : 0;
      inviteLog("insert result: user client succeeded", {
        rowCount,
        hasData: Boolean(userInsert.data),
      });
      return { ok: true };
    }

    inviteLog("insert error: user client", {
      code: userInsert.error.code,
      message: userInsert.error.message,
      details: userInsert.error.details,
      hint: userInsert.error.hint,
      willRetryWithServiceRole: isTablePermissionError(userInsert.error),
    });

    if (userInsert.error.code === "23505") {
      return {
        ok: false,
        error:
          "A pending invitation for this email already exists for your school.",
      };
    }

    if (!isTablePermissionError(userInsert.error)) {
      return {
        ok: false,
        error:
          userInsert.error.message || "Could not create invitation.",
      };
    }

    inviteLog("insert retry: service role (createAdminClient)", {
      ...insertPayloadLog,
    });

    try {
      const admin = createAdminClient();
      const adminInsert = await admin
        .from("school_invitations")
        .insert(payload as never);

      if (!adminInsert.error) {
        const inserted = adminInsert.data as unknown;
        const rowCount = Array.isArray(inserted)
          ? inserted.length
          : inserted
            ? 1
            : 0;
        inviteLog("insert result: service role succeeded", {
          rowCount,
          hasData: Boolean(adminInsert.data),
        });
        return { ok: true };
      }

      inviteLog("insert error: service role client", {
        code: adminInsert.error.code,
        message: adminInsert.error.message,
        details: adminInsert.error.details,
        hint: adminInsert.error.hint,
      });

      return {
        ok: false,
        error:
          adminInsert.error.message ||
          userInsert.error.message ||
          "Could not create invitation.",
      };
    } catch (e) {
      inviteLog("insert exception: service role path threw", {
        name: e instanceof Error ? e.name : typeof e,
        message: e instanceof Error ? e.message : String(e),
      });
      return {
        ok: false,
        error:
          userInsert.error.message ||
          (e instanceof Error
            ? e.message
            : "Could not create invitation. Check SUPABASE_SERVICE_ROLE_KEY and DB grants for school_invitations."),
      };
    }
  }

  const insertResult = await insertInvitationWithAdminFallback();
  if (!insertResult.ok) {
    return { ok: false, error: insertResult.error };
  }

  return { ok: true, email };
}

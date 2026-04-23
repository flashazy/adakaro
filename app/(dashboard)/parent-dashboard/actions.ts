"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface LinkRequestState {
  error?: string;
  success?: string;
  /** Shown as Sonner toast only (e.g. max parent slots) — not inline form error. */
  toastError?: string;
}

export async function submitLinkRequest(
  _prevState: LinkRequestState,
  formData: FormData
): Promise<LinkRequestState> {
  const admissionNumber = (formData.get("admission_number") as string)?.trim();

  if (!admissionNumber) {
    return { error: "Admission number is required." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated." };

    // Prefer a school where this parent already has a linked child (avoids wrong school when
    // the same admission number exists in multiple schools).
    const { data: linkRows } = await supabase
      .from("parent_students")
      .select("students(school_id)")
      .eq("parent_id", user.id)
      .limit(1);

    const firstLink = linkRows?.[0] as
      | { students: { school_id: string } | null }
      | undefined;
    const preferSchoolId = firstLink?.students?.school_id ?? null;

    // Use SECURITY DEFINER function to look up student without RLS restrictions
    const { data: result, error: rpcError } = await supabase.rpc(
      "lookup_student_by_admission",
      {
        adm_number: admissionNumber,
        p_prefer_school_id: preferSchoolId,
      } as never
    );

    if (rpcError) {
      return { error: "Something went wrong. Please try again." };
    }

    const resultTyped = result as { student_id: string; school_id: string }[] | null;
    if (!resultTyped || resultTyped.length === 0) {
      return {
        error:
          "No student found with that admission number. Please check and try again.",
      };
    }

    const { student_id, school_id } = resultTyped[0];

    const admin = createAdminClient();
    const { count: approvedParentCount, error: countErr } = await admin
      .from("parent_students")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student_id);

    if (countErr) {
      console.error("[submitLinkRequest] parent_students count", countErr);
      return { error: "Something went wrong. Please try again." };
    }

    if ((approvedParentCount ?? 0) >= 2) {
      return {
        toastError:
          "This student already has the maximum of 2 connected parents. No additional requests can be sent.",
      };
    }

    // Check if a pending request already exists for this parent + student
    const { data: existing } = await supabase
      .from("parent_link_requests")
      .select("id, status")
      .eq("parent_id", user.id)
      .eq("student_id", student_id)
      .in("status", ["pending"])
      .maybeSingle();

    if (existing) {
      return {
        error:
          "You already have a pending request for this student. Please wait for the school to approve it.",
      };
    }

    // Check if already linked
    const { data: alreadyLinked } = await supabase
      .from("parent_students")
      .select("id")
      .eq("parent_id", user.id)
      .eq("student_id", student_id)
      .maybeSingle();

    if (alreadyLinked) {
      return { error: "This student is already linked to your account." };
    }

    // Insert the link request
    const { error: insertError } = await supabase
      .from("parent_link_requests")
      .insert({
        parent_id: user.id,
        admission_number: admissionNumber,
        student_id,
        school_id,
        status: "pending",
      } as never);

    if (insertError) {
      return { error: insertError.message };
    }

    revalidatePath("/parent-dashboard");
    return {
      success:
        "Request sent to the school. You will be notified when approved.",
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cancelPendingLinkRequest(
  requestId: string
): Promise<{ error?: string; success?: string }> {
  if (!requestId?.trim()) {
    return { error: "Request not found." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated." };

    const { data: deleted, error } = await supabase
      .from("parent_link_requests")
      .delete()
      .eq("id", requestId)
      .eq("parent_id", user.id)
      .eq("status", "pending")
      .select("id");

    if (error) {
      return { error: error.message };
    }
    if (!deleted?.length) {
      return {
        error:
          "Could not cancel this request. It may have already been approved or removed.",
      };
    }

    revalidatePath("/parent-dashboard");
    return { success: "Request cancelled. You can send a new one if needed." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Keep JWT in sync with profiles/school_members so middleware allows /dashboard. */
async function syncAuthMetadataRoleAdmin(
  userId: string,
  userMetadata: Record<string, unknown> | null | undefined
): Promise<void> {
  try {
    const svc = createAdminClient();
    const base =
      userMetadata &&
      typeof userMetadata === "object" &&
      !Array.isArray(userMetadata)
        ? { ...userMetadata }
        : {};
    await svc.auth.admin.updateUserById(userId, {
      user_metadata: { ...base, role: "admin" },
    });
  } catch (e) {
    console.error("[parent-invite-accept] auth.admin.updateUserById", e);
  }
}

const ACCEPT_INVITE_ERRORS: Record<string, string> = {
  invalid_or_expired: "This invitation is invalid or has expired.",
  email_mismatch:
    "This invitation was sent to a different email address than the one you’re signed in with.",
  not_authenticated: "You must be signed in to accept.",
  no_email: "Your account has no email; contact support.",
  already_member: "You are already a member of this school.",
};

/**
 * Accept admin invite using the service role after session checks.
 * The DB RPC `accept_school_invitation` often returns invalid_or_expired because
 * its first SELECT on `school_invitations` is still subject to RLS, and invitees
 * are not school admins — so the row is invisible to the function.
 */
export type AcceptSchoolAdminInviteResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export async function acceptSchoolAdminInvite(
  token: string
): Promise<AcceptSchoolAdminInviteResult> {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Missing invitation." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email?.trim()) {
      return { ok: false, error: "Not authenticated." };
    }

    const sessionEmail = normalizeEmail(user.email);

    console.log("[parent-invite-accept] start", {
      tokenLength: trimmed.length,
      tokenPrefix: `${trimmed.slice(0, 8)}…`,
      userId: user.id,
      sessionEmail,
    });

    const admin = createAdminClient();

    const { data: inv, error: fetchErr } = await admin
      .from("school_invitations")
      .select("id, school_id, invited_email, status, expires_at")
      .eq("token", trimmed)
      .maybeSingle();

    if (fetchErr) {
      console.error("[parent-invite-accept] load invitation failed", fetchErr);
      return {
        ok: false,
        error: fetchErr.message || "Could not load invitation.",
      };
    }

    if (!inv) {
      console.log("[parent-invite-accept] no invitation row for token");
      return {
        ok: false,
        error: ACCEPT_INVITE_ERRORS.invalid_or_expired,
      };
    }

    const row = inv as {
      id: string;
      school_id: string;
      invited_email: string;
      status: string;
      expires_at: string;
    };

    if (row.status !== "pending") {
      console.log("[parent-invite-accept] not pending", { status: row.status });
      return {
        ok: false,
        error: ACCEPT_INVITE_ERRORS.invalid_or_expired,
      };
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      console.log("[parent-invite-accept] expired", { expires_at: row.expires_at });
      return {
        ok: false,
        error: ACCEPT_INVITE_ERRORS.invalid_or_expired,
      };
    }

    if (normalizeEmail(row.invited_email) !== sessionEmail) {
      console.log("[parent-invite-accept] email mismatch", {
        invited_email: row.invited_email,
        sessionEmail,
      });
      return {
        ok: false,
        error: ACCEPT_INVITE_ERRORS.email_mismatch,
      };
    }

    const nowIso = new Date().toISOString();

    const { data: existingMember } = await admin
      .from("school_members")
      .select("id")
      .eq("school_id", row.school_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      await admin
        .from("profiles")
        .update({ role: "admin", updated_at: nowIso } as never)
        .eq("id", user.id);

      const { error: markErr } = await admin
        .from("school_invitations")
        .update({
          status: "accepted",
          accepted_at: nowIso,
        } as never)
        .eq("id", row.id);

      if (markErr) {
        console.error("[parent-invite-accept] mark accepted (member)", markErr);
        return { ok: false, error: markErr.message };
      }

      await syncAuthMetadataRoleAdmin(
        user.id,
        user.user_metadata as Record<string, unknown> | null | undefined
      );

      console.log("[parent-invite-accept] ok (already school member)", {
        school_id: row.school_id,
      });
      revalidatePath("/parent-dashboard");
      revalidatePath("/dashboard");
      return {
        ok: true,
        redirectTo: "/dashboard?adminInviteAccepted=1",
      };
    }

    const { error: insErr } = await admin
      .from("school_members")
      .insert({
        school_id: row.school_id,
        user_id: user.id,
        role: "admin",
      } as never);

    if (insErr) {
      console.error("[parent-invite-accept] insert school_members", insErr);
      if (insErr.code === "23505") {
        return {
          ok: false,
          error: ACCEPT_INVITE_ERRORS.already_member,
        };
      }
      return { ok: false, error: insErr.message };
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update({ role: "admin", updated_at: nowIso } as never)
      .eq("id", user.id);

    if (profileErr) {
      console.error("[parent-invite-accept] update profiles", profileErr);
      return { ok: false, error: profileErr.message };
    }

    const { error: invUpErr } = await admin
      .from("school_invitations")
      .update({
        status: "accepted",
        accepted_at: nowIso,
      } as never)
      .eq("id", row.id);

    if (invUpErr) {
      console.error("[parent-invite-accept] update invitation", invUpErr);
      return { ok: false, error: invUpErr.message };
    }

    await syncAuthMetadataRoleAdmin(
      user.id,
      user.user_metadata as Record<string, unknown> | null | undefined
    );

    console.log("[parent-invite-accept] ok", {
      school_id: row.school_id,
      invitation_id: row.id,
    });

    revalidatePath("/parent-dashboard");
    revalidatePath("/dashboard");
    return {
      ok: true,
      redirectTo: "/dashboard?adminInviteAccepted=1",
    };
  } catch (e) {
    console.error("[parent-invite-accept] exception", e);
    return { ok: false, error: (e as Error).message };
  }
}

export async function declineSchoolAdminInvite(
  invitationId: string
): Promise<{ error?: string; success?: string }> {
  const id = String(invitationId ?? "").trim();
  if (!id) {
    return { error: "Invalid invitation." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { error: "Not authenticated." };
    }

    const callerEmail = normalizeEmail(user.email);

    const admin = createAdminClient();
    const { data: inv, error: fetchErr } = await admin
      .from("school_invitations")
      .select("id, invited_email, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !inv) {
      return { error: "Invitation not found." };
    }

    const row = inv as {
      id: string;
      invited_email: string;
      status: string;
    };

    if (row.status !== "pending") {
      return { error: "This invitation is no longer pending." };
    }

    if (normalizeEmail(row.invited_email) !== callerEmail) {
      return { error: "You cannot decline an invitation sent to someone else." };
    }

    console.log("[parent-invite-decline] updating", { invitationId: id });

    const { data: updated, error: updateErr } = await admin
      .from("school_invitations")
      .update({ status: "expired" } as never)
      .eq("id", id)
      .eq("status", "pending")
      .select("id");

    if (updateErr) {
      console.error("[parent-invite-decline] update failed", updateErr);
      return { error: updateErr.message };
    }

    if (!updated?.length) {
      console.log("[parent-invite-decline] no row updated");
      return {
        error:
          "Could not decline this invitation. It may have already been used or removed.",
      };
    }

    console.log("[parent-invite-decline] ok", { invitationId: id });

    revalidatePath("/parent-dashboard");
    return { success: "Invitation declined." };
  } catch (e) {
    console.error("[parent-invite-decline] exception", e);
    return { error: (e as Error).message };
  }
}

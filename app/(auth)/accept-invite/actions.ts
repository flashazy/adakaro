"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type InvitePreviewState =
  | { ok: true; email: string }
  | { ok: false; error: string };

export async function getTeacherInvitePreview(
  token: string
): Promise<InvitePreviewState> {
  const t = token.trim();
  if (!t) {
    return { ok: false, error: "Invalid invitation link." };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("teacher_invitations")
    .select("email, expires_at, used_at")
    .eq("token", t)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "This invitation is invalid or has expired." };
  }

  const r = row as {
    email: string;
    expires_at: string;
    used_at: string | null;
  };

  if (r.used_at) {
    return {
      ok: false,
      error: "This invitation has already been used. Sign in with your email.",
    };
  }

  if (new Date(r.expires_at) < new Date()) {
    return { ok: false, error: "This invitation has expired." };
  }

  return { ok: true, email: r.email };
}

export type AcceptInviteState =
  | { ok: true }
  | { ok: false; error: string };

export async function acceptTeacherInviteAction(
  _prev: AcceptInviteState | null,
  formData: FormData
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!token) {
    return { ok: false, error: "Missing invitation token." };
  }
  if (!fullName || fullName.length < 2) {
    return { ok: false, error: "Please enter your full name." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }

  const admin = createAdminClient() as SupabaseClient<Database>;

  const { data: inv, error: invErr } = await admin
    .from("teacher_invitations")
    .select(
      "id, email, school_id, class_id, subject, academic_year, expires_at, used_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (invErr || !inv) {
    return { ok: false, error: "This invitation is invalid or has expired." };
  }

  const invite = inv as {
    id: string;
    email: string;
    school_id: string;
    class_id: string | null;
    subject: string;
    academic_year: string;
    expires_at: string;
    used_at: string | null;
  };

  if (invite.used_at) {
    return {
      ok: false,
      error: "This invitation was already used. Sign in instead.",
    };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, error: "This invitation has expired." };
  }

  if (invite.class_id) {
    const { data: cls } = await admin
      .from("classes")
      .select("school_id")
      .eq("id", invite.class_id)
      .maybeSingle();
    const sid = (cls as { school_id: string } | null)?.school_id;
    if (sid !== invite.school_id) {
      return {
        ok: false,
        error: "Invitation data is inconsistent. Contact your school admin.",
      };
    }
  }

  let newUserId: string | null = null;

  try {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "teacher",
        },
      });

    if (createErr || !created.user) {
      const msg = createErr?.message?.toLowerCase() ?? "";
      if (
        msg.includes("already been registered") ||
        msg.includes("already registered")
      ) {
        return {
          ok: false,
          error:
            "An account with this email already exists. Sign in on the login page.",
        };
      }
      return {
        ok: false,
        error: createErr?.message || "Could not create your account.",
      };
    }

    newUserId = created.user.id;

    const { error: pErr } = await (admin as Db)
      .from("profiles")
      .update({
        full_name: fullName,
        role: "teacher",
      })
      .eq("id", newUserId);

    if (pErr) {
      throw new Error(pErr.message || "Could not update profile.");
    }

    const { data: existingMember } = await admin
      .from("school_members")
      .select("id, role")
      .eq("school_id", invite.school_id)
      .eq("user_id", newUserId)
      .maybeSingle();

    if (existingMember) {
      const row = existingMember as { id: string; role: string };
      if (row.role !== "teacher") {
        const { error: memUpErr } = await (admin as Db)
          .from("school_members")
          .update({ role: "teacher" })
          .eq("id", row.id);
        if (memUpErr) {
          throw new Error(
            memUpErr.message || "Could not link you to the school as a teacher."
          );
        }
      }
    } else {
      const { error: mErr } = await (admin as Db).from("school_members").insert({
        school_id: invite.school_id,
        user_id: newUserId,
        role: "teacher",
      });

      if (mErr) {
        throw new Error(mErr.message || "Could not add you to the school.");
      }
    }

    if (invite.class_id) {
      const { error: aErr } = await (admin as Db)
        .from("teacher_assignments")
        .insert({
          teacher_id: newUserId,
          school_id: invite.school_id,
          class_id: invite.class_id,
          subject: invite.subject || "",
          academic_year: (() => {
            const raw = String(invite.academic_year ?? "").trim();
            const m = raw.match(/^(\d{4})/);
            if (m) return m[1];
            return String(new Date().getFullYear());
          })(),
        });
      if (aErr) {
        throw new Error(
          aErr.message || "Could not assign your class. Contact your admin."
        );
      }
    }

    const { error: markErr } = await (admin as Db)
      .from("teacher_invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("used_at", null);

    if (markErr) {
      throw new Error(markErr.message || "Could not finalize invitation.");
    }
  } catch (e) {
    if (newUserId) {
      try {
        await admin.auth.admin.deleteUser(newUserId);
      } catch {
        /* */
      }
    }
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
    };
  }

  revalidatePath("/dashboard/teachers");

  return redirect("/login?invited=teacher");
}

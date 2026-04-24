"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { logoVersionFromRow } from "@/lib/dashboard/resolve-school-display";

export interface CoordinatorSignatureState {
  error?: string;
  success?: boolean;
  completedAt?: number;
  publicUrl?: string | null;
  coordinatorSignatureVersion?: number;
}

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "webp"]);
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

async function userCoordinatesSchool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  schoolId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("teacher_coordinators")
    .select("id")
    .eq("teacher_id", userId)
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function removeCoordinatorSignatureStorageForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  userId: string
): Promise<void> {
  const folder = `schools/${schoolId}/coordinator-signatures`;
  const { data: listed } = await supabase.storage
    .from("school-assets")
    .list(folder);
  const prefix = `${userId}.`;
  const names = (listed ?? [])
    .map((o) => o.name)
    .filter((n) => n.startsWith(prefix));
  if (names.length === 0) return;
  await supabase.storage
    .from("school-assets")
    .remove(names.map((n) => `${folder}/${n}`));
}

export async function uploadCoordinatorSignature(
  _prev: CoordinatorSignatureState,
  formData: FormData
): Promise<CoordinatorSignatureState> {
  const raw = formData.get("coordinator_signature");
  if (raw == null) {
    return {
      error:
        "No file was included. Choose an image (PNG, JPG, JPEG, or WebP, up to 2 MB).",
    };
  }
  if (typeof raw === "string") {
    return { error: "The file did not upload correctly. Try again." };
  }
  const file = raw;
  if (!(file instanceof File) || file.size === 0) {
    return { error: "The file was empty or unreadable." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Signature must be 2 MB or smaller." };
  }
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() ?? ""
    : "";
  let ext =
    fromName && ALLOWED_EXT.has(fromName)
      ? fromName
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/jpeg"
            ? "jpg"
            : "";
  if (ext === "jpeg") ext = "jpg";
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return { error: "Use a PNG, JPG, JPEG, or WebP image." };
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return { error: "Use a PNG, JPG, JPEG, or WebP image." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in." };
  }
  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return { error: "No school found for your account." };
  }
  if (!(await userCoordinatesSchool(supabase, user.id, schoolId))) {
    return {
      error:
        "You must be assigned as a class coordinator for this school to upload a signature.",
    };
  }

  const path = `schools/${schoolId}/coordinator-signatures/${user.id}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("school-assets")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (uploadError) {
    return { error: uploadError.message || "Could not upload signature." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("school-assets").getPublicUrl(path);

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ coordinator_signature_url: publicUrl } as never)
    .eq("id", user.id)
    .select("updated_at")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  const coordinatorSignatureVersion = logoVersionFromRow(
    (updated as { updated_at: string } | null)?.updated_at
  );
  revalidatePath("/teacher-dashboard/coordinator");
  return {
    success: true,
    completedAt: coordinatorSignatureVersion,
    publicUrl,
    coordinatorSignatureVersion,
  };
}

export async function removeCoordinatorSignature(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState contract
  _prev: CoordinatorSignatureState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<CoordinatorSignatureState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in." };
  }
  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return { error: "No school found for your account." };
  }
  if (!(await userCoordinatesSchool(supabase, user.id, schoolId))) {
    return {
      error:
        "You must be assigned as a class coordinator for this school to remove your signature.",
    };
  }

  await removeCoordinatorSignatureStorageForUser(supabase, schoolId, user.id);

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ coordinator_signature_url: null } as never)
    .eq("id", user.id)
    .select("updated_at")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  const coordinatorSignatureVersion = logoVersionFromRow(
    (updated as { updated_at: string } | null)?.updated_at
  );
  revalidatePath("/teacher-dashboard/coordinator");
  return {
    success: true,
    completedAt: coordinatorSignatureVersion,
    publicUrl: null,
    coordinatorSignatureVersion,
  };
}

/**
 * School admin cleanup: clears another teacher's coordinator signature URL and
 * storage files. Does not allow arbitrary profile edits.
 */
export async function adminRemoveCoordinatorSignature(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: CoordinatorSignatureState,
  formData: FormData
): Promise<CoordinatorSignatureState> {
  const targetId = String(formData.get("target_user_id") ?? "").trim();
  if (!targetId) {
    return { error: "Missing teacher." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be logged in." };
  }
  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return { error: "No school found for your account." };
  }
  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) {
    return { error: "Only school administrators can remove this signature." };
  }
  if (targetId === user.id) {
    return removeCoordinatorSignature(_prev, new FormData());
  }

  const { data: member } = await supabase
    .from("school_members")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("user_id", targetId)
    .limit(1)
    .maybeSingle();
  if (!member) {
    return { error: "That user is not a member of your school." };
  }

  const admin = createAdminClient();
  await removeCoordinatorSignatureStorageForUser(supabase, schoolId, targetId);

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ coordinator_signature_url: null } as never)
    .eq("id", targetId)
    .select("updated_at")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  const coordinatorSignatureVersion = logoVersionFromRow(
    (updated as { updated_at: string } | null)?.updated_at
  );
  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/dashboard/teachers");
  return {
    success: true,
    completedAt: coordinatorSignatureVersion,
    publicUrl: null,
    coordinatorSignatureVersion,
  };
}

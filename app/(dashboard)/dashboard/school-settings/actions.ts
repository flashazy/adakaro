"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { logoVersionFromRow } from "@/lib/dashboard/resolve-school-display";
import {
  isSchoolCurrencyCode,
  type SchoolCurrencyCode,
} from "@/lib/currency";

export interface SchoolSettingsState {
  error?: string;
  success?: boolean;
  /** Set on each successful logo action so clients can react to repeat uploads. */
  completedAt?: number;
  /** Public storage URL saved for this upload (client bypasses CDN cache via fetch+blob). */
  publicUrl?: string | null;
  /** From `schools.updated_at` after write — use with `?v=` everywhere the logo is shown. */
  logoVersion?: number;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_EXT = new Set(["png", "jpg", "jpeg", "webp"]);
const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Schools RLS can recurse via school_members; service role bypasses for scoped updates only. */
function getSchoolsAdminOrNull() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function storagePathFromLogoPublicUrl(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("school-logos");
    if (idx === -1) return null;
    return parts.slice(idx + 1).join("/") || null;
  } catch {
    return null;
  }
}

export async function uploadSchoolLogo(
  _prev: SchoolSettingsState,
  formData: FormData
): Promise<SchoolSettingsState> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file to upload." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "Logo must be 2 MB or smaller." };
  }
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() ?? ""
    : "";
  let ext =
    fromName && ALLOWED_LOGO_EXT.has(fromName)
      ? fromName
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/jpeg"
            ? "jpg"
            : "";
  if (!ext || !ALLOWED_LOGO_EXT.has(ext)) {
    return {
      error: "Use a PNG, JPG, JPEG, or WebP image.",
    };
  }
  if (file.type && !ALLOWED_LOGO_MIME.has(file.type)) {
    return {
      error: "Use a PNG, JPG, JPEG, or WebP image.",
    };
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

  const path = `${user.id}/logo.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message || "Could not upload logo." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("school-logos").getPublicUrl(path);

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not save logo URL. Check server configuration (service role).",
    };
  }

  const { data: updatedSchool, error: updateError } = await admin
    .from("schools")
    .update({ logo_url: publicUrl } as never)
    .eq("id", schoolId)
    .select("updated_at")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  const logoVersion = logoVersionFromRow(
    (updatedSchool as { updated_at: string } | null)?.updated_at
  );

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  return {
    success: true,
    completedAt: logoVersion,
    publicUrl,
    logoVersion,
  };
}

export async function removeSchoolLogo(
  _prev: SchoolSettingsState,
  _formData: FormData
): Promise<SchoolSettingsState> {
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

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not update school. Check server configuration (service role).",
    };
  }

  const { data: row } = await admin
    .from("schools")
    .select("logo_url")
    .eq("id", schoolId)
    .maybeSingle();

  const logoUrl = (row as { logo_url: string | null } | null)?.logo_url?.trim();

  if (logoUrl) {
    const storagePath = storagePathFromLogoPublicUrl(logoUrl);
    if (!storagePath) {
      const { data: listed } = await supabase.storage
        .from("school-logos")
        .list(user.id);
      const names = (listed ?? [])
        .map((o) => o.name)
        .filter((n) => /^logo\./i.test(n));
      if (names.length > 0) {
        await supabase.storage
          .from("school-logos")
          .remove(names.map((n) => `${user.id}/${n}`));
      }
    } else {
      await supabase.storage.from("school-logos").remove([storagePath]);
    }
  }

  const { data: updatedSchool, error: updateError } = await admin
    .from("schools")
    .update({ logo_url: null } as never)
    .eq("id", schoolId)
    .select("updated_at")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  const logoVersion = logoVersionFromRow(
    (updatedSchool as { updated_at: string } | null)?.updated_at
  );

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  return {
    success: true,
    completedAt: logoVersion,
    logoVersion,
    publicUrl: null,
  };
}

export async function updateSchoolCurrency(
  _prev: SchoolSettingsState,
  formData: FormData
): Promise<SchoolSettingsState> {
  const raw = String(formData.get("currency") ?? "").trim().toUpperCase();
  if (!isSchoolCurrencyCode(raw)) {
    return { error: "Please choose a valid currency." };
  }
  const currency = raw as SchoolCurrencyCode;

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

  const { error } = await supabase
    .from("schools")
    .update({ currency } as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[updateSchoolCurrency]", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  revalidatePath("/dashboard/fee-structures");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/reports");
  return { success: true };
}

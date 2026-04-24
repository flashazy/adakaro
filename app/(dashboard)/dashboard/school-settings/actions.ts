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
import { isSchoolLevel, type SchoolLevel } from "@/lib/school-level";
import type { Database } from "@/types/supabase";
import type {
  AccountSettingsState,
  SchoolSettingsState,
  TermStructureValue,
} from "./school-settings-shared";

type SchoolsUpdate = Database["public"]["Tables"]["schools"]["Update"];

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

const MAX_STAMP_BYTES = 2 * 1024 * 1024;
const ALLOWED_STAMP_EXT = new Set(["png", "jpg", "jpeg", "webp"]);
const ALLOWED_STAMP_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function storagePathFromSchoolAssetsPublicUrl(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("school-assets");
    if (idx === -1) return null;
    return parts.slice(idx + 1).join("/") || null;
  } catch {
    return null;
  }
}

export async function uploadSchoolStamp(
  _prev: SchoolSettingsState,
  formData: FormData
): Promise<SchoolSettingsState> {
  const raw = formData.get("stamp");
  if (raw == null) {
    return {
      error:
        "No file was included. Choose an image (PNG, JPG, or WebP, up to 2 MB). If the problem continues, refresh the page and try again.",
    };
  }
  if (typeof raw === "string") {
    return {
      error:
        "The file did not upload correctly. Try choosing the image again. Allowed types: PNG, JPG, WebP; max 2 MB.",
    };
  }
  const file = raw;
  if (!(file instanceof File) || file.size === 0) {
    return {
      error:
        "The file was empty or unreadable. Choose a PNG, JPG, or WebP (max 2 MB).",
    };
  }
  if (file.size > MAX_STAMP_BYTES) {
    return { error: "Stamp must be 2 MB or smaller." };
  }
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() ?? ""
    : "";
  let ext =
    fromName && ALLOWED_STAMP_EXT.has(fromName)
      ? fromName
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/jpeg"
            ? "jpg"
            : "";
  if (ext === "jpeg") ext = "jpg";
  if (!ext || !ALLOWED_STAMP_EXT.has(ext)) {
    return { error: "Use a PNG, JPG, JPEG, or WebP image." };
  }
  if (file.type && !ALLOWED_STAMP_MIME.has(file.type)) {
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
  const adminCheck = await requireSchoolAdminForSchool(supabase, schoolId);
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  const path = `schools/${schoolId}/stamp.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("school-assets")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (uploadError) {
    return { error: uploadError.message || "Could not upload stamp." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("school-assets").getPublicUrl(path);

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not save stamp URL. Check server configuration (service role).",
    };
  }

  const { data: updatedSchool, error: updateError } = await admin
    .from("schools")
    .update({ school_stamp_url: publicUrl } as never)
    .eq("id", schoolId)
    .select("updated_at")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  const stampVersion = logoVersionFromRow(
    (updatedSchool as { updated_at: string } | null)?.updated_at
  );
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/report-cards");
  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/parent-dashboard/report-card");
  return {
    success: true,
    completedAt: stampVersion,
    publicUrl,
    stampVersion,
  };
}

export async function removeSchoolStamp(
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
  const adminCheck = await requireSchoolAdminForSchool(supabase, schoolId);
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
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
    .select("school_stamp_url")
    .eq("id", schoolId)
    .maybeSingle();

  const stampUrl = (
    row as { school_stamp_url: string | null } | null
  )?.school_stamp_url?.trim();

  if (stampUrl) {
    const storagePath = storagePathFromSchoolAssetsPublicUrl(stampUrl);
    if (storagePath) {
      await supabase.storage.from("school-assets").remove([storagePath]);
    } else {
      const { data: listed } = await supabase.storage
        .from("school-assets")
        .list(`schools/${schoolId}`);
      const names = (listed ?? [])
        .map((o) => o.name)
        .filter((n) => /^stamp\./i.test(n));
      if (names.length > 0) {
        await supabase.storage
          .from("school-assets")
          .remove(names.map((n) => `schools/${schoolId}/${n}`));
      }
    }
  }

  const { data: updatedSchool, error: updateError } = await admin
    .from("schools")
    .update({ school_stamp_url: null } as never)
    .eq("id", schoolId)
    .select("updated_at")
    .maybeSingle();

  if (updateError) {
    return { error: updateError.message };
  }

  const stampVersion = logoVersionFromRow(
    (updatedSchool as { updated_at: string } | null)?.updated_at
  );
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/report-cards");
  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/parent-dashboard/report-card");
  return {
    success: true,
    completedAt: stampVersion,
    publicUrl: null,
    stampVersion,
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

  const { data: isAdmin, error: adminErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );
  if (adminErr || !isAdmin) {
    return { error: "You must be a school admin to change currency." };
  }

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not update school. Check server configuration (service role).",
    };
  }

  const { error } = await admin
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

export async function updateSchoolLevel(
  _prev: SchoolSettingsState,
  formData: FormData
): Promise<SchoolSettingsState> {
  const raw = String(formData.get("school_level") ?? "").trim().toLowerCase();
  if (!isSchoolLevel(raw)) {
    return { error: "Please choose a valid school level." };
  }
  const schoolLevel = raw as SchoolLevel;

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

  const { data: isAdmin, error: adminErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );
  if (adminErr || !isAdmin) {
    return { error: "You must be a school admin to change the school level." };
  }

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not update school. Check server configuration (service role).",
    };
  }

  const { error } = await admin
    .from("schools")
    .update({ school_level: schoolLevel } as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[updateSchoolLevel]", error);
    return { error: error.message };
  }

  // Report-card preview/PDF read this setting; refresh every page that
  // renders or generates a report card so the new rules take effect.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  revalidatePath("/teacher-dashboard");
  revalidatePath("/teacher-dashboard/report-cards");
  revalidatePath("/teacher-dashboard/coordinator");
  revalidatePath("/parent-dashboard/report-card");
  return { success: true };
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

function normalizeOptionalText(raw: FormDataEntryValue | null): string | null {
  const t = String(raw ?? "").trim();
  return t === "" ? null : t;
}

function normalizeOptionalDate(raw: FormDataEntryValue | null): string | null {
  const t = String(raw ?? "").trim();
  if (t === "") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

async function requireSchoolAdminForSchool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: isAdmin, error: adminErr } = await supabase.rpc(
    "is_school_admin",
    { p_school_id: schoolId } as never
  );
  if (adminErr || !isAdmin) {
    return { ok: false, error: "You must be a school admin to change this." };
  }
  return { ok: true };
}

export async function updateSchoolInformation(
  _prev: SchoolSettingsState,
  formData: FormData
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
  const adminCheck = await requireSchoolAdminForSchool(supabase, schoolId);
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "School name is required." };
  }

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not update school. Check server configuration (service role).",
    };
  }

  const payload: SchoolsUpdate = {
    name,
    address: normalizeOptionalText(formData.get("address")),
    city: normalizeOptionalText(formData.get("city")),
    postal_code: normalizeOptionalText(formData.get("postal_code")),
    phone: normalizeOptionalText(formData.get("phone")),
    email: normalizeOptionalText(formData.get("school_email")),
    registration_number: normalizeOptionalText(
      formData.get("registration_number")
    ),
  };

  const { error } = await admin
    .from("schools")
    .update(payload as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[updateSchoolInformation]", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/school-settings");
  return { success: true };
}

export async function updateSchoolAcademicSettings(
  _prev: SchoolSettingsState,
  formData: FormData
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
  const adminCheck = await requireSchoolAdminForSchool(supabase, schoolId);
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  const termStructureRaw = String(
    formData.get("term_structure") ?? ""
  ).trim();
  const term_structure: TermStructureValue =
    termStructureRaw === "3_terms" ? "3_terms" : "2_terms";

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not update school. Check server configuration (service role).",
    };
  }

  const payload: SchoolsUpdate = {
    current_academic_year: normalizeOptionalText(
      formData.get("current_academic_year")
    ),
    term_structure,
    term_1_start: normalizeOptionalDate(formData.get("term_1_start")),
    term_1_end: normalizeOptionalDate(formData.get("term_1_end")),
    term_2_start: normalizeOptionalDate(formData.get("term_2_start")),
    term_2_end: normalizeOptionalDate(formData.get("term_2_end")),
    term_3_start: normalizeOptionalDate(formData.get("term_3_start")),
    term_3_end: normalizeOptionalDate(formData.get("term_3_end")),
  };

  if (term_structure === "2_terms") {
    payload.term_3_start = null;
    payload.term_3_end = null;
  }

  const { error } = await admin
    .from("schools")
    .update(payload as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[updateSchoolAcademicSettings]", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/school-settings");
  return { success: true };
}

export async function updateSchoolBranding(
  _prev: SchoolSettingsState,
  formData: FormData
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
  const adminCheck = await requireSchoolAdminForSchool(supabase, schoolId);
  if (!adminCheck.ok) {
    return { error: adminCheck.error };
  }

  const motto = normalizeOptionalText(formData.get("motto"));
  const colorRaw = String(formData.get("primary_color") ?? "").trim();
  let primary_color: string | null = null;
  if (colorRaw === "") {
    primary_color = "#4f46e5";
  } else if (HEX_COLOR_RE.test(colorRaw)) {
    primary_color = colorRaw;
  } else {
    return {
      error: "Primary color must be a hex value like #4f46e5 or #rgb.",
    };
  }

  const admin = getSchoolsAdminOrNull();
  if (!admin) {
    return {
      error:
        "Could not update school. Check server configuration (service role).",
    };
  }

  const { error } = await admin
    .from("schools")
    .update({ motto, primary_color } as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[updateSchoolBranding]", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/school-settings");
  return { success: true };
}

export async function changeAccountPasswordAction(
  _prev: AccountSettingsState | null,
  formData: FormData
): Promise<AccountSettingsState> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (current.length === 0) {
    return { ok: false, error: "Enter your current password." };
  }
  if (next.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (next !== confirm) {
    return { ok: false, error: "New passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "You must be signed in." };
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (signErr) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const { error: updErr } = await supabase.auth.updateUser({ password: next });
  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/dashboard/school-settings");
  return { ok: true, message: "Password updated." };
}

export async function changeAccountEmailAction(
  _prev: AccountSettingsState | null,
  formData: FormData
): Promise<AccountSettingsState> {
  const newEmail = String(formData.get("new_email") ?? "").trim().toLowerCase();
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  if (user.email?.toLowerCase() === newEmail) {
    return { ok: false, error: "That is already your email address." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const emailRedirectTo =
    siteUrl && siteUrl.startsWith("http")
      ? `${siteUrl.replace(/\/$/, "")}/login`
      : undefined;

  const { error } = emailRedirectTo
    ? await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo }
      )
    : await supabase.auth.updateUser({ email: newEmail });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/school-settings");
  return {
    ok: true,
    message:
      "Check your inbox to confirm the new email address (link may expire).",
  };
}

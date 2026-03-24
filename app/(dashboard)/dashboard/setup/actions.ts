"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSchoolCurrencyCode } from "@/lib/currency";

export interface SetupState {
  error?: string;
}

export async function createSchool(
  _prevState: SetupState,
  formData: FormData
): Promise<SetupState> {
  const name = formData.get("name") as string;
  const address = (formData.get("address") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const email = (formData.get("email") as string) || null;
  const currencyRaw = String(formData.get("currency") ?? "")
    .trim()
    .toUpperCase();
  const admissionPrefixRaw = String(
    formData.get("admission_prefix") ?? ""
  ).trim();
  const p_admission_prefix =
    admissionPrefixRaw === ""
      ? null
      : admissionPrefixRaw.toUpperCase();
  const logo = formData.get("logo") as File | null;

  if (!name.trim()) {
    return { error: "School name is required." };
  }

  if (!isSchoolCurrencyCode(currencyRaw)) {
    return { error: "Please select a valid currency." };
  }

  if (
    p_admission_prefix != null &&
    !/^[A-Z]{3,4}$/.test(p_admission_prefix)
  ) {
    return {
      error:
        "Admission prefix must be 3–4 letters (A–Z), or leave blank to auto-generate from the school name.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  console.log("[createSchool] user.id:", user.id);
  console.log("[createSchool] user.role:", user.user_metadata?.role);

  // Upload logo if provided
  let logo_url: string | null = null;

  if (logo && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024) {
      return { error: "Logo must be under 2 MB." };
    }

    const ext = logo.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("school-logos")
      .upload(path, logo, { upsert: true });

    if (uploadError) {
      return { error: `Logo upload failed: ${uploadError.message}` };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("school-logos").getPublicUrl(path);

    logo_url = publicUrl;
  }

  const { data: schoolId, error: rpcError } = await supabase.rpc(
    "create_founding_school",
    {
      p_name: name.trim(),
      p_address: address,
      p_phone: phone,
      p_email: email,
      p_logo_url: logo_url,
      p_currency: currencyRaw,
      p_admission_prefix: p_admission_prefix,
    } as never
  );

  if (rpcError) {
    console.error("[createSchool] create_founding_school error:", rpcError);
    return { error: rpcError.message };
  }

  if (!schoolId) {
    return { error: "School was not created." };
  }

  redirect("/dashboard");
}

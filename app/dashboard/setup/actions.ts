"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const logo = formData.get("logo") as File | null;

  if (!name.trim()) {
    return { error: "School name is required." };
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

  const { data: school, error: insertError } = await supabase
    .from("schools")
    .insert({
      name: name.trim(),
      address,
      phone,
      email,
      logo_url,
    } as never)
    .select("id")
    .single();

  if (insertError) {
    console.error("[createSchool] schools insert error:", insertError);
    return { error: insertError.message };
  }

  const schoolTyped = school as { id: string };
  console.log("[createSchool] school created:", schoolTyped.id);

  // Link this admin to the school
  const { error: memberError } = await supabase
    .from("school_members")
    .insert({
      school_id: schoolTyped.id,
      user_id: user.id,
      role: "admin" as const,
    } as never);

  if (memberError) {
    console.error("[createSchool] school_members insert error:", memberError);
    return { error: memberError.message };
  }

  console.log("[createSchool] admin linked to school successfully");

  redirect("/dashboard");
}

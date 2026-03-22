import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSchoolCurrencyCode } from "@/lib/currency";

/**
 * POST /api/schools/create
 * Multipart form: name (required), address, phone, email, logo (optional file).
 * Uses create_founding_school RPC after optional logo upload to storage.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("[api/schools/create] getUser error:", userError);
      return NextResponse.json(
        { error: userError.message || "Session error", code: userError.code },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized — not signed in. Refresh the page and log in again.",
        },
        { status: 401 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "School name is required." },
        { status: 400 }
      );
    }

    const address = String(formData.get("address") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const email = String(formData.get("email") ?? "").trim() || null;
    const currencyRaw = String(formData.get("currency") ?? "")
      .trim()
      .toUpperCase();
    const logo = formData.get("logo");

    if (!isSchoolCurrencyCode(currencyRaw)) {
      return NextResponse.json(
        { error: "Please select a valid currency (TZS, KES, UGX, or USD)." },
        { status: 400 }
      );
    }
    const currency = currencyRaw;

    let logo_url: string | null = null;

    if (logo instanceof File && logo.size > 0) {
      if (logo.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Logo must be under 2 MB." },
          { status: 400 }
        );
      }

      const ext = logo.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("school-logos")
        .upload(path, logo, { upsert: true });

      if (uploadError) {
        return NextResponse.json(
          {
            error: `Logo upload failed: ${uploadError.message}`,
            code: uploadError.name,
          },
          { status: 400 }
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("school-logos").getPublicUrl(path);
      logo_url = publicUrl;
    }

    const { data: schoolId, error: rpcError } = await supabase.rpc(
      "create_founding_school",
      {
        p_name: name,
        p_address: address,
        p_phone: phone,
        p_email: email,
        p_logo_url: logo_url,
        p_currency: currency,
      } as never
    );

    if (rpcError) {
      console.error("[api/schools/create] RPC error:", rpcError);
      return NextResponse.json(
        {
          error:
            rpcError.message ||
            "Database rejected school creation (is create_founding_school deployed?)",
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint,
        },
        { status: 422 }
      );
    }

    const id = schoolId as string | null;
    if (!id) {
      return NextResponse.json(
        {
          error:
            "School was not created (empty response from create_founding_school).",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, school_id: id },
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  } catch (err) {
    console.error("[api/schools/create] unexpected:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

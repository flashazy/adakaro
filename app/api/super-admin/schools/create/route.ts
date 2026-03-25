import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { isSchoolCurrencyCode } from "@/lib/currency";
import { normalizePlanId } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await checkIsSuperAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: {
    name?: string;
    currency?: string;
    plan?: string;
    adminEmail?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
  if (!name || !adminEmail) {
    return NextResponse.json(
      { error: "School name and admin email are required." },
      { status: 400 }
    );
  }

  const currencyRaw = String(body.currency ?? "TZS").trim().toUpperCase();
  if (!isSchoolCurrencyCode(currencyRaw)) {
    return NextResponse.json({ error: "Invalid currency." }, { status: 400 });
  }

  const plan = normalizePlanId(body.plan ?? "free");

  const { data: adminProfile, error: profErr } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", adminEmail)
    .maybeSingle();

  if (profErr || !adminProfile) {
    return NextResponse.json(
      {
        error:
          "No profile found for that email. The user must sign up first so their profile exists.",
      },
      { status: 400 }
    );
  }

  const adminUserId = (adminProfile as { id: string }).id;

  const { data: schoolId, error: rpcErr } = await supabase.rpc(
    "super_admin_create_school",
    {
      p_name: name,
      p_currency: currencyRaw,
      p_plan: plan,
      p_admin_user_id: adminUserId,
    } as never
  );

  if (rpcErr) {
    console.error("[super-admin/create-school]", rpcErr);
    return NextResponse.json(
      { error: rpcErr.message || "Could not create school." },
      { status: 500 }
    );
  }

  const id =
    schoolId != null && String(schoolId).trim() !== ""
      ? String(schoolId).trim()
      : "";
  if (!id) {
    return NextResponse.json(
      { error: "School was not created (no id returned)." },
      { status: 500 }
    );
  }

  const address = String(body.address ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const schoolEmail = String(body.email ?? "").trim();
  if (address || phone || schoolEmail) {
    try {
      const admin = createAdminClient();
      const { error: patchErr } = await admin
        .from("schools")
        .update({
          ...(address ? { address } : {}),
          ...(phone ? { phone } : {}),
          ...(schoolEmail ? { email: schoolEmail } : {}),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (patchErr) {
        console.error(
          "[super-admin/create-school] optional contact update",
          patchErr
        );
      }
    } catch (e) {
      console.error("[super-admin/create-school] optional contact update", e);
    }
  }

  return NextResponse.json({ ok: true, schoolId: id });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { isSchoolCurrencyCode } from "@/lib/currency";

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

  let body: { schoolId?: string; name?: string; currency?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const schoolId = String(body.schoolId ?? "").trim();
  const name = String(body.name ?? "").trim();
  const currencyRaw = String(body.currency ?? "").trim().toUpperCase();

  if (!schoolId || !name) {
    return NextResponse.json(
      { error: "schoolId and name are required." },
      { status: 400 }
    );
  }

  if (!isSchoolCurrencyCode(currencyRaw)) {
    return NextResponse.json({ error: "Invalid currency." }, { status: 400 });
  }

  const { error } = await supabase
    .from("schools")
    .update({
      name,
      currency: currencyRaw,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", schoolId);

  if (error) {
    console.error("[super-admin/edit]", error);
    return NextResponse.json(
      { error: error.message || "Update failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

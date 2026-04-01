import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderReference = req.nextUrl.searchParams.get("orderReference");
  if (!orderReference?.trim()) {
    return NextResponse.json(
      { error: "orderReference is required" },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[school-reactivation status] admin client:", e);
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const { data: row, error } = await admin
    .from("school_reactivation_bills")
    .select("id, status, school_id")
    .eq("order_reference", orderReference.trim())
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[school-reactivation status]", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const bill = row as {
    id: string;
    status: string;
    school_id: string;
  } | null;

  if (!bill) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  let schoolActive = false;
  if (bill.status === "paid") {
    const { data: school } = await admin
      .from("schools")
      .select("status")
      .eq("id", bill.school_id)
      .maybeSingle();
    const s = school as { status: string } | null;
    schoolActive = s?.status === "active";
  }

  return NextResponse.json({
    status: bill.status,
    schoolActive,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type Row = Database["public"]["Tables"]["admin_report_preferences"]["Row"];

const defaults: Omit<Row, "id" | "created_at" | "updated_at"> = {
  enabled: false,
  frequency: null,
  day_of_week: 1,
  day_of_month: 1,
  recipients: [],
  export_to_email_enabled: false,
  last_sent: null,
};

export async function GET() {
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

  /* eslint-disable @typescript-eslint/no-explicit-any -- table types align with DB; Supabase client infers Insert as never for this table */
  const { data, error } = await (supabase as any)
    .from("admin_report_preferences")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[reports/preferences] GET", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ preferences: { ...defaults, id: null } });
  }

  return NextResponse.json({ preferences: data });
}

interface PutBody {
  enabled?: boolean;
  frequency?: "weekly" | "monthly" | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  recipients?: string[];
  export_to_email_enabled?: boolean;
}

export async function PUT(request: NextRequest) {
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

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { data: existing } = await (supabase as any)
    .from("admin_report_preferences")
    .select("id")
    .limit(1)
    .maybeSingle();

  const row = {
    enabled: body.enabled ?? defaults.enabled,
    frequency: body.frequency ?? defaults.frequency,
    day_of_week: body.day_of_week ?? defaults.day_of_week,
    day_of_month: body.day_of_month ?? defaults.day_of_month,
    recipients: Array.isArray(body.recipients) ? body.recipients : defaults.recipients,
    export_to_email_enabled:
      body.export_to_email_enabled ?? defaults.export_to_email_enabled,
  };

  if (existing?.id) {
    const { data, error } = await (supabase as any)
      .from("admin_report_preferences")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ preferences: data });
  }

  const { data, error } = await (supabase as any)
    .from("admin_report_preferences")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}

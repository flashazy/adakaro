import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAnalyticsReportEmails } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function utcMondayStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function shouldSendScheduledReport(
  prefs: {
    enabled: boolean;
    frequency: string | null;
    day_of_week: number | null;
    day_of_month: number | null;
    last_sent: string | null;
  },
  now: Date
): boolean {
  if (!prefs.enabled) return false;
  if (prefs.frequency === "weekly") {
    const dow = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
    if (prefs.day_of_week != null && dow !== prefs.day_of_week) return false;
    if (!prefs.last_sent) return true;
    const last = new Date(prefs.last_sent);
    return utcMondayStart(last).getTime() < utcMondayStart(now).getTime();
  }
  if (prefs.frequency === "monthly") {
    const dom = prefs.day_of_month ?? 1;
    if (now.getUTCDate() !== dom) return false;
    if (!prefs.last_sent) return true;
    const last = new Date(prefs.last_sent);
    return (
      last.getUTCMonth() !== now.getUTCMonth() ||
      last.getUTCFullYear() !== now.getUTCFullYear()
    );
  }
  return false;
}

/**
 * Vercel Cron or external scheduler: GET with Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any -- see preferences route */
  const { data: prefs, error } = await (admin as any)
    .from("admin_report_preferences")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!prefs?.enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const now = new Date();
  if (!shouldSendScheduledReport(prefs, now)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_due" });
  }

  const extra = (prefs.recipients as string[] | null) ?? [];
  const sent = await sendAnalyticsReportEmails({
    extraRecipients: extra.length > 0 ? extra : undefined,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.message }, { status: 500 });
  }

  const id = prefs.id as string;
  await (admin as any)
    .from("admin_report_preferences")
    .update({ last_sent: now.toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true, sent: true });
}

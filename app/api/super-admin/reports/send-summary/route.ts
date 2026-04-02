import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { sendAnalyticsReportEmails } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let extraRecipients: string[] | undefined;

  if (isCron) {
    try {
      const admin = createAdminClient();
      const { data: prefs } = await (admin as any)
        .from("admin_report_preferences")
        .select("recipients")
        .limit(1)
        .maybeSingle();
      const r = (prefs?.recipients as string[] | null) ?? [];
      if (r.length > 0) {
        extraRecipients = r;
      }
    } catch {
      /* ignore */
    }
  }

  if (!isCron) {
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

    try {
      const body = (await request.json()) as { recipients?: string[] };
      if (Array.isArray(body.recipients) && body.recipients.length > 0) {
        extraRecipients = body.recipients;
      }
    } catch {
      /* optional body */
    }
  }

  const sent = await sendAnalyticsReportEmails({
    extraRecipients,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

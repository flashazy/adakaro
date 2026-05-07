import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { setCaptureCardSessionOnResponse } from "@/lib/capture-card/session";
import { hashEnrollmentDeskAccessToken } from "@/lib/enrollment-desk/token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

function errorRedirect(request: NextRequest) {
  const u = request.nextUrl.clone();
  u.pathname = "/enrollment-desk/access/error";
  u.search = "";
  return NextResponse.redirect(u);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!raw) {
    return errorRedirect(request);
  }

  const admin = createAdminClient();
  const tokenHash = hashEnrollmentDeskAccessToken(raw);
  const nowIso = new Date().toISOString();

  const { data: t, error: tErr } = await admin
    .from("enrollment_desk_access_tokens")
    .select(
      "id, capture_card_user_id, school_id, expires_at, used_at, revoked_at"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tErr || !t) {
    return errorRedirect(request);
  }

  const row = t as {
    id: string;
    capture_card_user_id: string;
    school_id: string;
    expires_at: string;
    used_at: string | null;
    revoked_at: string | null;
  };

  if (row.revoked_at || row.used_at) {
    return errorRedirect(request);
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return errorRedirect(request);
  }

  const { data: ccu, error: cErr } = await admin
    .from("capture_card_users")
    .select("id, school_id, username, is_active, expires_at")
    .eq("id", row.capture_card_user_id)
    .maybeSingle();

  const cc = ccu as {
    id: string;
    school_id: string;
    username: string;
    is_active: boolean;
    expires_at: string | null;
  } | null;

  if (cErr || !cc || cc.school_id !== row.school_id) {
    return errorRedirect(request);
  }
  if (!cc.is_active) {
    return errorRedirect(request);
  }
  if (cc.expires_at && new Date(cc.expires_at).getTime() <= Date.now()) {
    return errorRedirect(request);
  }

  const { data: marked, error: mErr } = await admin
    .from("enrollment_desk_access_tokens")
    .update({ used_at: nowIso } as never)
    .eq("id", row.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .select("id")
    .maybeSingle();

  if (mErr || !marked) {
    return errorRedirect(request);
  }

  const dest = new URL("/capture-card", request.url);
  const res = NextResponse.redirect(dest);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  try {
    setCaptureCardSessionOnResponse(res, {
      v: 1,
      ccu_id: cc.id,
      school_id: cc.school_id,
      username: cc.username,
      exp,
    });
  } catch {
    return errorRedirect(request);
  }

  return res;
}

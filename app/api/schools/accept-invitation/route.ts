import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: { token?: string };
    try {
      body = (await request.json()) as { token?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const token = String(body.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc(
      "accept_school_invitation",
      { p_token: token } as never
    );

    if (error) {
      console.error("[accept-invitation] rpc", error);
      return NextResponse.json(
        { error: error.message || "Could not accept invitation." },
        { status: 500 }
      );
    }

    const result = data as {
      ok?: boolean;
      error?: string;
      school_id?: string;
    };

    if (!result?.ok) {
      const code = result?.error ?? "unknown";
      const status =
        code === "not_authenticated"
          ? 401
          : code === "email_mismatch"
            ? 403
            : code === "invalid_or_expired"
              ? 410
              : 400;
      const messages: Record<string, string> = {
        invalid_or_expired: "This invitation is invalid or has expired.",
        email_mismatch:
          "Sign in with the email address that received the invitation.",
        not_authenticated: "You must be signed in to accept.",
        no_email: "Your account has no email; contact support.",
        already_member: "You are already a member of this school.",
      };
      return NextResponse.json(
        { error: messages[code] ?? "Could not accept invitation.", code },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      schoolId: result.school_id,
    });
  } catch (e) {
    console.error("[accept-invitation]", e);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}

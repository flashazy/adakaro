import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import {
  ADMISSION_PREFIX_PATTERN,
  checkPrefixAvailableWithClient,
  normalizeAdmissionPrefixInput,
  proposeAlternativePrefixes,
  setSchoolPrefixWithClient,
} from "@/lib/admission-number";

/**
 * GET ?mode=suggest&name=School+Name — unique prefix from DB (RPC).
 * GET ?mode=check&prefix=ABC&excludeSchoolId=uuid — availability + alternatives.
 * POST { "prefix": "ABC" } — set prefix for the caller's school (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "suggest") {
      const name = String(searchParams.get("name") ?? "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "Query parameter name is required." },
          { status: 400 }
        );
      }
      const { data: suggested, error: rpcErr } = await supabase.rpc(
        "generate_unique_prefix",
        { p_school_name: name } as never
      );
      if (rpcErr) {
        return NextResponse.json(
          { error: rpcErr.message || "Suggest failed." },
          { status: 500 }
        );
      }
      const sug = suggested as string | null | undefined;
      if (typeof sug !== "string" || !sug.trim()) {
        return NextResponse.json(
          { error: "Could not suggest a prefix." },
          { status: 500 }
        );
      }
      return NextResponse.json({ suggested: sug.trim() });
    }

    if (mode === "check") {
      const prefixRaw = String(searchParams.get("prefix") ?? "").trim();
      const p = normalizeAdmissionPrefixInput(prefixRaw);
      const exclude = searchParams.get("excludeSchoolId")?.trim() || null;

      if (!ADMISSION_PREFIX_PATTERN.test(p)) {
        return NextResponse.json({
          available: false,
          normalized: p,
          alternatives: [] as string[],
          reason: "invalid_format",
        });
      }

      const available = await checkPrefixAvailableWithClient(
        supabase,
        p,
        exclude
      );
      let alternatives: string[] = [];
      if (!available) {
        alternatives = await proposeAlternativePrefixes(
          supabase,
          p,
          exclude
        );
      }
      return NextResponse.json({ available, normalized: p, alternatives });
    }

    return NextResponse.json(
      { error: "Unknown mode. Use suggest or check." },
      { status: 400 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const schoolId = await getSchoolIdForUser(supabase, user.id);
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school found for your account." },
        { status: 400 }
      );
    }

    const { data: isAdmin, error: adminErr } = await supabase.rpc(
      "is_school_admin",
      { p_school_id: schoolId } as never
    );
    if (adminErr || !isAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    let body: { prefix?: string };
    try {
      body = (await request.json()) as { prefix?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const prefixRaw = String(body.prefix ?? "").trim();
    const p = normalizeAdmissionPrefixInput(prefixRaw);

    if (!ADMISSION_PREFIX_PATTERN.test(p)) {
      const alternatives = await proposeAlternativePrefixes(
        supabase,
        deriveStemForAlternatives(prefixRaw),
        schoolId
      );
      return NextResponse.json(
        {
          error: "Admission prefix must be 3 to 4 uppercase letters (A–Z).",
          alternatives,
        },
        { status: 400 }
      );
    }

    const { data: currentRow, error: curErr } = await supabase
      .from("schools")
      .select("admission_prefix")
      .eq("id", schoolId)
      .maybeSingle();

    if (curErr) {
      return NextResponse.json({ error: curErr.message }, { status: 500 });
    }

    const current = (
      currentRow as { admission_prefix: string | null } | null
    )?.admission_prefix?.trim();
    if (current === p) {
      return NextResponse.json({ ok: true, prefix: p, unchanged: true });
    }

    const available = await checkPrefixAvailableWithClient(
      supabase,
      p,
      schoolId
    );
    if (!available) {
      const alternatives = await proposeAlternativePrefixes(
        supabase,
        p,
        schoolId
      );
      return NextResponse.json(
        {
          error: "That admission prefix is already in use by another school.",
          alternatives,
        },
        { status: 409 }
      );
    }

    try {
      await setSchoolPrefixWithClient(supabase, schoolId, p);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Update failed.";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    return NextResponse.json({ ok: true, prefix: p });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function deriveStemForAlternatives(raw: string): string {
  const letters = raw.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length >= 3) {
    return letters.slice(0, 4);
  }
  return "SCH";
}

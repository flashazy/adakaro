import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminDataClient } from "@/lib/ai-training/require-super-admin-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminDataClient();
  if ("error" in auth) return auth.error;
  const { dataClient } = auth;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(10, Number(params.get("pageSize") ?? "20")));
  const search = params.get("search")?.trim() ?? "";
  const status = params.get("status") ?? "pending";

  let query = dataClient
    .from("ai_unanswered_questions")
    .select("*", { count: "exact" })
    .order("last_seen_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (search) query = query.ilike("question", `%${search}%`);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) {
    console.error("[ai-training/unanswered] list:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type LogRow = Database["public"]["Tables"]["admin_activity_logs"]["Row"];

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
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

  let admin: SupabaseClient<Database>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[activity-logs] admin client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const userSearch = url.searchParams.get("user")?.trim() ?? "";
  const schoolSearch = url.searchParams.get("school")?.trim() ?? "";
  const actionFilter = url.searchParams.get("action")?.trim() ?? "";
  const dateFrom = url.searchParams.get("from")?.trim() ?? "";
  const dateTo = url.searchParams.get("to")?.trim() ?? "";
  const exportCsv = url.searchParams.get("export") === "csv";

  let schoolIdsFilter: string[] | null = null;
  if (schoolSearch) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        schoolSearch
      );
    if (isUuid) {
      schoolIdsFilter = [schoolSearch];
    } else {
      const { data: sch } = await admin
        .from("schools")
        .select("id")
        .ilike("name", `%${schoolSearch}%`);
      schoolIdsFilter = ((sch ?? []) as { id: string }[]).map((s) => s.id);
      if (schoolIdsFilter.length === 0) {
        if (exportCsv) {
          return new NextResponse(
            "timestamp,user_email,user_role,school_name,action,details,ip_address\n",
            {
              status: 200,
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition":
                  'attachment; filename="activity-logs.csv"',
              },
            }
          );
        }
        return NextResponse.json({
          logs: [],
          total: 0,
          page,
          pageSize: PAGE_SIZE,
          schoolNames: {},
        });
      }
    }
  }

  function applyFilters(
    q: ReturnType<SupabaseClient<Database>["from"]>
  ): ReturnType<SupabaseClient<Database>["from"]> {
    let out = q;
    if (userSearch) {
      out = out.ilike("user_email", `%${userSearch}%`);
    }
    if (actionFilter) {
      out = out.ilike("action", `%${actionFilter}%`);
    }
    if (dateFrom) {
      out = out.gte("created_at", dateFrom);
    }
    if (dateTo) {
      out = out.lte("created_at", `${dateTo}T23:59:59.999Z`);
    }
    if (schoolIdsFilter && schoolIdsFilter.length > 0) {
      out = out.in("school_id", schoolIdsFilter);
    }
    return out;
  }

  const CSV_EXPORT_MAX = 10_000;

  if (exportCsv) {
    const { data: rows, error } = await applyFilters(
      admin.from("admin_activity_logs").select("*").order("created_at", {
        ascending: false,
      })
    ).limit(CSV_EXPORT_MAX);
    if (error) {
      console.error("[activity-logs] csv", error);
      return NextResponse.json(
        { error: error.message || "Query failed." },
        { status: 500 }
      );
    }
    const logs = (rows ?? []) as LogRow[];
    const schoolIds = [
      ...new Set(
        logs.map((l) => l.school_id).filter((id): id is string => Boolean(id))
      ),
    ];
    const schoolNames: Record<string, string> = {};
    if (schoolIds.length > 0) {
      const { data: schools } = await admin
        .from("schools")
        .select("id, name")
        .in("id", schoolIds);
      for (const s of (schools ?? []) as { id: string; name: string }[]) {
        schoolNames[s.id] = s.name;
      }
    }
    const header =
      "timestamp,user_email,user_role,school_name,action,details,ip_address\n";
    const lines = logs.map((l) => {
      const schoolName = l.school_id
        ? schoolNames[l.school_id] ?? l.school_id
        : "";
      const details = JSON.stringify(l.action_details ?? {});
      return [
        csvEscape(l.created_at),
        csvEscape(l.user_email ?? ""),
        csvEscape(l.user_role),
        csvEscape(schoolName),
        csvEscape(l.action),
        csvEscape(details),
        csvEscape(l.ip_address ?? ""),
      ].join(",");
    });
    return new NextResponse(header + lines.join("\n") + (lines.length ? "\n" : ""), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="activity-logs.csv"',
      },
    });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: rows, error, count } = await applyFilters(
    admin
      .from("admin_activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
  ).range(from, to);

  if (error) {
    console.error("[activity-logs]", error);
    return NextResponse.json(
      { error: error.message || "Query failed." },
      { status: 500 }
    );
  }

  const logs = (rows ?? []) as LogRow[];
  const schoolIds = [
    ...new Set(
      logs.map((l) => l.school_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const schoolNames: Record<string, string> = {};
  if (schoolIds.length > 0) {
    const { data: schools } = await admin
      .from("schools")
      .select("id, name")
      .in("id", schoolIds);
    for (const s of (schools ?? []) as { id: string; name: string }[]) {
      schoolNames[s.id] = s.name;
    }
  }

  if (exportCsv) {
    const header =
      "timestamp,user_email,user_role,school_name,action,details,ip_address\n";
    const lines = logs.map((l) => {
      const schoolName = l.school_id
        ? schoolNames[l.school_id] ?? l.school_id
        : "";
      const details = JSON.stringify(l.action_details ?? {});
      return [
        csvEscape(l.created_at),
        csvEscape(l.user_email ?? ""),
        csvEscape(l.user_role),
        csvEscape(schoolName),
        csvEscape(l.action),
        csvEscape(details),
        csvEscape(l.ip_address ?? ""),
      ].join(",");
    });
    return new NextResponse(header + lines.join("\n") + (lines.length ? "\n" : ""), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="activity-logs.csv"',
      },
    });
  }

  return NextResponse.json({
    logs,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    schoolNames,
  });
}

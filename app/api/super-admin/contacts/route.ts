import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import { loadSuperAdminContacts } from "@/lib/super-admin/load-contacts-data";
import {
  buildContactsCsvWithMetadata,
  buildContactsExcelBuffer,
  buildExportMetadata,
} from "@/lib/super-admin/contacts-export";
import {
  buildSchoolOptions,
  computeContactCoverage,
  computeContactInsights,
  computeContactStats,
  filterSuperAdminContacts,
  parseContactFilters,
} from "@/lib/super-admin/contacts-utils";

export const dynamic = "force-dynamic";

const ALLOWED_LIMITS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

let contactsCache: {
  loadedAt: number;
  rows: Awaited<ReturnType<typeof loadSuperAdminContacts>>;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadSchoolLogos(
  admin: ReturnType<typeof createAdminClient>,
  schoolIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (schoolIds.length === 0) return map;

  const unique = [...new Set(schoolIds)];
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { data, error } = await admin
      .from("schools")
      .select("id, logo_url")
      .in("id", chunk);
    if (error) {
      console.warn("[super-admin/contacts] school logos:", error.message);
      continue;
    }
    for (const row of (data ?? []) as { id: string; logo_url: string | null }[]) {
      map.set(row.id, row.logo_url ?? null);
    }
  }
  return map;
}

async function getContactsRows() {
  const now = Date.now();
  if (contactsCache && now - contactsCache.loadedAt < CACHE_TTL_MS) {
    return contactsCache.rows;
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "SUPABASE_SERVICE_ROLE_KEY is required to load contacts.";
    throw new Error(message);
  }

  const rows = await loadSuperAdminContacts(admin);
  contactsCache = { loadedAt: now, rows };
  return rows;
}

function parseLimit(raw: string | null): number {
  const n = parseInt(raw ?? "", 10);
  if (ALLOWED_LIMITS.includes(n as (typeof ALLOWED_LIMITS)[number])) {
    return n;
  }
  return DEFAULT_PAGE_SIZE;
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

  try {
    const url = request.nextUrl;
    const filters = parseContactFilters(url.searchParams);
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") ?? "1", 10) || 1
    );
    const pageSize = parseLimit(url.searchParams.get("limit"));
    const exportFormat = url.searchParams.get("export");

    let allRows: Awaited<ReturnType<typeof loadSuperAdminContacts>>;
    try {
      allRows = await getContactsRows();
    } catch (loadError) {
      const loadMessage =
        loadError instanceof Error
          ? loadError.message
          : "Could not load contacts from the database.";
      console.error("[super-admin/contacts] load failed:", loadError);
      return NextResponse.json({ error: loadMessage }, { status: 500 });
    }
    const filtered = filterSuperAdminContacts(allRows, filters);
    const stats = computeContactStats(filtered);
    const insights = computeContactInsights(filtered);
    const coverage = computeContactCoverage(filtered, filters.type);
    const schoolOptions = buildSchoolOptions(allRows);
    const total = filtered.length;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    const lastUpdated = new Date(
      contactsCache?.loadedAt ?? Date.now()
    ).toISOString();

    let schoolLogos = new Map<string, string | null>();
    if (exportFormat !== "csv" && exportFormat !== "excel") {
      try {
        const admin = createAdminClient();
        const schoolIds = [
          ...new Set(filtered.map((row) => row.schoolId)),
        ];
        schoolLogos = await loadSchoolLogos(admin, schoolIds);
      } catch (e) {
        console.warn(
          "[super-admin/contacts] logo enrichment skipped:",
          e instanceof Error ? e.message : e
        );
      }
    }

    if (exportFormat === "csv" || exportFormat === "excel") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();
      const profileRow = profile as {
        full_name: string | null;
        email: string | null;
      } | null;
      const exportedBy =
        profileRow?.full_name?.trim() ||
        profileRow?.email?.trim() ||
        user.email ||
        "Super Admin";
      const metadata = buildExportMetadata(filters, schoolOptions, exportedBy);

      if (exportFormat === "csv") {
        const csv = buildContactsCsvWithMetadata(filtered, metadata);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="adakaro-contacts-${Date.now()}.csv"`,
          },
        });
      }

      const buffer = await buildContactsExcelBuffer(filtered, metadata);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="adakaro-contacts-${Date.now()}.xlsx"`,
        },
      });
    }

    const start = (page - 1) * pageSize;
    const contacts = filtered.slice(start, start + pageSize).map((row) => ({
      ...row,
      schoolLogoUrl: schoolLogos.get(row.schoolId) ?? null,
    }));
    const filteredPhones = [
      ...new Set(filtered.map((r) => r.phone).filter(Boolean) as string[]),
    ];
    const filteredEmails = [
      ...new Set(filtered.map((r) => r.email).filter(Boolean) as string[]),
    ];

    return NextResponse.json({
      contacts,
      stats,
      insights,
      coverage,
      schoolOptions,
      lastUpdated,
      total,
      page,
      pageSize,
      totalPages,
      filteredPhones,
      filteredEmails,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load contacts.";
    console.error("[super-admin/contacts]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

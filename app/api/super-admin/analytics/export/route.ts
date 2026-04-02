import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIsSuperAdmin } from "@/lib/super-admin";
import {
  buildAnalyticsCsv,
  loadSuperAdminAnalytics,
  parsePresetToRange,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

interface ExportBody {
  format: "csv" | "pdf";
  preset?: string;
  from?: string | null;
  to?: string | null;
}

interface DocWithLastTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

export async function POST(request: NextRequest) {
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

  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const format = body.format === "pdf" ? "pdf" : "csv";
  const presetIn = (body.preset ?? "last12m") as
    | "last30d"
    | "last3m"
    | "last6m"
    | "last12m"
    | "custom";
  const { fromIso, toIso, preset } = parsePresetToRange(
    presetIn,
    body.from,
    body.to
  );

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[api/super-admin/analytics/export] admin client", e);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const result = await loadSuperAdminAnalytics(admin, {
    fromIso,
    toIso,
    preset: String(preset),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const payload = result.data;

  if (format === "csv") {
    const csv = buildAnalyticsCsv(payload);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-${String(preset)}-${fromIso.slice(0, 10)}.csv"`,
      },
    });
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.text("Adakaro — Super Admin Analytics", margin, y);
  y += 28;
  doc.setFontSize(10);
  doc.text(
    `Range: ${payload.meta.fromIso.slice(0, 10)} → ${payload.meta.toIso.slice(0, 10)} (${payload.meta.preset}, ${payload.meta.bucketGranularity} buckets)`,
    margin,
    y
  );
  y += 20;

  const s = payload.summary;
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["New schools (range)", String(s.totalSchools)],
      ["New students (range)", String(s.totalStudents)],
      ["Revenue (range)", String(s.totalRevenue)],
      ["Active schools (platform)", String(s.activeSchools)],
      ["Suspended schools (platform)", String(s.suspendedSchools)],
      ["Total schools (platform)", String(s.totalSchoolsPlatform)],
      ["Total students (platform)", String(s.totalStudentsPlatform)],
      [
        "Growth % vs prior (schools / students / revenue)",
        `${s.growthPercent.schools ?? "—"} / ${s.growthPercent.students ?? "—"} / ${s.growthPercent.revenue ?? "—"}`,
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  y = (doc as DocWithLastTable).lastAutoTable?.finalY ?? y;
  y += 16;

  autoTable(doc, {
    startY: y,
    head: [["Bucket", "New schools", "New students", "Revenue"]],
    body: payload.monthlyTrends.map((t) => [
      t.monthLabel,
      String(t.newSchools),
      String(t.newStudents),
      String(t.revenue),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  y = (doc as DocWithLastTable).lastAutoTable?.finalY ?? y;
  y += 16;

  if (y > 620) {
    doc.addPage();
    y = margin;
  }

  autoTable(doc, {
    startY: y,
    head: [["School (revenue in range)", "Amount"]],
    body: payload.revenueBySchoolTop10.map((r) => [r.name, String(r.revenue)]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  const out = doc.output("arraybuffer");
  return new NextResponse(out, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="analytics-${String(preset)}-${fromIso.slice(0, 10)}.pdf"`,
    },
  });
}

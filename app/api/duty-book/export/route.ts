import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchoolIdForUser } from "@/lib/dashboard/get-school-id";
import { buildDutyBookCsv } from "@/lib/duty-book/build-duty-book-csv";
import {
  appendDutyBookReportToCsv,
  appendDutyBookReportToPdf,
} from "@/lib/duty-book/build-duty-book-report-export";
import { loadDutyBookReport } from "@/lib/duty-book/load-duty-book-report";
import {
  genderViewLabel,
  getDutyBookView,
} from "@/lib/duty-book/duty-book-gender";
import { loadDutyBookData } from "@/lib/duty-book/load-duty-book-data";
import type { DutyBookGenderFilter } from "@/lib/duty-book/types";
import { ILL_STATUS_DISPLAY } from "@/lib/student-attendance-status";

export const dynamic = "force-dynamic";

function cell(n: number | null): string {
  if (n === null) return "—";
  return String(n);
}

function parseGenderFilter(raw: string | null): DutyBookGenderFilter {
  if (raw === "boys" || raw === "girls") return raw;
  return "all";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const schoolId = await getSchoolIdForUser(supabase, user.id);
  if (!schoolId) {
    return NextResponse.json({ error: "No school found." }, { status: 400 });
  }

  const { canExportDutyBook } = await import("@/lib/duty-book/duty-book-access");
  const canExport = await canExportDutyBook(supabase, schoolId);
  if (!canExport) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const gender = parseGenderFilter(request.nextUrl.searchParams.get("gender"));

  const { data: schoolRow } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName =
    (schoolRow as { name: string } | null)?.name?.trim() || "School";

  const admin = createAdminClient();
  const loaded = await loadDutyBookData(
    admin,
    schoolId,
    schoolName,
    date,
    supabase
  );
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: 400 });
  }

  const view = getDutyBookView(loaded.data, gender);
  const { summary } = view;
  const safeDate = summary.date;
  const classIdsParam = request.nextUrl.searchParams.get("classIds")?.trim();
  const isFilteredExport =
    request.nextUrl.searchParams.get("filtered") === "1" && !!classIdsParam;

  let exportClasses = view.classes;
  const scopeNotes: string[] = [];
  if (gender !== "all") {
    scopeNotes.push(genderViewLabel(gender));
  }

  if (classIdsParam) {
    const idSet = new Set(
      classIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    );
    if (idSet.size === 0) {
      return NextResponse.json(
        { error: "No classes selected for export." },
        { status: 400 }
      );
    }
    exportClasses = view.classes.filter((row) => idSet.has(row.classId));
    if (exportClasses.length === 0) {
      return NextResponse.json(
        { error: "No matching classes found for export." },
        { status: 400 }
      );
    }
    if (isFilteredExport) {
      scopeNotes.push(
        `Filtered class breakdown (${exportClasses.length} of ${view.classes.length} classes)`
      );
    }
  }

  const filteredLabel =
    scopeNotes.length > 0 ? scopeNotes.join(" · ") : undefined;

  const reportPayload = await loadDutyBookReport(supabase, schoolId, safeDate);

  const genderSuffix = gender === "all" ? "" : `-${gender}`;
  const filenameBase = isFilteredExport
    ? `duty-book-filtered${genderSuffix}-${safeDate}`
    : `duty-book${genderSuffix}-${safeDate}`;

  if (format === "csv") {
    const csvLines = buildDutyBookCsv(
      loaded.data.schoolName,
      summary,
      view.classes,
      {
        classes: exportClasses,
        filteredLabel,
      }
    ).split("\n");
    appendDutyBookReportToCsv(csvLines, reportPayload);
    const csv = csvLines.join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 14;
  doc.setFontSize(16);
  doc.text("Duty Book — Attendance Summary", 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`School: ${loaded.data.schoolName}`, 14, y);
  y += 5;
  doc.text(`Date: ${safeDate}`, 14, y);
  y += 5;
  if (filteredLabel) {
    doc.text(filteredLabel, 14, y);
    y += 5;
  }
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Count"]],
    body: [
      ["Registered students", String(summary.registered)],
      ["Boys", String(summary.boys)],
      ["Girls", String(summary.girls)],
      ["Present", String(summary.present)],
      ["Absent (unexcused)", String(summary.absent)],
      [ILL_STATUS_DISPLAY, String(summary.ill)],
      ["Permitted", String(summary.permitted)],
      ["Late", String(summary.late)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const afterSummary =
    (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  autoTable(doc, {
    startY: afterSummary + 8,
    head: [
      [
        "Class",
        "Boys",
        "Girls",
        "Total",
        "Present",
        "Absent",
        ILL_STATUS_DISPLAY,
        "Permitted",
      ],
    ],
    body: exportClasses.map((row) => [
      row.className,
      String(row.boys),
      String(row.girls),
      String(row.total),
      cell(row.present),
      cell(row.absent),
      cell(row.ill),
      cell(row.permitted),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const afterClasses =
    (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  appendDutyBookReportToPdf(doc, afterClasses, reportPayload);

  const pdfBytes = doc.output("arraybuffer");
  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}

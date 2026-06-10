import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { curriculumStatusLabel } from "@/lib/curriculum-coverage/coverage-status";
import { formatStaleWarning } from "@/lib/curriculum-coverage/stale";
import type { CurriculumCoverageRow } from "@/lib/curriculum-coverage/types";

export function buildCurriculumCoveragePdf(params: {
  rows: CurriculumCoverageRow[];
  academicYear: string;
  schoolLabel?: string;
}): jsPDF {
  const doc = new jsPDF({ orientation: "landscape" });
  const { rows, academicYear, schoolLabel = "School" } = params;

  doc.setFontSize(16);
  doc.text("Curriculum Coverage Report", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${schoolLabel} · ${academicYear} Academic Year`, 14, 23);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 29);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 34,
    head: [
      [
        "Subject",
        "Class",
        "Teacher",
        "Coverage",
        "Topics",
        "Last Update",
        "Status",
        "Stale",
      ],
    ],
    body: rows.map((row) => [
      row.subjectName,
      row.className,
      row.teacherName,
      `${row.coveragePercent}%`,
      `${row.completedTopics}/${row.totalTopics}`,
      row.lastUpdateAt
        ? new Date(row.lastUpdateAt).toLocaleDateString()
        : "—",
      curriculumStatusLabel(row.status),
      formatStaleWarning(row.staleDays) || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [91, 33, 182] },
  });

  return doc;
}

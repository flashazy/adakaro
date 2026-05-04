import type {
  ProfileAttendanceSummary,
  ProfileGradebookScoreRow,
  ProfileReportCardBlock,
} from "@/lib/student-profile-auto-data";

/** Display-only strings for Student Profile header quick summary cards (server-built). */
export type StudentProfileQuickSummaryCards = {
  attendanceValue: string;
  attendanceHelper: string;
  lastExamValue: string;
  lastExamHelper: string;
  disciplineValue: string;
  disciplineHelper: string;
  disciplineTone: "ok" | "records" | "unknown";
};

function reportCardSortKey(academicYear: string, term: string): number {
  const y = parseInt(academicYear, 10);
  const yearNum = Number.isFinite(y) ? y : 0;
  const termNum = term === "Term 2" ? 2 : term === "Term 1" ? 1 : 0;
  return yearNum * 10 + termNum;
}

function parseReportPctField(s: string): number | null {
  const t = s.replace(/\u2014/g, "-").trim();
  if (!t || t === "—" || t === "-") return null;
  const n = parseFloat(t.replace(/%$/, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseScoreDisplayPct(scoreDisplay: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(scoreDisplay.trim());
  if (!m) return null;
  const a = parseFloat(m[1]!);
  const b = parseFloat(m[2]!);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return (a / b) * 100;
}

function parseGradebookTermLabel(
  label: string
): { academicYear: string; term: string } | null {
  const sep = "·";
  const idx = label.indexOf(sep);
  if (idx === -1) return null;
  const term = label.slice(0, idx).trim();
  const academicYear = label.slice(idx + sep.length).trim();
  if (!academicYear || academicYear === "—") return null;
  return { term, academicYear };
}

function averagePctFromLatestReportCard(
  blocks: ProfileReportCardBlock[]
): number | null {
  const block = blocks[0];
  if (!block?.subjectLines?.length) return null;
  const vals: number[] = [];
  for (const line of block.subjectLines) {
    const p = parseReportPctField(line.averagePct);
    if (p != null) vals.push(p);
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * When no report-card averages exist, use the gradebook term with the highest
 * (academic year, term) key and average subject assignment percentages there.
 */
function averagePctFromLatestGradebookTerm(
  rows: ProfileGradebookScoreRow[]
): number | null {
  if (!rows.length) return null;
  let bestKey = -Infinity;
  const keys: number[] = [];
  for (const r of rows) {
    const parsed = parseGradebookTermLabel(r.termLabel);
    const k = parsed
      ? reportCardSortKey(parsed.academicYear, parsed.term)
      : -Infinity;
    keys.push(k);
    if (k > bestKey) bestKey = k;
  }
  if (bestKey === -Infinity) return null;
  const pcts: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (keys[i] !== bestKey) continue;
    const p = parseScoreDisplayPct(rows[i]!.scoreDisplay);
    if (p != null) pcts.push(p);
  }
  if (!pcts.length) return null;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

function disciplineIncidentLabel(incidentType: string): string {
  const map: Record<string, string> = {
    warning: "Warning",
    detention: "Detention",
    suspension: "Suspension",
    expulsion: "Expulsion",
    other: "Other",
  };
  return map[incidentType] ?? incidentType;
}

export function buildStudentProfileQuickSummaryCards(opts: {
  attendance: ProfileAttendanceSummary;
  reportCards: ProfileReportCardBlock[];
  gradebookScores: ProfileGradebookScoreRow[];
  disciplineAvailable: boolean;
  /** Newest first (matches profile query ordering). */
  disciplineRowsOrdered: { incident_type: string }[];
}): StudentProfileQuickSummaryCards {
  const { presentDays, absentDays, lateDays } = opts.attendance;
  const totalDays = presentDays + absentDays + lateDays;
  const attendanceValue =
    totalDays > 0
      ? `${Math.round((presentDays / totalDays) * 100)}%`
      : "—";
  const attendanceHelper = "Present records";

  const fromReport = averagePctFromLatestReportCard(opts.reportCards);
  const fromGradebook =
    fromReport == null
      ? averagePctFromLatestGradebookTerm(opts.gradebookScores)
      : null;
  const examPct = fromReport ?? fromGradebook;
  const lastExamValue = examPct != null ? `${examPct}%` : "—";
  const lastExamHelper = "Latest exam";

  if (!opts.disciplineAvailable) {
    return {
      attendanceValue,
      attendanceHelper,
      lastExamValue,
      lastExamHelper,
      disciplineValue: "—",
      disciplineHelper: "Unavailable",
      disciplineTone: "unknown",
    };
  }

  const n = opts.disciplineRowsOrdered.length;
  if (n === 0) {
    return {
      attendanceValue,
      attendanceHelper,
      lastExamValue,
      lastExamHelper,
      disciplineValue: "No issues",
      disciplineHelper: "No incidents logged",
      disciplineTone: "ok",
    };
  }

  const latest = opts.disciplineRowsOrdered[0]!;
  const label = disciplineIncidentLabel(String(latest.incident_type));
  return {
    attendanceValue,
    attendanceHelper,
    lastExamValue,
    lastExamHelper,
    disciplineValue: `${n} ${n === 1 ? "record" : "records"}`,
    disciplineHelper: `Latest: ${label}`,
    disciplineTone: "records",
  };
}

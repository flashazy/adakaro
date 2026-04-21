import "server-only";

import { loadCoordinatorReportCardsForClass } from "@/app/(dashboard)/teacher-dashboard/coordinator/data";
import { termDateRange } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-dates";
import type { CoordinatorReportCardItem } from "@/app/(dashboard)/teacher-dashboard/coordinator/types";
import { resolveClassCluster } from "@/lib/class-cluster";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";
import type {
  AcademicReportLiveSupplement,
  AtRiskStudentRow,
  CompareTermOption,
  HistoricalTermSubjectMetrics,
} from "@/lib/academic-report-types";
import { normalizeSchoolLevel, type SchoolLevel } from "@/lib/school-level";
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";
import { tanzaniaLetterGrade } from "@/lib/tanzania-grades";

function parseAcademicYearBounds(
  academicYear: string
): { yStart: number; yEnd: number } | null {
  const parts = academicYear.trim().split(/[-\/]/);
  if (parts.length >= 2) {
    const yStart = parseInt(parts[0] ?? "", 10);
    const yEnd = parseInt(parts[1] ?? "", 10);
    if (Number.isFinite(yStart) && Number.isFinite(yEnd)) {
      return { yStart, yEnd };
    }
  }
  const single = parseInt(academicYear.trim(), 10);
  if (Number.isFinite(single)) {
    return { yStart: single, yEnd: single + 1 };
  }
  return null;
}

/** Calendar-adjacent prior term (Term 2 → Term 1 same year; Term 1 → Term 2 previous academic year). */
function adjacentPreviousTerm(
  term: string,
  academicYear: string
): { term: "Term 1" | "Term 2"; academicYear: string } | null {
  if (term !== "Term 1" && term !== "Term 2") return null;
  const b = parseAcademicYearBounds(academicYear);
  if (!b) return null;
  const { yStart, yEnd } = b;
  if (term === "Term 2") {
    return { term: "Term 1", academicYear: `${yStart}-${yEnd}` };
  }
  return { term: "Term 2", academicYear: `${yStart - 1}-${yEnd - 1}` };
}

function termSortKey(term: string): number {
  const m = /^Term\s+(\d+)/i.exec(term.trim());
  return m ? parseInt(m[1], 10) : 0;
}

function compareTermIdsDesc(a: CompareTermOption, b: CompareTermOption): number {
  const [ta, ya] = a.id.split("|");
  const [tb, yb] = b.id.split("|");
  const ba = parseAcademicYearBounds(ya ?? "");
  const bb = parseAcademicYearBounds(yb ?? "");
  if (ba && bb) {
    if (ba.yStart !== bb.yStart) return bb.yStart - ba.yStart;
  } else if (ya !== yb) {
    return (yb ?? "").localeCompare(ya ?? "");
  }
  return termSortKey(tb ?? "") - termSortKey(ta ?? "");
}

function metricsFromReportJson(
  raw: unknown
): HistoricalTermSubjectMetrics {
  const d = raw as AcademicPerformanceReportData | null;
  if (!d || d.version !== 1) return {};
  const out: HistoricalTermSubjectMetrics = {};
  for (const tp of d.teacher_performance ?? []) {
    const name = tp.subject?.trim() || "Subject";
    out[name] = {
      class_average_pct:
        tp.class_average_pct != null && Number.isFinite(Number(tp.class_average_pct))
          ? Number(tp.class_average_pct)
          : null,
      pass_rate_pct:
        tp.pass_rate_pct != null && Number.isFinite(Number(tp.pass_rate_pct))
          ? Number(tp.pass_rate_pct)
          : null,
    };
  }
  return out;
}

function normalizeLetter(
  grade: string | null | undefined,
  percent: number | null,
  level: SchoolLevel
): string | null {
  const g = grade?.trim();
  if (g && g !== "—" && /^[A-F]$/i.test(g)) {
    return g.toUpperCase().slice(0, 1);
  }
  if (percent != null && Number.isFinite(percent)) {
    const letter = tanzaniaLetterGrade(percent, level);
    if (letter && letter !== "—") return letter;
  }
  return null;
}

function letterRank(letter: string, level: SchoolLevel): number | null {
  const order: readonly string[] =
    level === "primary"
      ? ["A", "B", "C", "D", "E"]
      : ["A", "B", "C", "D", "F"];
  const i = order.indexOf(letter.toUpperCase());
  return i === -1 ? null : i;
}

function droppedAtLeastTwoLetterGrades(
  prevLetter: string,
  curLetter: string,
  level: SchoolLevel
): boolean {
  const pr = letterRank(prevLetter, level);
  const cr = letterRank(curLetter, level);
  if (pr == null || cr == null) return false;
  return cr - pr >= 2;
}

function meanPreviewAverage(item: CoordinatorReportCardItem): number | null {
  const nums = item.preview.subjects
    .map((s) => s.averagePercentRaw)
    .filter((n): n is number => n != null && Number.isFinite(n));
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

function subjectKeyMapFromPreview(
  subjects: CoordinatorReportCardItem["preview"]["subjects"]
): Map<string, { grade: string; avg: number | null }> {
  const m = new Map<string, { grade: string; avg: number | null }>();
  for (const s of subjects) {
    const key = s.subject.trim().toLowerCase();
    const raw = s.averagePercentRaw;
    const avg =
      raw != null && Number.isFinite(raw) ? raw : null;
    m.set(key, { grade: s.grade, avg });
  }
  return m;
}

async function loadSubjectNamesForClasses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  classIds: string[]
): Promise<string[]> {
  const { data: scRows } = await admin
    .from("subject_classes")
    .select("subject_id, subjects ( id, name )")
    .in("class_id", classIds);

  const seen = new Map<string, string>();
  for (const r of (scRows ?? []) as {
    subject_id: string;
    subjects: { id: string; name: string } | null;
  }[]) {
    const id = r.subjects?.id ?? r.subject_id;
    const name = r.subjects?.name?.trim() || "Subject";
    if (!seen.has(id)) seen.set(id, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function computeAtRiskStudents(args: {
  schoolLevel: SchoolLevel;
  current: CoordinatorReportCardItem[];
  previous: CoordinatorReportCardItem[] | null;
  attendancePctByStudent: Map<string, number | null>;
}): AtRiskStudentRow[] {
  const { schoolLevel, current, previous, attendancePctByStudent } = args;
  const prevById = new Map(
    (previous ?? []).map((p) => [p.studentId, p] as const)
  );
  const out: AtRiskStudentRow[] = [];

  for (const row of current) {
    const prevRow = prevById.get(row.studentId);
    const reasons: string[] = [];

    let severeGradeDrop = false;
    if (prevRow) {
      const curM = subjectKeyMapFromPreview(row.preview.subjects);
      const prevM = subjectKeyMapFromPreview(prevRow.preview.subjects);
      for (const [subKey, cur] of curM) {
        const p = prevM.get(subKey);
        if (!p) continue;
        const cLetter = normalizeLetter(cur.grade, cur.avg, schoolLevel);
        const pLetter = normalizeLetter(p.grade, p.avg, schoolLevel);
        if (
          cLetter &&
          pLetter &&
          droppedAtLeastTwoLetterGrades(pLetter, cLetter, schoolLevel)
        ) {
          severeGradeDrop = true;
          break;
        }
      }
    }
    if (severeGradeDrop) {
      reasons.push(
        "Dropped 2+ letter grades vs the previous term in at least one subject"
      );
    }

    let below40Count = 0;
    for (const s of row.preview.subjects) {
      const a = s.averagePercentRaw;
      if (a != null && Number.isFinite(a) && a < 40) below40Count += 1;
    }
    if (below40Count >= 2) {
      reasons.push(`Below 40% in ${below40Count} subjects this term`);
    }

    const overall = meanPreviewAverage(row);
    const att = attendancePctByStudent.get(row.studentId) ?? null;
    if (
      att != null &&
      overall != null &&
      att < 75 &&
      overall < 50
    ) {
      reasons.push(
        "Attendance below 75% and term average score below 50%"
      );
    }

    if (reasons.length > 0) {
      out.push({
        studentId: row.studentId,
        studentName: row.studentName.trim() || "Student",
        reason: reasons.join(" · "),
      });
    }
  }

  return out;
}

export async function loadAcademicReportLiveSupplement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  args: {
    classId: string;
    schoolId: string;
    term: string;
    academicYear: string;
    data: AcademicPerformanceReportData;
  }
): Promise<AcademicReportLiveSupplement> {
  const { classId, schoolId, term, academicYear, data } = args;

  const cluster = await resolveClassCluster(admin, classId);
  const classIds = cluster.classIds;

  const [{ data: classRow }, { data: schoolRow }] = await Promise.all([
    admin.from("classes").select("name").eq("id", classId).maybeSingle(),
    admin.from("schools").select("name, motto, logo_url, school_level").eq("id", schoolId).maybeSingle(),
  ]);

  const className =
    (classRow as { name: string } | null)?.name?.trim() || data.class_name;
  const sr = schoolRow as {
    name: string;
    motto?: string | null;
    logo_url: string | null;
    school_level?: string | null;
  } | null;
  const schoolName = sr?.name?.trim() || "School";
  const mottoRaw = sr?.motto != null ? String(sr.motto).trim() : "";
  const motto = mottoRaw.length > 0 ? mottoRaw : null;
  const logoUrl = sr?.logo_url ?? null;
  const schoolLevel =
    normalizeSchoolLevel(sr?.school_level) ?? normalizeSchoolLevel(data.school_level) ?? "primary";

  const classSubjectNames = await loadSubjectNamesForClasses(admin, classIds);

  const rcParamsBase = {
    classId,
    classIds,
    className,
    schoolName,
    schoolMotto: motto,
    schoolLogoUrl: logoUrl,
    schoolLevel,
    classSubjectNames,
  };

  const reportTermOk = term === "Term 1" || term === "Term 2";
  const currentCards: CoordinatorReportCardItem[] = reportTermOk
    ? await loadCoordinatorReportCardsForClass(admin, {
        ...rcParamsBase,
        academicYear,
        term,
      })
    : [];

  let previousCards: CoordinatorReportCardItem[] | null = null;
  if (reportTermOk) {
    const adj = adjacentPreviousTerm(term, academicYear);
    if (adj) {
      previousCards = await loadCoordinatorReportCardsForClass(admin, {
        ...rcParamsBase,
        academicYear: adj.academicYear,
        term: adj.term,
      });
      if (previousCards.length === 0) previousCards = null;
    }
  }

  const studentIds = currentCards.map((c) => c.studentId);
  const attendancePctByStudent = new Map<string, number | null>();
  for (const sid of studentIds) attendancePctByStudent.set(sid, null);

  if (studentIds.length > 0 && reportTermOk) {
    const { start, end } = termDateRange(term, academicYear);
    const { data: attRowsRaw } = await admin
      .from("teacher_attendance")
      .select("student_id, status, attendance_date, subject_id")
      .in("class_id", classIds)
      .in("student_id", studentIds)
      .gte("attendance_date", start)
      .lte("attendance_date", end);

    const tallies = new Map<
      string,
      { present: number; absent: number; late: number }
    >();
    for (const sid of studentIds) {
      tallies.set(sid, { present: 0, absent: 0, late: 0 });
    }

    const attRows = dedupeTeacherAttendanceByStudentAndDate(
      (attRowsRaw ?? []) as {
        student_id: string;
        attendance_date: string;
        subject_id: string | null;
        status: "present" | "absent" | "late";
      }[]
    );
    for (const a of attRows) {
      const b = tallies.get(a.student_id);
      if (!b) continue;
      if (a.status === "present") b.present += 1;
      else if (a.status === "absent") b.absent += 1;
      else if (a.status === "late") b.late += 1;
    }
    for (const [sid, v] of tallies) {
      const total = v.present + v.absent + v.late;
      if (total === 0) attendancePctByStudent.set(sid, null);
      else {
        const pct =
          Math.round(
            ((v.present + v.late) / total) * 1000
          ) / 10;
        attendancePctByStudent.set(sid, pct);
      }
    }
  }

  const atRiskStudents = computeAtRiskStudents({
    schoolLevel,
    current: currentCards,
    previous: previousCards,
    attendancePctByStudent,
  });

  const { data: histRows } = await admin
    .from("academic_reports")
    .select("term, academic_year, report_data")
    .eq("class_id", classId)
    .eq("school_id", schoolId);

  const compareTermOptions: CompareTermOption[] = [];
  const comparisonByTermId: Record<string, HistoricalTermSubjectMetrics> = {};

  for (const r of (histRows ?? []) as {
    term: string;
    academic_year: string;
    report_data: unknown;
  }[]) {
    if (r.term === term && r.academic_year === academicYear) continue;
    const id = `${r.term}|${r.academic_year}`;
    compareTermOptions.push({
      id,
      label: `${r.term} ${r.academic_year}`.trim(),
    });
    comparisonByTermId[id] = metricsFromReportJson(r.report_data);
  }

  compareTermOptions.sort(compareTermIdsDesc);

  const defaultCompareTermId = compareTermOptions[0]?.id ?? "";

  return {
    atRiskStudents,
    compareTermOptions,
    comparisonByTermId,
    defaultCompareTermId,
  };
}

import "server-only";

import type { CoordinatorReportCardItem } from "@/app/(dashboard)/teacher-dashboard/coordinator/types";
import { loadCoordinatorReportCardsForClass } from "@/app/(dashboard)/teacher-dashboard/coordinator/data";
import type { ReportCardPreviewData } from "@/app/(dashboard)/teacher-dashboard/report-cards/report-card-preview-types";
import type { SchoolLevel } from "@/lib/school-level";
import { tanzaniaLetterGrade } from "@/lib/tanzania-grades";
import {
  nectaDivisionBucketForReportCard,
  type NectaDivisionBucketKey,
} from "@/lib/necta-class-result-metrics";
import type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";

export type { AcademicPerformanceReportData } from "@/lib/academic-performance-report-types";

const PRIMARY_FIXED_SUBJECTS = [
  "Kiswahili",
  "English",
  "Maarifa",
  "Hisabati",
  "Science",
  "Uraia",
] as const;

function fmtPct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function findPreviewSubject(
  preview: ReportCardPreviewData,
  canonical: string
): ReportCardPreviewData["subjects"][number] | undefined {
  const target = canonical.trim().toLowerCase();
  return preview.subjects.find(
    (s) => s.subject.trim().toLowerCase() === target
  );
}

function normalizePrimaryGradeLetter(grade: string): string | null {
  const t = grade.trim().toUpperCase();
  if (!t || t === "—" || t === "-") return null;
  const c = t.charAt(0);
  if ("ABCDE".includes(c)) return c;
  return null;
}

function primaryGradeLetterMidpointPercent(letter: string): number {
  switch (letter) {
    case "A":
      return 91;
    case "B":
      return 71;
    case "C":
      return 51;
    case "D":
      return 31;
    case "E":
      return 10;
    default:
      return NaN;
  }
}

function percentForPrimaryAveraging(
  s: ReportCardPreviewData["subjects"][number]
): number | null {
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    return s.averagePercentRaw;
  }
  const g = normalizePrimaryGradeLetter(s.grade);
  if (g) {
    const mid = primaryGradeLetterMidpointPercent(g);
    return Number.isFinite(mid) ? mid : null;
  }
  return null;
}

function effectivePrimarySubjectGradeLetter(
  s: ReportCardPreviewData["subjects"][number] | undefined
): string | null {
  if (!s) return null;
  const g = normalizePrimaryGradeLetter(s.grade);
  if (g) return g;
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    const fromPct = tanzaniaLetterGrade(s.averagePercentRaw, "primary");
    return fromPct === "—" ? null : fromPct;
  }
  return null;
}

function primarySheetAverageGradeLetter(preview: ReportCardPreviewData): string {
  const pcts: number[] = [];
  for (const name of PRIMARY_FIXED_SUBJECTS) {
    const row = findPreviewSubject(preview, name);
    if (!row) continue;
    const p = percentForPrimaryAveraging(row);
    if (p != null) pcts.push(p);
  }
  if (pcts.length === 0) return "X";
  const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const letter = tanzaniaLetterGrade(mean, "primary");
  return letter === "—" ? "X" : letter;
}

function normalizeSecondaryGradeLetter(grade: string): string | null {
  const t = grade.trim().toUpperCase();
  if (!t || t === "—" || t === "-") return null;
  const c = t.charAt(0);
  if ("ABCDEF".includes(c)) return c;
  return null;
}

function secondarySubjectLetter(
  s: ReportCardPreviewData["subjects"][number] | undefined
): string | null {
  if (!s) return null;
  const g = normalizeSecondaryGradeLetter(s.grade);
  if (g) return g;
  if (s.averagePercentRaw != null && Number.isFinite(s.averagePercentRaw)) {
    const letter = tanzaniaLetterGrade(s.averagePercentRaw, "secondary");
    return letter === "—" ? null : letter;
  }
  return null;
}

function isSecondarySubjectPass(letter: string | null): boolean {
  if (!letter) return false;
  return letter !== "F";
}

function isPrimarySubjectPass(letter: string | null): boolean {
  if (!letter) return false;
  return letter !== "E";
}

function gradeTier(letter: string): number {
  const u = letter.trim().toUpperCase().charAt(0);
  const order: Record<string, number> = {
    A: 6,
    B: 5,
    C: 4,
    D: 3,
    E: 2,
    F: 1,
  };
  return order[u] ?? 0;
}

function bestOfGrades(letters: (string | null)[]): string | null {
  const valid = letters.filter((x): x is string => Boolean(x && x !== "—"));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (gradeTier(a) >= gradeTier(b) ? a : b));
}

const NECTA_DIVISION_ORDER: NectaDivisionBucketKey[] = [
  "I",
  "II",
  "III",
  "IV",
  "0",
  "INC",
  "ABS",
];

const PRIMARY_GRADE_ORDER = ["A", "B", "C", "D", "E", "X"] as const;

function emptyDivCounts(): Record<NectaDivisionBucketKey, number> {
  return { I: 0, II: 0, III: 0, IV: 0, "0": 0, INC: 0, ABS: 0 };
}

function emptyPrimaryBuckets(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const k of PRIMARY_GRADE_ORDER) o[k] = 0;
  return o;
}

export function buildAcademicPerformanceReportData(args: {
  schoolLevel: SchoolLevel;
  className: string;
  term: string;
  academicYear: string;
  classSubjectNames: string[];
  reportCards: CoordinatorReportCardItem[];
  teacherNameBySubjectKey: Map<string, string>;
}): AcademicPerformanceReportData {
  const {
    schoolLevel,
    className,
    term,
    academicYear,
    classSubjectNames,
    reportCards,
    teacherNameBySubjectKey,
  } = args;

  const subjectsSorted = [...classSubjectNames].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  const totalStudents = reportCards.length;

  let overall_pass_rate_pct: number | null = null;
  let overall_fail_rate_pct: number | null = null;
  let boys_pass_rate_pct: number | null = null;
  let girls_pass_rate_pct: number | null = null;
  let boys_fail_rate_pct: number | null = null;
  let girls_fail_rate_pct: number | null = null;

  let division_distribution: AcademicPerformanceReportData["division_distribution"] =
    [];

  if (schoolLevel === "secondary") {
    const passBuckets = new Set<NectaDivisionBucketKey>(["I", "II", "III"]);
    let pass = 0,
      fail = 0;
    let mTotal = 0,
      fTotal = 0,
      mPass = 0,
      fPass = 0,
      mFail = 0,
      fFail = 0;

    const divM = emptyDivCounts();
    const divF = emptyDivCounts();
    const divT = emptyDivCounts();

    for (const r of reportCards) {
      const key = nectaDivisionBucketForReportCard(r);
      divT[key] += 1;
      if (r.gender === "female") divF[key] += 1;
      else if (r.gender === "male") divM[key] += 1;

      const isPass = passBuckets.has(key);
      if (isPass) pass += 1;
      else fail += 1;

      if (r.gender === "male") {
        mTotal += 1;
        if (isPass) mPass += 1;
        else mFail += 1;
      } else if (r.gender === "female") {
        fTotal += 1;
        if (isPass) fPass += 1;
        else fFail += 1;
      }
    }

    overall_pass_rate_pct = fmtPct(pass, totalStudents);
    overall_fail_rate_pct = fmtPct(fail, totalStudents);
    boys_pass_rate_pct = fmtPct(mPass, mTotal);
    girls_pass_rate_pct = fmtPct(fPass, fTotal);
    boys_fail_rate_pct = fmtPct(mFail, mTotal);
    girls_fail_rate_pct = fmtPct(fFail, fTotal);

    division_distribution = NECTA_DIVISION_ORDER.map((division) => ({
      division,
      boys: divM[division],
      girls: divF[division],
      total: divT[division],
    }));
  } else {
    let pass = 0,
      fail = 0;
    let mTotal = 0,
      fTotal = 0,
      mPass = 0,
      fPass = 0,
      mFail = 0,
      fFail = 0;

    const bM = emptyPrimaryBuckets();
    const bF = emptyPrimaryBuckets();
    const bT = emptyPrimaryBuckets();

    for (const r of reportCards) {
      const avgLetter = primarySheetAverageGradeLetter(r.preview);
      const bucket = avgLetter === "X" ? "X" : avgLetter;
      bT[bucket] += 1;
      if (r.gender === "female") bF[bucket] += 1;
      else if (r.gender === "male") bM[bucket] += 1;

      const isPass =
        avgLetter === "A" || avgLetter === "B" || avgLetter === "C";
      const isFail =
        avgLetter === "D" || avgLetter === "E" || avgLetter === "X";
      if (isPass) pass += 1;
      if (isFail) fail += 1;

      if (r.gender === "male") {
        mTotal += 1;
        if (isPass) mPass += 1;
        if (isFail) mFail += 1;
      } else if (r.gender === "female") {
        fTotal += 1;
        if (isPass) fPass += 1;
        if (isFail) fFail += 1;
      }
    }

    overall_pass_rate_pct = fmtPct(pass, totalStudents);
    overall_fail_rate_pct = fmtPct(fail, totalStudents);
    boys_pass_rate_pct = fmtPct(mPass, mTotal);
    girls_pass_rate_pct = fmtPct(fPass, fTotal);
    boys_fail_rate_pct = fmtPct(mFail, mTotal);
    girls_fail_rate_pct = fmtPct(fFail, fTotal);

    division_distribution = PRIMARY_GRADE_ORDER.map((division) => ({
      division,
      boys: bM[division] ?? 0,
      girls: bF[division] ?? 0,
      total: bT[division] ?? 0,
    }));
  }

  const subject_ranking: AcademicPerformanceReportData["subject_ranking"] = [];

  for (const subject of subjectsSorted) {
    let passN = 0,
      failN = 0,
      counted = 0;
    const letters: (string | null)[] = [];
    for (const r of reportCards) {
      const row = findPreviewSubject(r.preview, subject);
      const letter =
        schoolLevel === "secondary"
          ? secondarySubjectLetter(row)
          : effectivePrimarySubjectGradeLetter(row);
      if (!letter) continue;
      counted += 1;
      letters.push(letter);
      if (schoolLevel === "secondary") {
        if (isSecondarySubjectPass(letter)) passN += 1;
        else failN += 1;
      } else if (isPrimarySubjectPass(letter)) passN += 1;
      else failN += 1;
    }
    const pass_rate_pct = counted > 0 ? fmtPct(passN, counted) : null;
    const fail_rate_pct = counted > 0 ? fmtPct(failN, counted) : null;
    const top_grade = bestOfGrades(letters);
    subject_ranking.push({
      rank: 0,
      subject,
      pass_rate_pct,
      fail_rate_pct,
      top_grade,
    });
  }

  subject_ranking.sort((a, b) => {
    const pa = a.pass_rate_pct ?? -1;
    const pb = b.pass_rate_pct ?? -1;
    if (pb !== pa) return pb - pa;
    return a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" });
  });
  subject_ranking.forEach((row, i) => {
    row.rank = i + 1;
  });

  const teacher_performance: AcademicPerformanceReportData["teacher_performance"] =
    [];

  for (const subject of subjectsSorted) {
    const subKey = subject.trim().toLowerCase();
    const teacher =
      teacherNameBySubjectKey.get(subKey)?.trim() || "—";
    const sr = subject_ranking.find((x) => x.subject === subject);
    let sumAvg = 0;
    let nAvg = 0;
    for (const r of reportCards) {
      const row = findPreviewSubject(r.preview, subject);
      if (!row?.averagePercentRaw || !Number.isFinite(row.averagePercentRaw)) {
        continue;
      }
      sumAvg += row.averagePercentRaw;
      nAvg += 1;
    }
    const class_average_pct =
      nAvg > 0 ? Math.round((sumAvg / nAvg) * 10) / 10 : null;
    teacher_performance.push({
      rank: 0,
      subject,
      teacher,
      pass_rate_pct: sr?.pass_rate_pct ?? null,
      class_average_pct,
    });
  }

  teacher_performance.sort((a, b) => {
    const pa = a.pass_rate_pct ?? -1;
    const pb = b.pass_rate_pct ?? -1;
    if (pb !== pa) return pb - pa;
    const ca = a.class_average_pct ?? -1;
    const cb = b.class_average_pct ?? -1;
    if (cb !== ca) return cb - ca;
    return a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" });
  });
  teacher_performance.forEach((row, i) => {
    row.rank = i + 1;
  });

  return {
    version: 1,
    school_level: schoolLevel,
    class_name: className,
    term,
    academic_year: academicYear,
    division_mode: schoolLevel === "secondary" ? "necta" : "primary_grades",
    overall_performance: {
      total_students: totalStudents,
      overall_pass_rate_pct,
      boys_pass_rate_pct,
      girls_pass_rate_pct,
      overall_fail_rate_pct,
      boys_fail_rate_pct,
      girls_fail_rate_pct,
    },
    division_distribution,
    subject_ranking,
    teacher_performance,
  };
}

async function loadTeacherNameBySubjectKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  params: { schoolId: string; classIds: string[]; academicYear: string }
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (params.classIds.length === 0) return map;

  const { data: rows, error } = await admin
    .from("teacher_assignments")
    .select("subject, teacher_id")
    .eq("school_id", params.schoolId)
    .in("class_id", params.classIds)
    .eq("academic_year", params.academicYear);

  if (error || !rows?.length) return map;

  const teacherIds = [
    ...new Set((rows as { teacher_id: string }[]).map((r) => r.teacher_id)),
  ];
  const nameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    for (const p of (profs ?? []) as {
      id: string;
      full_name: string | null;
    }[]) {
      nameById.set(p.id, p.full_name?.trim() || "Teacher");
    }
  }

  for (const r of rows as { subject: string; teacher_id: string }[]) {
    const subj = (r.subject ?? "").trim();
    if (!subj) continue;
    const key = subj.toLowerCase();
    const name = nameById.get(r.teacher_id) ?? "Teacher";
    const prev = map.get(key);
    if (prev && prev !== name) {
      if (!prev.includes(name)) map.set(key, `${prev} / ${name}`);
    } else {
      map.set(key, name);
    }
  }

  return map;
}

export async function persistAcademicPerformanceReport(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  schoolId: string;
  classId: string;
  classIdsForData: string[];
  className: string;
  term: "Term 1" | "Term 2";
  academicYear: string;
  schoolLevel: SchoolLevel;
  classSubjectNames: string[];
  generatedByUserId: string;
}): Promise<void> {
  const {
    admin,
    schoolId,
    classId,
    classIdsForData,
    className,
    term,
    academicYear,
    schoolLevel,
    classSubjectNames,
    generatedByUserId,
  } = args;

  const { data: schoolRow } = await admin
    .from("schools")
    .select("name, motto, logo_url")
    .eq("id", schoolId)
    .maybeSingle();
  const sr = schoolRow as {
    name: string;
    motto?: string | null;
    logo_url?: string | null;
  } | null;
  const schoolName = sr?.name?.trim() || "School";
  const mottoRaw = sr?.motto != null ? String(sr.motto).trim() : "";
  const motto = mottoRaw.length > 0 ? mottoRaw : null;
  const logoUrl = sr?.logo_url ?? null;

  const reportCards = await loadCoordinatorReportCardsForClass(admin, {
    classId,
    classIds: classIdsForData,
    className,
    schoolName,
    schoolMotto: motto,
    schoolLogoUrl: logoUrl,
    schoolLevel,
    academicYear,
    term,
    classSubjectNames,
  });

  if (reportCards.length === 0) {
    return;
  }

  const teacherNameBySubjectKey = await loadTeacherNameBySubjectKey(admin, {
    schoolId,
    classIds: classIdsForData,
    academicYear,
  });

  const report_data = buildAcademicPerformanceReportData({
    schoolLevel,
    className,
    term,
    academicYear,
    classSubjectNames,
    reportCards,
    teacherNameBySubjectKey,
  });

  const payload = {
    school_id: schoolId,
    class_id: classId,
    term,
    academic_year: academicYear,
    report_data,
    generated_at: new Date().toISOString(),
    generated_by: generatedByUserId,
  };

  const { error } = await admin.from("academic_reports").upsert(payload, {
    onConflict: "school_id,class_id,term,academic_year",
  });

  if (error) {
    console.error(
      "[academic-performance-report] upsert failed",
      error.message
    );
  }
}

import "server-only";

import { fetchParentClassIdsWithChildrenForSchools } from "@/lib/teacher-leaf-classes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  PendingReportCardRow,
  ReportCardCommentRow,
  ReportCardStatus,
  ReportCardSubjectFilterOption,
  StudentReportRow,
  TeacherClassOption,
} from "./report-card-types";
import { isMissingColumnSchemaError } from "./report-card-schema-compat";
import { termDateRange } from "./report-card-dates";
import { computeClassSubjectPositions } from "./report-card-preview-builder";
import {
  DEFAULT_REPORT_CARD_GRADEBOOK_EXAM_NAMES,
  GRADEBOOK_EXAM_ASSIGNMENT_TITLES,
} from "./constants";
import {
  currentAcademicYear,
  type SubjectEnrollmentTerm,
} from "@/lib/student-subject-enrollment";
import {
  getStudentEnrolledSubjects,
  reportAcademicYearToEnrollmentYear,
} from "@/lib/student-subject-enrollment-queries";
import { dedupeTeacherAttendanceByStudentAndDate } from "@/lib/teacher-attendance-dedupe";
import {
  normalizeSchoolLevel,
  type SchoolLevel,
} from "@/lib/school-level";

export type {
  PendingReportCardRow,
  ReportCardCommentRow,
  ReportCardStatus,
  ReportCardSubjectFilterOption,
  StudentReportRow,
  TeacherClassOption,
} from "./report-card-types";

export { termDateRange } from "./report-card-dates";

/** Same pattern as Grades / `data.ts` — admin client bypasses RLS on `teacher_assignments`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const NO_ASSIGNMENTS_MSG =
  "No class assignments found. Ask your administrator to assign classes.";

/**
 * Coordinators may have no `teacher_assignments` on leaf classes (e.g. only a
 * parent container row, or scores entered by other teachers). Build class
 * options from `teacher_coordinators` so the report cards page can load.
 */
async function loadCoordinatorFallbackReportCardOptions(
  admin: Db,
  userId: string,
  teacherName: string
): Promise<
  | {
      ok: true;
      schoolId: string;
      schoolName: string;
      schoolMotto: string | null;
      logoUrl: string | null;
      schoolStampUrl: string | null;
      headTeacherSignatureUrl: string | null;
      schoolLevel: SchoolLevel;
      teacherName: string;
      classes: TeacherClassOption[];
    }
  | { ok: false; error: string }
> {
  const { data: coordRows, error } = await admin
    .from("teacher_coordinators")
    .select("class_id, school_id")
    .eq("teacher_id", userId);

  if (error || !coordRows?.length) {
    return { ok: false, error: NO_ASSIGNMENTS_MSG };
  }

  const coords = coordRows as { class_id: string; school_id: string }[];
  const classIds = [...new Set(coords.map((r) => r.class_id))];

  const { data: classRows } = await admin
    .from("classes")
    .select("id, name, school_id")
    .in("id", classIds);

  const nameById = new Map<string, string>();
  const schoolByClass = new Map<string, string>();
  for (const c of (classRows ?? []) as {
    id: string;
    name: string;
    school_id: string;
  }[]) {
    nameById.set(c.id, c.name);
    schoolByClass.set(c.id, c.school_id);
  }

  const cy = new Date().getFullYear();
  const defaultYears = [String(cy - 1), String(cy), String(cy + 1)];

  const classes: TeacherClassOption[] = classIds.map((classId) => ({
    classId,
    className: nameById.get(classId) ?? "Class",
    academicYears: [...defaultYears],
    isCoordinator: true,
  }));
  classes.sort((a, b) => a.className.localeCompare(b.className));

  const primarySchoolId =
    schoolByClass.get(classIds[0] ?? "") ?? coords[0]?.school_id ?? "";

  let schoolId = primarySchoolId;
  let schoolName = "";
  let schoolMotto: string | null = null;
  let logoUrl: string | null = null;
  let schoolStampUrl: string | null = null;
  let headTeacherSignatureUrl: string | null = null;
  let schoolLevel: SchoolLevel = normalizeSchoolLevel(undefined);

  if (primarySchoolId) {
    let res = await admin
      .from("schools")
      .select("id, name, logo_url, school_level, motto, school_stamp_url, head_teacher_signature_url")
      .eq("id", primarySchoolId)
      .maybeSingle();
    if (res.error && /column/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url, school_level, motto, school_stamp_url")
        .eq("id", primarySchoolId)
        .maybeSingle();
    }
    if (res.error && /column/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url, school_level")
        .eq("id", primarySchoolId)
        .maybeSingle();
    }
    if (res.error && /column.*school_level/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url")
        .eq("id", primarySchoolId)
        .maybeSingle();
    }
    const s = res.data as {
      id: string;
      name: string;
      logo_url: string | null;
      school_level?: string | null;
      motto?: string | null;
      school_stamp_url?: string | null;
      head_teacher_signature_url?: string | null;
    } | null;
    if (s) {
      schoolId = s.id;
      schoolName = s.name;
      logoUrl = s.logo_url;
      schoolStampUrl = s.school_stamp_url?.trim() || null;
      headTeacherSignatureUrl = s.head_teacher_signature_url?.trim() || null;
      schoolLevel = normalizeSchoolLevel(s.school_level);
      const m = (s.motto ?? "").trim();
      schoolMotto = m || null;
    }
  }

  return {
    ok: true,
    schoolId,
    schoolName,
    schoolMotto,
    logoUrl,
    schoolStampUrl,
    headTeacherSignatureUrl,
    schoolLevel,
    teacherName,
    classes,
  };
}

export async function loadTeacherReportCardOptions(): Promise<
  | {
      ok: true;
      schoolId: string;
      schoolName: string;
      schoolMotto: string | null;
      logoUrl: string | null;
      schoolStampUrl: string | null;
      headTeacherSignatureUrl: string | null;
      schoolLevel: SchoolLevel;
      teacherName: string;
      classes: TeacherClassOption[];
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as Db;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const teacherName =
    (profile as { full_name: string | null } | null)?.full_name?.trim() ||
    "Teacher";

  const { data: assignments, error } = await admin
    .from("teacher_assignments")
    .select(
      `
      id,
      class_id,
      subject,
      academic_year,
      subject_id,
      school_id,
      subjects ( name )
    `
    )
    .eq("teacher_id", user.id);

  if (error || !assignments?.length) {
    const fallback = await loadCoordinatorFallbackReportCardOptions(
      admin,
      user.id,
      teacherName
    );
    if (fallback.ok) return fallback;
    return {
      ok: false,
      error: error?.message ?? NO_ASSIGNMENTS_MSG,
    };
  }

  const rows = assignments as {
    id: string;
    class_id: string;
    subject: string;
    academic_year: string;
    subject_id: string | null;
    school_id: string;
    subjects: { name: string } | null;
  }[];

  const schoolIdsForLeaf = [...new Set(rows.map((r) => r.school_id).filter(Boolean))];
  const parentClassIds = await fetchParentClassIdsWithChildrenForSchools(
    admin,
    schoolIdsForLeaf
  );
  const leafRows = rows.filter((r) => !parentClassIds.has(r.class_id));

  if (!leafRows.length) {
    const fallback = await loadCoordinatorFallbackReportCardOptions(
      admin,
      user.id,
      teacherName
    );
    if (fallback.ok) return fallback;
    return { ok: false, error: NO_ASSIGNMENTS_MSG };
  }

  const classIds = [...new Set(leafRows.map((r) => r.class_id))];
  const classNameById = new Map<string, string>();
  const classSchoolIdById = new Map<string, string>();

  if (classIds.length > 0) {
    const { data: classRows } = await admin
      .from("classes")
      .select("id, name, school_id")
      .in("id", classIds);
    for (const c of classRows ?? []) {
      const row = c as { id: string; name: string; school_id: string };
      classNameById.set(row.id, row.name);
      classSchoolIdById.set(row.id, row.school_id);
    }
  }

  const byClass = new Map<
    string,
    { name: string; schoolId: string; years: Set<string> }
  >();

  for (const r of leafRows) {
    const name = classNameById.get(r.class_id) ?? "Class";
    const schoolFromClass = classSchoolIdById.get(r.class_id);
    const schoolIdForClass = schoolFromClass ?? r.school_id;
    if (!byClass.has(r.class_id)) {
      byClass.set(r.class_id, {
        name,
        schoolId: schoolIdForClass,
        years: new Set(),
      });
    }
    byClass.get(r.class_id)!.years.add(r.academic_year?.trim() || "");
  }

  // Which of these classes does the current teacher coordinate? Used downstream
  // to swap the report card's "Class teacher" label for "Class Coordinator".
  const coordinatorClassIds = new Set<string>();
  if (classIds.length > 0) {
    const { data: coordRows } = await admin
      .from("teacher_coordinators")
      .select("class_id")
      .eq("teacher_id", user.id)
      .in("class_id", classIds);
    for (const r of (coordRows ?? []) as { class_id: string }[]) {
      coordinatorClassIds.add(r.class_id);
    }
  }

  const classes: TeacherClassOption[] = [];
  for (const [classId, v] of byClass) {
    const academicYears = [...v.years].filter(Boolean).sort();
    classes.push({
      classId,
      className: v.name,
      academicYears,
      isCoordinator: coordinatorClassIds.has(classId),
    });
  }
  classes.sort((a, b) => a.className.localeCompare(b.className));

  const primarySchoolId =
    leafRows[0]?.school_id ??
    classSchoolIdById.get(leafRows[0]?.class_id ?? "") ??
    "";
  let schoolId = primarySchoolId;
  let schoolName = "";
  let schoolMotto: string | null = null;
  let logoUrl: string | null = null;
  let schoolStampUrl: string | null = null;
  let headTeacherSignatureUrl: string | null = null;
  let schoolLevel: SchoolLevel = normalizeSchoolLevel(undefined);

  if (primarySchoolId) {
    // `school_level` / `motto` may be missing on older deployments; fall back gracefully.
    let res = await admin
      .from("schools")
      .select("id, name, logo_url, school_level, motto, school_stamp_url, head_teacher_signature_url")
      .eq("id", primarySchoolId)
      .maybeSingle();
    if (res.error && /column/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url, school_level, motto, school_stamp_url")
        .eq("id", primarySchoolId)
        .maybeSingle();
    }
    if (res.error && /column/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url, school_level")
        .eq("id", primarySchoolId)
        .maybeSingle();
    }
    if (res.error && /column.*school_level/i.test(res.error.message ?? "")) {
      res = await admin
        .from("schools")
        .select("id, name, logo_url")
        .eq("id", primarySchoolId)
        .maybeSingle();
    }
    const s = res.data as {
      id: string;
      name: string;
      logo_url: string | null;
      school_level?: string | null;
      motto?: string | null;
      school_stamp_url?: string | null;
      head_teacher_signature_url?: string | null;
    } | null;
    if (s) {
      schoolId = s.id;
      schoolName = s.name;
      logoUrl = s.logo_url;
      schoolStampUrl = s.school_stamp_url?.trim() || null;
      headTeacherSignatureUrl = s.head_teacher_signature_url?.trim() || null;
      schoolLevel = normalizeSchoolLevel(s.school_level);
      const m = (s.motto ?? "").trim();
      schoolMotto = m || null;
    }
  }

  return {
    ok: true,
    schoolId,
    schoolName,
    schoolMotto,
    logoUrl,
    schoolStampUrl,
    headTeacherSignatureUrl,
    schoolLevel,
    teacherName,
    classes,
  };
}

export async function getReportCardSubjectsForStudent(params: {
  classId: string;
  studentId: string;
  term: string;
  academicYear: string;
  allSubjects: string[];
}): Promise<{ ok: true; subjects: string[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as Db;
  const termNorm = params.term.trim();
  const termParsed: SubjectEnrollmentTerm =
    termNorm === "Term 2" ? "Term 2" : "Term 1";
  const yearInt = reportAcademicYearToEnrollmentYear(params.academicYear);

  try {
    const subjects = await getStudentEnrolledSubjects(admin, {
      studentId: params.studentId,
      classId: params.classId,
      academicYear: yearInt,
      term: termParsed,
      teacherSubjectLabels: params.allSubjects,
    });
    return { ok: true, subjects };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function loadSubjectsForClass(classId: string): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient() as Db;
  const { data } = await admin
    .from("teacher_assignments")
    .select(
      `
      subject,
      subject_id,
      subjects ( name )
    `
    )
    .eq("teacher_id", user.id)
    .eq("class_id", classId);

  const set = new Set<string>();
  for (const r of (data ?? []) as {
    subject: string;
    subject_id: string | null;
    subjects: { name: string } | null;
  }[]) {
    const label =
      r.subjects?.name?.trim() ||
      r.subject?.trim() ||
      "";
    if (label) set.add(label);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function getSubjectsForClass(classId: string): Promise<string[]> {
  return loadSubjectsForClass(classId);
}

function firstFourDigitYearFromString(y: string | null | undefined): number {
  const m = (y ?? "").trim().match(/\d{4}/);
  if (m) return parseInt(m[0], 10);
  return currentAcademicYear();
}

export async function loadStudentsReportData(
  classId: string,
  term: string,
  academicYear: string,
  /** When set, roster is limited to this subject’s enrolments; otherwise all teacher subjects for the year. */
  subjectFilterSubjectId?: string | null
): Promise<
  | {
      ok: true;
      students: StudentReportRow[];
      attendanceByStudent: Record<
        string,
        { present: number; absent: number; late: number }
      >;
      subjectFilterOptions: ReportCardSubjectFilterOption[];
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient() as Db;

  const termNorm = term.trim();
  const yearNorm = academicYear.trim();
  const termParsed: SubjectEnrollmentTerm =
    termNorm === "Term 2" ? "Term 2" : "Term 1";
  const yearInt = reportAcademicYearToEnrollmentYear(yearNorm);

  const { data: taRows } = await admin
    .from("teacher_assignments")
    .select(
      `
      subject_id,
      academic_year,
      subject,
      subjects ( name )
    `
    )
    .eq("teacher_id", user.id)
    .eq("class_id", classId);

  const teacherSubjectIdsForYear = new Set<string>();
  const subjectNameById = new Map<string, string>();
  for (const r of (taRows ?? []) as {
    subject_id: string | null;
    academic_year: string | null;
    subject: string | null;
    subjects: { name: string } | null;
  }[]) {
    if (!r.subject_id) continue;
    if (firstFourDigitYearFromString(r.academic_year) !== yearInt) continue;
    teacherSubjectIdsForYear.add(r.subject_id);
    if (!subjectNameById.has(r.subject_id)) {
      const label =
        r.subjects?.name?.trim() || r.subject?.trim() || "Subject";
      subjectNameById.set(r.subject_id, label);
    }
  }

  const subjectFilterOptions: ReportCardSubjectFilterOption[] = [
    ...subjectNameById.entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filterSid = subjectFilterSubjectId?.trim() ?? "";
  if (filterSid && !teacherSubjectIdsForYear.has(filterSid)) {
    return { ok: false, error: "Invalid subject filter." };
  }

  const enrollmentSubjectIds = filterSid
    ? [filterSid]
    : [...teacherSubjectIdsForYear];

  const { data: studsRaw, error: se } = await admin
    .from("students")
    .select("id, full_name, parent_email")
    .eq("class_id", classId)
    .order("full_name");

  if (se || !studsRaw?.length) {
    return { ok: false, error: "No students in this class." };
  }

  let studs = studsRaw as {
    id: string;
    full_name: string;
    parent_email: string | null;
  }[];

  if (enrollmentSubjectIds.length > 0) {
    const { data: enrollRows, error: enrollErr } = await admin
      .from("student_subject_enrollment")
      .select("student_id")
      .eq("class_id", classId)
      .eq("academic_year", yearInt)
      .eq("term", termParsed)
      .in("subject_id", enrollmentSubjectIds);

    if (enrollErr) {
      return { ok: false, error: enrollErr.message };
    }

    const enrolledStudentIds = new Set(
      ((enrollRows ?? []) as { student_id: string }[]).map((r) => r.student_id)
    );
    studs = studs.filter((s) => enrolledStudentIds.has(s.id));
  }

  if (!studs.length) {
    return {
      ok: false,
      error:
        enrollmentSubjectIds.length > 0
          ? filterSid
            ? "No students are enrolled in this subject for this class, year, and term."
            : "No students are enrolled in your subjects for this class, year, and term."
          : "No students in this class.",
    };
  }

  const studentIds = studs.map((s) => s.id);

  const { data: cards } = await admin
    .from("report_cards")
    .select("id, student_id, status")
    .eq("class_id", classId)
    .eq("term", termNorm)
    .eq("academic_year", yearNorm)
    .in("student_id", studentIds);

  const cardByStudent = new Map<
    string,
    { id: string; status: ReportCardStatus }
  >();
  for (const c of (cards ?? []) as {
    id: string;
    student_id: string;
    status: ReportCardStatus;
  }[]) {
    cardByStudent.set(c.student_id, { id: c.id, status: c.status });
  }

  const cardIds = [...cardByStudent.values()].map((c) => c.id);
  const commentsByCard = new Map<string, ReportCardCommentRow[]>();

  if (cardIds.length) {
    const selectWithExams =
      "id, report_card_id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade";
    const selectOverride =
      `${selectWithExams}, exam1_gradebook_original, exam2_gradebook_original, exam1_score_overridden, exam2_score_overridden`;
    const selectFull = `${selectOverride}, position`;
    const selectLegacy =
      "id, report_card_id, subject, comment, score_percent, letter_grade";

    let comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectFull)
      .eq("teacher_id", user.id)
      .in("report_card_id", cardIds);

    if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
      comsRes = await admin
        .from("teacher_report_card_comments")
        .select(selectOverride)
        .eq("teacher_id", user.id)
        .in("report_card_id", cardIds);
    }

    if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
      comsRes = await admin
        .from("teacher_report_card_comments")
        .select(selectWithExams)
        .eq("teacher_id", user.id)
        .in("report_card_id", cardIds);
    }

    if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
      comsRes = await admin
        .from("teacher_report_card_comments")
        .select(selectLegacy)
        .eq("teacher_id", user.id)
        .in("report_card_id", cardIds);
    }

    if (comsRes.error) {
      console.error("[loadStudentsReportData] comments select", comsRes.error);
      return { ok: false, error: comsRes.error.message };
    }

    const coms = comsRes.data;

    const parseNumeric = (
      v: number | string | null | undefined
    ): number | null => {
      if (v == null || String(v).trim() === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    for (const row of (coms ?? []) as {
      id: string;
      report_card_id: string;
      subject: string;
      comment: string | null;
      score_percent: number | string | null;
      letter_grade: string | null;
      exam1_score: number | string | null;
      exam2_score: number | string | null;
      calculated_score: number | string | null;
      calculated_grade: string | null;
      exam1_gradebook_original?: number | string | null;
      exam2_gradebook_original?: number | string | null;
      exam1_score_overridden?: boolean | null;
      exam2_score_overridden?: boolean | null;
      position?: number | string | null;
    }[]) {
      const scorePercent = parseNumeric(row.score_percent);
      const list = commentsByCard.get(row.report_card_id) ?? [];
      list.push({
        id: row.id,
        subject: row.subject,
        comment: row.comment,
        scorePercent,
        letterGrade: row.letter_grade,
        exam1Score: parseNumeric(row.exam1_score),
        exam2Score: parseNumeric(row.exam2_score),
        calculatedScore: parseNumeric(row.calculated_score),
        calculatedGrade: row.calculated_grade,
        exam1GradebookOriginal: parseNumeric(row.exam1_gradebook_original),
        exam2GradebookOriginal: parseNumeric(row.exam2_gradebook_original),
        exam1ScoreOverridden: row.exam1_score_overridden === true,
        exam2ScoreOverridden: row.exam2_score_overridden === true,
        position: parseNumeric(row.position),
      });
      commentsByCard.set(row.report_card_id, list);
    }
  }

  const { start, end } = termDateRange(termNorm, yearNorm);
  const attendanceByStudent: Record<
    string,
    { present: number; absent: number; late: number }
  > = {};

  for (const sid of studentIds) {
    attendanceByStudent[sid] = { present: 0, absent: 0, late: 0 };
  }

  const { data: attRowsRaw } = await admin
    .from("teacher_attendance")
    .select("student_id, status, attendance_date, subject_id")
    .eq("class_id", classId)
    .in("student_id", studentIds)
    .gte("attendance_date", start)
    .lte("attendance_date", end);

  const attRows = dedupeTeacherAttendanceByStudentAndDate(
    (attRowsRaw ?? []) as {
      student_id: string;
      attendance_date: string;
      subject_id: string | null;
      status: "present" | "absent" | "late";
    }[]
  );

  for (const a of attRows) {
    const b = attendanceByStudent[a.student_id];
    if (!b) continue;
    if (a.status === "present") b.present += 1;
    else if (a.status === "absent") b.absent += 1;
    else if (a.status === "late") b.late += 1;
  }

  const students: StudentReportRow[] = (studs as {
    id: string;
    full_name: string;
    parent_email: string | null;
  }[]).map((s) => {
    const card = cardByStudent.get(s.id);
    return {
      studentId: s.id,
      fullName: s.full_name,
      parentEmail: s.parent_email,
      reportCardId: card?.id ?? null,
      status: card?.status ?? null,
      comments: card ? commentsByCard.get(card.id) ?? [] : [],
    };
  });

  return {
    ok: true,
    students,
    attendanceByStudent,
    subjectFilterOptions,
  };
}

export async function ensureReportCard(
  admin: Db,
  userId: string,
  studentId: string,
  classId: string,
  schoolId: string,
  term: string,
  academicYear: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const termT = term.trim();
  const yearT = academicYear.trim();

  const { data: existing, error: selectErr } = await admin
    .from("report_cards")
    .select("id, class_id")
    .eq("student_id", studentId)
    .eq("term", termT)
    .eq("academic_year", yearT)
    .maybeSingle();

  if (selectErr) {
    return { ok: false, error: selectErr.message };
  }

  if (existing) {
    const ex = existing as { id: string; class_id: string };
    /**
     * `loadStudentsReportData` filters cards by `class_id`. If the student moved
     * class (or legacy rows had a stale class_id), saves would attach comments
     * to a row that never appeared in the UI. Align `class_id` with the class
     * the teacher is editing from.
     */
    if (ex.class_id !== classId) {
      const { error: alignErr } = await admin
        .from("report_cards")
        .update({ class_id: classId })
        .eq("id", ex.id);
      if (alignErr) return { ok: false, error: alignErr.message };
    }
    return { ok: true, id: ex.id };
  }

  const { data: created, error } = await admin
    .from("report_cards")
    .insert({
      student_id: studentId,
      class_id: classId,
      school_id: schoolId,
      teacher_id: userId,
      term: termT,
      academic_year: yearT,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !created) {
    return {
      ok: false,
      error: error?.message ?? "Could not create report card",
    };
  }
  return { ok: true, id: (created as { id: string }).id };
}

export async function loadPendingReportCardsForSchool(
  schoolId: string
): Promise<PendingReportCardRow[]> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_school_admin", {
    p_school_id: schoolId,
  } as never);
  if (!isAdmin) return [];

  const admin = createAdminClient() as Db;
  const { data } = await admin
    .from("report_cards")
    .select(
      "id, term, academic_year, submitted_at, students(full_name), classes(name)"
    )
    .eq("school_id", schoolId)
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: false });

  const rows: PendingReportCardRow[] = [];
  for (const r of (data ?? []) as unknown as {
    id: string;
    term: string;
    academic_year: string;
    submitted_at: string | null;
    students: { full_name: string } | null;
    classes: { name: string } | null;
  }[]) {
    rows.push({
      id: r.id,
      studentName: r.students?.full_name ?? "—",
      className: r.classes?.name ?? "—",
      term: r.term,
      academicYear: r.academic_year,
      submittedAt: r.submitted_at,
    });
  }
  return rows;
}

export interface ReportCardGradebookExamPercentages {
  aprilMidtermPct: number | null;
  juneTerminalPct: number | null;
  septemberMidtermPct: number | null;
  decemberAnnualPct: number | null;
}

function normalizeGradebookAssignmentTitle(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function scoreCellToNumber(score: unknown): number | null {
  if (score == null) return null;
  if (typeof score === "number" && Number.isFinite(score)) return score;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

function percentFromScoreAndMax(
  score: unknown,
  maxScore: number
): number | null {
  const n = scoreCellToNumber(score);
  if (n == null) return null;
  const mx = Number(maxScore);
  if (!Number.isFinite(mx) || mx <= 0) return null;
  return Math.round((n / mx) * 1000) / 10;
}

const NORM_TITLE_TO_BUCKET: Record<
  string,
  keyof ReportCardGradebookExamPercentages
> = {
  [normalizeGradebookAssignmentTitle(
    GRADEBOOK_EXAM_ASSIGNMENT_TITLES.aprilMidterm
  )]: "aprilMidtermPct",
  [normalizeGradebookAssignmentTitle(
    GRADEBOOK_EXAM_ASSIGNMENT_TITLES.juneTerminal
  )]: "juneTerminalPct",
  [normalizeGradebookAssignmentTitle(
    GRADEBOOK_EXAM_ASSIGNMENT_TITLES.septemberMidterm
  )]: "septemberMidtermPct",
  [normalizeGradebookAssignmentTitle(
    GRADEBOOK_EXAM_ASSIGNMENT_TITLES.decemberAnnual
  )]: "decemberAnnualPct",
};

function emptyExamPercents(): ReportCardGradebookExamPercentages {
  return {
    aprilMidtermPct: null,
    juneTerminalPct: null,
    septemberMidtermPct: null,
    decemberAnnualPct: null,
  };
}

/**
 * Loads gradebook scores for preset exam assignments, converted to percentages
 * (0–100) per subject for report-card autofill.
 */
export async function loadStudentGradebookExamScores(params: {
  studentId: string;
  classId: string;
  subjects: string[];
  examNames?: string[];
  /** When set, restricts to subjects the student is enrolled in for that period. */
  term?: string;
  academicYear?: string;
}): Promise<
  | { ok: true; scoresBySubject: Record<string, ReportCardGradebookExamPercentages> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[loadStudentGradebookExamScores] not signed in");
    return { ok: false, error: "Not signed in" };
  }

  const admin = createAdminClient() as Db;

  const { data: ta } = await admin
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", user.id)
    .eq("class_id", params.classId)
    .limit(1)
    .maybeSingle();
  if (!ta) {
    console.error(
      "[loadStudentGradebookExamScores] no teacher_assignments row for class",
      { classId: params.classId, studentId: params.studentId }
    );
    return { ok: false, error: "You are not assigned to this class." };
  }

  const { data: stu } = await admin
    .from("students")
    .select("id")
    .eq("id", params.studentId)
    .eq("class_id", params.classId)
    .maybeSingle();
  if (!stu) {
    console.error(
      "[loadStudentGradebookExamScores] student not in class",
      { classId: params.classId, studentId: params.studentId }
    );
    return { ok: false, error: "Student not found in this class." };
  }

  let subjects = [
    ...new Set(params.subjects.map((s) => s.trim()).filter(Boolean)),
  ];
  if (subjects.length === 0) {
    return { ok: true, scoresBySubject: {} };
  }

  const hasTermYear =
    params.term != null &&
    String(params.term).trim() !== "" &&
    params.academicYear != null &&
    String(params.academicYear).trim() !== "";

  if (hasTermYear) {
    const termNorm = params.term!.trim();
    const termParsed: SubjectEnrollmentTerm =
      termNorm === "Term 2" ? "Term 2" : "Term 1";
    const yearInt = reportAcademicYearToEnrollmentYear(params.academicYear!);
    subjects = await getStudentEnrolledSubjects(admin, {
      studentId: params.studentId,
      classId: params.classId,
      academicYear: yearInt,
      term: termParsed,
      teacherSubjectLabels: subjects,
    });
  }
  if (subjects.length === 0) {
    return { ok: true, scoresBySubject: {} };
  }

  const nameList =
    params.examNames?.length && params.examNames.some((n) => n.trim())
      ? params.examNames
      : [...DEFAULT_REPORT_CARD_GRADEBOOK_EXAM_NAMES];
  const allowedNorm = new Set(
    nameList.map((n) => normalizeGradebookAssignmentTitle(n))
  );

  const { data: aRowsRaw, error: aErr } = await admin
    .from("teacher_gradebook_assignments")
    .select("id, title, max_score, subject, term")
    .eq("teacher_id", user.id)
    .eq("class_id", params.classId);

  if (aErr) {
    console.error(
      "[loadStudentGradebookExamScores] teacher_gradebook_assignments query failed",
      aErr
    );
    return { ok: false, error: aErr.message };
  }

  const termForAssignFilter = (params.term ?? "").trim();
  const aRows = (aRowsRaw ?? []).filter((row: { term: string | null }) => {
    if (termForAssignFilter !== "Term 1" && termForAssignFilter !== "Term 2") {
      return true;
    }
    const t = row.term;
    if (t == null || String(t).trim() === "") return true;
    return t === termForAssignFilter;
  });

  const subjectKeyByLower = new Map(
    subjects.map((s) => [s.trim().toLowerCase(), s.trim()] as const)
  );

  const metaByAssignmentId = new Map<
    string,
    { subject: string; maxScore: number; bucket: keyof ReportCardGradebookExamPercentages }
  >();

  for (const row of aRows) {
    const r = row as {
      id: string;
      title: string;
      max_score: number;
      subject: string;
    };
    const canonical = subjectKeyByLower.get(r.subject.trim().toLowerCase());
    if (!canonical) continue;
    const nt = normalizeGradebookAssignmentTitle(r.title);
    if (!allowedNorm.has(nt)) continue;
    const bucket = NORM_TITLE_TO_BUCKET[nt];
    if (!bucket) continue;
    metaByAssignmentId.set(r.id, {
      subject: canonical,
      maxScore: Number(r.max_score),
      bucket,
    });
  }

  const assignmentIds = [...metaByAssignmentId.keys()];
  const scoresBySubject: Record<string, ReportCardGradebookExamPercentages> =
    {};
  for (const sub of subjects) {
    scoresBySubject[sub] = emptyExamPercents();
  }

  if (assignmentIds.length === 0) {
    return { ok: true, scoresBySubject };
  }

  const { data: scRows, error: scErr } = await admin
    .from("teacher_scores")
    .select("assignment_id, score")
    .eq("student_id", params.studentId)
    .in("assignment_id", assignmentIds);

  if (scErr) {
    console.error(
      "[loadStudentGradebookExamScores] teacher_scores query failed",
      scErr
    );
    return { ok: false, error: scErr.message };
  }

  for (const srow of scRows ?? []) {
    const sr = srow as { assignment_id: string; score: unknown };
    const meta = metaByAssignmentId.get(sr.assignment_id);
    if (!meta) continue;
    const pct = percentFromScoreAndMax(sr.score, meta.maxScore);
    const subj = meta.subject;
    if (!scoresBySubject[subj]) {
      scoresBySubject[subj] = emptyExamPercents();
    }
    scoresBySubject[subj][meta.bucket] = pct;
  }

  return { ok: true, scoresBySubject };
}

/**
 * Builds class subject ranks for the parent report card view (admin client;
 * verifies parent_students link). Report cards in the class for the term/year
 * with status `approved` are included.
 */
export async function loadSubjectPositionsForParentReportCard(params: {
  parentUserId: string;
  focusStudentId: string;
  classId: string;
  term: string;
  academicYear: string;
}): Promise<Record<string, string>> {
  const admin = createAdminClient() as Db;
  const termNorm = params.term.trim();
  const yearNorm = params.academicYear.trim();

  const { data: psLink } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", params.parentUserId)
    .eq("student_id", params.focusStudentId)
    .maybeSingle();

  if (!psLink) return {};

  const { data: cards } = await admin
    .from("report_cards")
    .select("id, student_id")
    .eq("class_id", params.classId)
    .eq("term", termNorm)
    .eq("academic_year", yearNorm)
    .eq("status", "approved");

  if (!cards?.length) return {};

  const cardIds = (cards as { id: string; student_id: string }[]).map(
    (c) => c.id
  );
  const cardToStudent = new Map(
    (cards as { id: string; student_id: string }[]).map((c) => [
      c.id,
      c.student_id,
    ])
  );

  const selectWithExams =
    "id, report_card_id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade";
  const selectOverride = `${selectWithExams}, exam1_gradebook_original, exam2_gradebook_original, exam1_score_overridden, exam2_score_overridden`;
  const selectFull = `${selectOverride}, position`;

  let comsRes = await admin
    .from("teacher_report_card_comments")
    .select(selectFull)
    .in("report_card_id", cardIds);

  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectOverride)
      .in("report_card_id", cardIds);
  }

  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectWithExams)
      .in("report_card_id", cardIds);
  }

  if (comsRes.error || !comsRes.data) return {};

  const parseNumeric = (
    v: number | string | null | undefined
  ): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const commentsByStudent = new Map<string, ReportCardCommentRow[]>();

  for (const row of comsRes.data as {
    id: string;
    report_card_id: string;
    subject: string;
    comment: string | null;
    score_percent: number | string | null;
    letter_grade: string | null;
    exam1_score: number | string | null;
    exam2_score: number | string | null;
    calculated_score: number | string | null;
    calculated_grade: string | null;
    exam1_gradebook_original?: number | string | null;
    exam2_gradebook_original?: number | string | null;
    exam1_score_overridden?: boolean | null;
    exam2_score_overridden?: boolean | null;
    position?: number | string | null;
  }[]) {
    const sid = cardToStudent.get(row.report_card_id);
    if (!sid) continue;
    const list = commentsByStudent.get(sid) ?? [];
    list.push({
      id: row.id,
      subject: row.subject,
      comment: row.comment,
      scorePercent: parseNumeric(row.score_percent),
      letterGrade: row.letter_grade,
      exam1Score: parseNumeric(row.exam1_score),
      exam2Score: parseNumeric(row.exam2_score),
      calculatedScore: parseNumeric(row.calculated_score),
      calculatedGrade: row.calculated_grade,
      exam1GradebookOriginal: parseNumeric(row.exam1_gradebook_original),
      exam2GradebookOriginal: parseNumeric(row.exam2_gradebook_original),
      exam1ScoreOverridden: row.exam1_score_overridden === true,
      exam2ScoreOverridden: row.exam2_score_overridden === true,
      position: parseNumeric(row.position),
    });
    commentsByStudent.set(sid, list);
  }

  const students: StudentReportRow[] = (
    cards as { id: string; student_id: string }[]
  ).map((c) => ({
    studentId: c.student_id,
    fullName: "",
    parentEmail: null,
    reportCardId: c.id,
    status: "approved" as ReportCardStatus,
    comments: commentsByStudent.get(c.student_id) ?? [],
  }));

  const subjects = [
    ...new Set(students.flatMap((s) => s.comments.map((x) => x.subject))),
  ].sort((a, b) => a.localeCompare(b));

  return computeClassSubjectPositions(
    students,
    subjects,
    params.focusStudentId
  );
}

/**
 * Returns the cohort + class subject list + school_level needed to render
 * the parent-side report card footer (rank + total/avg). Mirrors the access
 * checks used by `loadSubjectPositionsForParentReportCard` so a parent can
 * only see classmates of a student they are linked to. Includes
 * `approved` report cards in the class cohort.
 */
export async function loadParentReportCardCohort(params: {
  parentUserId: string;
  focusStudentId: string;
  classId: string;
  term: string;
  academicYear: string;
}): Promise<{
  cohort: StudentReportRow[];
  subjects: string[];
  schoolLevel: SchoolLevel;
} | null> {
  const admin = createAdminClient() as Db;
  const termNorm = params.term.trim();
  const yearNorm = params.academicYear.trim();

  const { data: psLink } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", params.parentUserId)
    .eq("student_id", params.focusStudentId)
    .maybeSingle();
  if (!psLink) return null;

  const { data: classRow } = await admin
    .from("classes")
    .select("id, school_id")
    .eq("id", params.classId)
    .maybeSingle();
  const schoolId = (classRow as { school_id: string } | null)?.school_id;
  let schoolLevel: SchoolLevel = normalizeSchoolLevel(undefined);
  if (schoolId) {
    let res = await admin
      .from("schools")
      .select("school_level")
      .eq("id", schoolId)
      .maybeSingle();
    if (res.error && /column.*school_level/i.test(res.error.message ?? "")) {
      // Older deployments without the column — keep default.
      res = { data: null, error: null } as typeof res;
    }
    schoolLevel = normalizeSchoolLevel(
      (res.data as { school_level?: string | null } | null)?.school_level
    );
  }

  const { data: cards } = await admin
    .from("report_cards")
    .select("id, student_id")
    .eq("class_id", params.classId)
    .eq("term", termNorm)
    .eq("academic_year", yearNorm)
    .eq("status", "approved");

  if (!cards?.length) {
    return { cohort: [], subjects: [], schoolLevel };
  }

  const cardIds = (cards as { id: string; student_id: string }[]).map(
    (c) => c.id
  );
  const cardToStudent = new Map(
    (cards as { id: string; student_id: string }[]).map((c) => [
      c.id,
      c.student_id,
    ])
  );

  const selectWithExams =
    "id, report_card_id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade";
  const selectOverride = `${selectWithExams}, exam1_gradebook_original, exam2_gradebook_original, exam1_score_overridden, exam2_score_overridden`;
  const selectFull = `${selectOverride}, position`;

  let comsRes = await admin
    .from("teacher_report_card_comments")
    .select(selectFull)
    .in("report_card_id", cardIds);
  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectOverride)
      .in("report_card_id", cardIds);
  }
  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectWithExams)
      .in("report_card_id", cardIds);
  }
  if (comsRes.error || !comsRes.data) {
    return { cohort: [], subjects: [], schoolLevel };
  }

  const parseNumeric = (
    v: number | string | null | undefined
  ): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const commentsByStudent = new Map<string, ReportCardCommentRow[]>();
  for (const row of comsRes.data as {
    id: string;
    report_card_id: string;
    subject: string;
    comment: string | null;
    score_percent: number | string | null;
    letter_grade: string | null;
    exam1_score: number | string | null;
    exam2_score: number | string | null;
    calculated_score: number | string | null;
    calculated_grade: string | null;
    exam1_gradebook_original?: number | string | null;
    exam2_gradebook_original?: number | string | null;
    exam1_score_overridden?: boolean | null;
    exam2_score_overridden?: boolean | null;
    position?: number | string | null;
  }[]) {
    const sid = cardToStudent.get(row.report_card_id);
    if (!sid) continue;
    const list = commentsByStudent.get(sid) ?? [];
    list.push({
      id: row.id,
      subject: row.subject,
      comment: row.comment,
      scorePercent: parseNumeric(row.score_percent),
      letterGrade: row.letter_grade,
      exam1Score: parseNumeric(row.exam1_score),
      exam2Score: parseNumeric(row.exam2_score),
      calculatedScore: parseNumeric(row.calculated_score),
      calculatedGrade: row.calculated_grade,
      exam1GradebookOriginal: parseNumeric(row.exam1_gradebook_original),
      exam2GradebookOriginal: parseNumeric(row.exam2_gradebook_original),
      exam1ScoreOverridden: row.exam1_score_overridden === true,
      exam2ScoreOverridden: row.exam2_score_overridden === true,
      position: parseNumeric(row.position),
    });
    commentsByStudent.set(sid, list);
  }

  const cohort: StudentReportRow[] = (
    cards as { id: string; student_id: string }[]
  ).map((c) => ({
    studentId: c.student_id,
    fullName: "",
    parentEmail: null,
    reportCardId: c.id,
    status: "approved" as ReportCardStatus,
    comments: commentsByStudent.get(c.student_id) ?? [],
  }));

  const subjects = [
    ...new Set(cohort.flatMap((s) => s.comments.map((x) => x.subject))),
  ].sort((a, b) => a.localeCompare(b));

  return { cohort, subjects, schoolLevel };
}

/**
 * Class-wide subject rank map for a term (no `parent_students` check). Same
 * `approved` cohort and comment parsing as
 * {@link loadSubjectPositionsForParentReportCard}; used on the staff student
 * profile "full report card" preview to match the parent view.
 */
export async function loadSubjectPositionsForClassReportCard(params: {
  focusStudentId: string;
  classId: string;
  term: string;
  academicYear: string;
}): Promise<Record<string, string>> {
  const admin = createAdminClient() as Db;
  const termNorm = params.term.trim();
  const yearNorm = params.academicYear.trim();

  const { data: cards } = await admin
    .from("report_cards")
    .select("id, student_id")
    .eq("class_id", params.classId)
    .eq("term", termNorm)
    .eq("academic_year", yearNorm)
    .eq("status", "approved");

  if (!cards?.length) return {};

  const cardIds = (cards as { id: string; student_id: string }[]).map(
    (c) => c.id
  );
  const cardToStudent = new Map(
    (cards as { id: string; student_id: string }[]).map((c) => [
      c.id,
      c.student_id,
    ])
  );

  const selectWithExams =
    "id, report_card_id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade";
  const selectOverride = `${selectWithExams}, exam1_gradebook_original, exam2_gradebook_original, exam1_score_overridden, exam2_score_overridden`;
  const selectFull = `${selectOverride}, position`;

  let comsRes = await admin
    .from("teacher_report_card_comments")
    .select(selectFull)
    .in("report_card_id", cardIds);

  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectOverride)
      .in("report_card_id", cardIds);
  }

  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectWithExams)
      .in("report_card_id", cardIds);
  }

  if (comsRes.error || !comsRes.data) return {};

  const parseNumeric = (
    v: number | string | null | undefined
  ): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const commentsByStudent = new Map<string, ReportCardCommentRow[]>();

  for (const row of comsRes.data as {
    id: string;
    report_card_id: string;
    subject: string;
    comment: string | null;
    score_percent: number | string | null;
    letter_grade: string | null;
    exam1_score: number | string | null;
    exam2_score: number | string | null;
    calculated_score: number | string | null;
    calculated_grade: string | null;
    exam1_gradebook_original?: number | string | null;
    exam2_gradebook_original?: number | string | null;
    exam1_score_overridden?: boolean | null;
    exam2_score_overridden?: boolean | null;
    position?: number | string | null;
  }[]) {
    const sid = cardToStudent.get(row.report_card_id);
    if (!sid) continue;
    const list = commentsByStudent.get(sid) ?? [];
    list.push({
      id: row.id,
      subject: row.subject,
      comment: row.comment,
      scorePercent: parseNumeric(row.score_percent),
      letterGrade: row.letter_grade,
      exam1Score: parseNumeric(row.exam1_score),
      exam2Score: parseNumeric(row.exam2_score),
      calculatedScore: parseNumeric(row.calculated_score),
      calculatedGrade: row.calculated_grade,
      exam1GradebookOriginal: parseNumeric(row.exam1_gradebook_original),
      exam2GradebookOriginal: parseNumeric(row.exam2_gradebook_original),
      exam1ScoreOverridden: row.exam1_score_overridden === true,
      exam2ScoreOverridden: row.exam2_score_overridden === true,
      position: parseNumeric(row.position),
    });
    commentsByStudent.set(sid, list);
  }

  const students: StudentReportRow[] = (
    cards as { id: string; student_id: string }[]
  ).map((c) => ({
    studentId: c.student_id,
    fullName: "",
    parentEmail: null,
    reportCardId: c.id,
    status: "approved" as ReportCardStatus,
    comments: commentsByStudent.get(c.student_id) ?? [],
  }));

  const subjects = [
    ...new Set(students.flatMap((s) => s.comments.map((x) => x.subject))),
  ].sort((a, b) => a.localeCompare(b));

  return computeClassSubjectPositions(
    students,
    subjects,
    params.focusStudentId
  );
}

/**
 * Cohort and school level for report-card summary lines (no parent link).
 * Mirrors {@link loadParentReportCardCohort} without `parent_students`.
 */
export async function loadClassReportCardCohortForDashboard(params: {
  classId: string;
  term: string;
  academicYear: string;
}): Promise<{
  cohort: StudentReportRow[];
  subjects: string[];
  schoolLevel: SchoolLevel;
}> {
  const admin = createAdminClient() as Db;
  const termNorm = params.term.trim();
  const yearNorm = params.academicYear.trim();

  const { data: classRow } = await admin
    .from("classes")
    .select("id, school_id")
    .eq("id", params.classId)
    .maybeSingle();
  const schoolId = (classRow as { school_id: string } | null)?.school_id;
  let schoolLevel: SchoolLevel = normalizeSchoolLevel(undefined);
  if (schoolId) {
    let res = await admin
      .from("schools")
      .select("school_level")
      .eq("id", schoolId)
      .maybeSingle();
    if (res.error && /column.*school_level/i.test(res.error.message ?? "")) {
      res = { data: null, error: null } as typeof res;
    }
    schoolLevel = normalizeSchoolLevel(
      (res.data as { school_level?: string | null } | null)?.school_level
    );
  }

  const { data: cards } = await admin
    .from("report_cards")
    .select("id, student_id")
    .eq("class_id", params.classId)
    .eq("term", termNorm)
    .eq("academic_year", yearNorm)
    .eq("status", "approved");

  if (!cards?.length) {
    return { cohort: [], subjects: [], schoolLevel };
  }

  const cardIds = (cards as { id: string; student_id: string }[]).map(
    (c) => c.id
  );
  const cardToStudent = new Map(
    (cards as { id: string; student_id: string }[]).map((c) => [
      c.id,
      c.student_id,
    ])
  );

  const selectWithExams =
    "id, report_card_id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade";
  const selectOverride = `${selectWithExams}, exam1_gradebook_original, exam2_gradebook_original, exam1_score_overridden, exam2_score_overridden`;
  const selectFull = `${selectOverride}, position`;

  let comsRes = await admin
    .from("teacher_report_card_comments")
    .select(selectFull)
    .in("report_card_id", cardIds);
  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectOverride)
      .in("report_card_id", cardIds);
  }
  if (comsRes.error && isMissingColumnSchemaError(comsRes.error)) {
    comsRes = await admin
      .from("teacher_report_card_comments")
      .select(selectWithExams)
      .in("report_card_id", cardIds);
  }
  if (comsRes.error || !comsRes.data) {
    return { cohort: [], subjects: [], schoolLevel };
  }

  const parseNumeric = (
    v: number | string | null | undefined
  ): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const commentsByStudent = new Map<string, ReportCardCommentRow[]>();
  for (const row of comsRes.data as {
    id: string;
    report_card_id: string;
    subject: string;
    comment: string | null;
    score_percent: number | string | null;
    letter_grade: string | null;
    exam1_score: number | string | null;
    exam2_score: number | string | null;
    calculated_score: number | string | null;
    calculated_grade: string | null;
    exam1_gradebook_original?: number | string | null;
    exam2_gradebook_original?: number | string | null;
    exam1_score_overridden?: boolean | null;
    exam2_score_overridden?: boolean | null;
    position?: number | string | null;
  }[]) {
    const sid = cardToStudent.get(row.report_card_id);
    if (!sid) continue;
    const list = commentsByStudent.get(sid) ?? [];
    list.push({
      id: row.id,
      subject: row.subject,
      comment: row.comment,
      scorePercent: parseNumeric(row.score_percent),
      letterGrade: row.letter_grade,
      exam1Score: parseNumeric(row.exam1_score),
      exam2Score: parseNumeric(row.exam2_score),
      calculatedScore: parseNumeric(row.calculated_score),
      calculatedGrade: row.calculated_grade,
      exam1GradebookOriginal: parseNumeric(row.exam1_gradebook_original),
      exam2GradebookOriginal: parseNumeric(row.exam2_gradebook_original),
      exam1ScoreOverridden: row.exam1_score_overridden === true,
      exam2ScoreOverridden: row.exam2_score_overridden === true,
      position: parseNumeric(row.position),
    });
    commentsByStudent.set(sid, list);
  }

  const cohort: StudentReportRow[] = (
    cards as { id: string; student_id: string }[]
  ).map((c) => ({
    studentId: c.student_id,
    fullName: "",
    parentEmail: null,
    reportCardId: c.id,
    status: "approved" as ReportCardStatus,
    comments: commentsByStudent.get(c.student_id) ?? [],
  }));

  const subjects = [
    ...new Set(cohort.flatMap((s) => s.comments.map((x) => x.subject))),
  ].sort((a, b) => a.localeCompare(b));

  return { cohort, subjects, schoolLevel };
}

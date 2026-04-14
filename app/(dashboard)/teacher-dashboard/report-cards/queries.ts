import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  PendingReportCardRow,
  ReportCardCommentRow,
  ReportCardStatus,
  StudentReportRow,
  TeacherClassOption,
} from "./report-card-types";
import { isMissingColumnSchemaError } from "./report-card-schema-compat";
import { termDateRange } from "./report-card-dates";

export type {
  PendingReportCardRow,
  ReportCardCommentRow,
  ReportCardStatus,
  StudentReportRow,
  TeacherClassOption,
} from "./report-card-types";

export { termDateRange } from "./report-card-dates";

/** Same pattern as Grades / `data.ts` — admin client bypasses RLS on `teacher_assignments`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function loadTeacherReportCardOptions(): Promise<
  | {
      ok: true;
      schoolId: string;
      schoolName: string;
      logoUrl: string | null;
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
    return {
      ok: false,
      error:
        "No class assignments found. Ask your administrator to assign classes.",
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

  const classIds = [...new Set(rows.map((r) => r.class_id))];
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

  for (const r of rows) {
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

  const classes: TeacherClassOption[] = [];
  for (const [classId, v] of byClass) {
    const academicYears = [...v.years].filter(Boolean).sort();
    classes.push({ classId, className: v.name, academicYears });
  }
  classes.sort((a, b) => a.className.localeCompare(b.className));

  const primarySchoolId =
    rows[0]?.school_id ?? classSchoolIdById.get(rows[0]?.class_id ?? "") ?? "";
  let schoolId = primarySchoolId;
  let schoolName = "";
  let logoUrl: string | null = null;

  if (primarySchoolId) {
    const { data: schoolRow } = await admin
      .from("schools")
      .select("id, name, logo_url")
      .eq("id", primarySchoolId)
      .maybeSingle();
    const s = schoolRow as {
      id: string;
      name: string;
      logo_url: string | null;
    } | null;
    if (s) {
      schoolId = s.id;
      schoolName = s.name;
      logoUrl = s.logo_url;
    }
  }

  return {
    ok: true,
    schoolId,
    schoolName,
    logoUrl,
    teacherName,
    classes,
  };
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

export async function loadStudentsReportData(
  classId: string,
  term: string,
  academicYear: string
): Promise<
  | {
      ok: true;
      students: StudentReportRow[];
      attendanceByStudent: Record<
        string,
        { present: number; absent: number; late: number }
      >;
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

  const { data: studs, error: se } = await admin
    .from("students")
    .select("id, full_name, parent_email")
    .eq("class_id", classId)
    .order("full_name");

  if (se || !studs?.length) {
    return { ok: false, error: "No students in this class." };
  }

  const studentIds = (studs as { id: string }[]).map((s) => s.id);

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
    const selectFull =
      "id, report_card_id, subject, comment, score_percent, letter_grade, exam1_score, exam2_score, calculated_score, calculated_grade";
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

  const { data: attRows } = await admin
    .from("teacher_attendance")
    .select("student_id, status")
    .eq("class_id", classId)
    .in("student_id", studentIds)
    .gte("attendance_date", start)
    .lte("attendance_date", end);

  for (const a of (attRows ?? []) as {
    student_id: string;
    status: "present" | "absent" | "late";
  }[]) {
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

  return { ok: true, students, attendanceByStudent };
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

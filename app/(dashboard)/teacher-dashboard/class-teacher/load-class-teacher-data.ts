import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClassTeacherAttendanceRow,
  ClassTeacherGradeRow,
  ClassTeacherStudentParentRow,
} from "./class-teacher-table-types";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

type Admin = ReturnType<typeof createAdminClient>;

export type {
  ClassTeacherAttendanceRow,
  ClassTeacherGradeRow,
  ClassTeacherStudentParentRow,
} from "./class-teacher-table-types";

export async function loadClassTeacherStudentsWithParents(
  admin: Admin,
  classId: string
): Promise<ClassTeacherStudentParentRow[]> {
  const { data: studs, error } = await admin
    .from("students")
    .select("id, full_name, admission_number, status")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");
  if (error || !studs?.length) return [];

  const studentIds = (studs as { id: string }[]).map((s) => s.id);
  const { data: links } = await admin
    .from("parent_students")
    .select("student_id, parent_id")
    .in("student_id", studentIds);

  const parentIds = [
    ...new Set(
      ((links ?? []) as { parent_id: string }[]).map((l) => l.parent_id)
    ),
  ];
  const parentById = new Map<
    string,
    { full_name: string; phone: string | null; email: string | null }
  >();
  if (parentIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", parentIds);
    for (const p of (profs ?? []) as {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
    }[]) {
      parentById.set(p.id, {
        full_name: p.full_name?.trim() || "Parent",
        phone: p.phone?.trim() || null,
        email: p.email?.trim() || null,
      });
    }
  }

  const parentIdsByStudent = new Map<string, string[]>();
  for (const l of (links ?? []) as {
    student_id: string;
    parent_id: string;
  }[]) {
    const list = parentIdsByStudent.get(l.student_id) ?? [];
    if (!list.includes(l.parent_id)) list.push(l.parent_id);
    parentIdsByStudent.set(l.student_id, list);
  }

  const rows: ClassTeacherStudentParentRow[] = [];
  for (const s of studs as {
    id: string;
    full_name: string;
    admission_number: string | null;
  }[]) {
    const pids = parentIdsByStudent.get(s.id) ?? [];
    const parts: {
      name: string;
      phone: string | null;
      email: string | null;
    }[] = [];
    for (const pid of pids) {
      const par = parentById.get(pid);
      if (par)
        parts.push({
          name: par.full_name,
          phone: par.phone,
          email: par.email,
        });
    }
    const nameStr =
      parts.length > 0
        ? parts.map((p) => p.name).join("; ")
        : "—";
    const phones = parts
      .map((p) => p.phone)
      .filter((x): x is string => Boolean(x?.trim()));
    const emails = parts
      .map((p) => p.email)
      .filter((x): x is string => Boolean(x?.trim()));
    rows.push({
      studentId: s.id,
      studentName: s.full_name?.trim() || "Student",
      admissionNumber: s.admission_number?.trim() || null,
      parentName: nameStr,
      parentPhone: phones.length ? phones.join("; ") : null,
      parentEmail: emails.length ? emails.join("; ") : null,
      linkedParentId: pids.length > 0 ? pids[0]! : null,
    });
  }
  return rows;
}

export async function loadClassTeacherAttendanceOverview(
  admin: Admin,
  classId: string
): Promise<ClassTeacherAttendanceRow[]> {
  const att = await fetchAllRows({
    label: "class-teacher:attendance overview rows",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_attendance")
        .select(
          `
      id,
      attendance_date,
      status,
      teacher_id,
      subject_id,
      subjects ( name ),
      students ( full_name )
    `
        )
        .eq("class_id", classId)
        .order("attendance_date", { ascending: false })
        .range(from, to),
  });

  if (!att?.length) return [];

  const teacherIds = [
    ...new Set(
      (att as { teacher_id: string }[]).map((r) => r.teacher_id).filter(Boolean)
    ),
  ];
  const teacherNameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
      teacherNameById.set(
        p.id,
        p.full_name?.trim() || "Teacher"
      );
    }
  }

  const out: ClassTeacherAttendanceRow[] = [];
  for (const r of att as unknown as {
    id: string;
    attendance_date: string;
    status: string;
    subject_id: string | null;
    teacher_id: string;
    subjects: { name: string } | null;
    students: { full_name: string } | null;
  }[]) {
    const subjectName = r.subjects?.name?.trim()
      ? r.subjects.name.trim()
      : r.subject_id
        ? "Subject"
        : "Class (general)";
    out.push({
      id: r.id,
      attendanceDate: r.attendance_date,
      status: r.status,
      subjectName,
      studentName: r.students?.full_name?.trim() || "Student",
      recordedByName: teacherNameById.get(r.teacher_id) ?? null,
    });
  }
  return out;
}

export async function loadClassTeacherGradesReadOnly(
  admin: Admin,
  classId: string
): Promise<ClassTeacherGradeRow[]> {
  const assigns = await fetchAllRows<{
    id: string;
    subject: string;
    title: string;
    max_score: number;
    teacher_id: string;
  }>({
    label: "class-teacher:grades readonly assignments",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_gradebook_assignments")
        .select("id, subject, title, max_score, teacher_id")
        .eq("class_id", classId)
        .order("subject")
        .range(from, to),
  });
  if (!assigns?.length) return [];

  const assignmentIds = (assigns as { id: string }[]).map((a) => a.id);
  const teacherIds = [
    ...new Set(
      (assigns as { teacher_id: string }[]).map((a) => a.teacher_id).filter(Boolean)
    ),
  ];
  const teacherNameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", teacherIds);
    for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
      teacherNameById.set(p.id, p.full_name?.trim() || "Teacher");
    }
  }

  const scores = await fetchAllRows<{
    assignment_id: string;
    score: unknown;
    students: { full_name: string } | null;
  }>({
    label: "class-teacher:grades readonly scores",
    fetchPage: async (from, to) =>
      await admin
        .from("teacher_scores")
        .select(
          `
      assignment_id,
      score,
      students ( full_name )
    `
        )
        .in("assignment_id", assignmentIds)
        .range(from, to),
  });

  const scoreRows = (scores ?? []) as unknown as {
    assignment_id: string;
    score: unknown;
    students: { full_name: string } | null;
  }[];

  const assignMeta = new Map<
    string,
    { subject: string; title: string; max: number; teacherName: string | null }
  >();
  for (const a of assigns as unknown as {
    id: string;
    subject: string;
    title: string;
    max_score: number;
    teacher_id: string;
  }[]) {
    assignMeta.set(a.id, {
      subject: a.subject?.trim() || "—",
      title: a.title?.trim() || "—",
      max: Number(a.max_score),
      teacherName: teacherNameById.get(a.teacher_id) ?? null,
    });
  }

  const out: ClassTeacherGradeRow[] = [];
  for (const sc of scoreRows) {
    const m = assignMeta.get(sc.assignment_id);
    if (!m) continue;
    let scoreStr: string | null = null;
    if (sc.score != null && String(sc.score).trim() !== "") {
      scoreStr = String(sc.score);
    }
    out.push({
      studentName: sc.students?.full_name?.trim() || "Student",
      subject: m.subject,
      assignmentTitle: m.title,
      maxScore: m.max,
      score: scoreStr,
      teacherName: m.teacherName,
    });
  }
  out.sort((a, b) => {
    const sn = a.studentName.localeCompare(b.studentName);
    if (sn !== 0) return sn;
    const sub = a.subject.localeCompare(b.subject);
    if (sub !== 0) return sub;
    return a.assignmentTitle.localeCompare(b.assignmentTitle);
  });
  return out;
}

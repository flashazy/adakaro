import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listParentClassResultSubjects,
  loadParentMajorExamClassResults,
} from "./load-parent-major-exam-class-results";
import {
  loadParentAttendanceForStudent,
  loadParentClassResultSheets,
  loadParentReportCardsForStudent,
} from "./parent-child-tab-loaders";
import { loadParentSubjectResultsUnread } from "./parent-subject-results-unread";
import type { SubjectResultsUnreadState } from "@/lib/parent-subject-results-unread-types";
import { initialEmptySubjectResultsUnread } from "@/lib/parent-subject-results-unread-types";

export type ChildTabData = {
  reportCards: any[];
  classResultSheets: any[];
  attendance: any[];
  majorExamClassResults: any;
  classResultSubjects: string[];
  subjectResultsUnread: SubjectResultsUnreadState;
};

function emptyTabData(): ChildTabData {
  return {
    reportCards: [],
    classResultSheets: [],
    attendance: [],
    majorExamClassResults: { options: [], defaultOptionId: "" },
    classResultSubjects: [],
    subjectResultsUnread: initialEmptySubjectResultsUnread(),
  };
}

/**
 * Loads read-only data for parent child-card tabs. Verifies `parent_students`
 * before loading. Gradebook / noticeboard paths use the service role where
 * parent RLS cannot read those tables.
 */
export async function loadParentChildTabData(
  students: { id: string; class_id: string }[]
): Promise<Map<string, ChildTabData>> {
  const byStudent = new Map<string, ChildTabData>();
  for (const s of students) {
    byStudent.set(s.id, emptyTabData());
  }

  if (students.length === 0) return byStudent;

  const studentIds = students.map((s) => s.id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return byStudent;

  const { data: linkCheck } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", user.id)
    .in("student_id", studentIds);

  const allowed = new Set(
    ((linkCheck ?? []) as { student_id: string }[]).map((r) => r.student_id)
  );
  if (allowed.size === 0) return byStudent;

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  for (const s of students) {
    if (!allowed.has(s.id)) continue;
    const entry = byStudent.get(s.id);
    if (!entry) continue;

    const parentUserId = user.id;
    const studentId = s.id;
    const classId = s.class_id;

    let reportCards: any[] = [];
    try {
      reportCards = await loadParentReportCardsForStudent(supabase, {
        parentUserId,
        studentId,
      });
    } catch {
      reportCards = [];
    }

    let classResultSheets: any[] = [];
    if (admin) {
      try {
        classResultSheets = await loadParentClassResultSheets(admin, classId);
      } catch {
        classResultSheets = [];
      }
    }

    let attendance: any[] = [];
    try {
      attendance = await loadParentAttendanceForStudent(supabase, studentId);
      attendance.sort((x, y) => {
        if (x.attendance_date !== y.attendance_date) {
          return x.attendance_date < y.attendance_date ? 1 : -1;
        }
        return String(x.subjectName ?? "").localeCompare(
          String(y.subjectName ?? ""),
          undefined,
          { sensitivity: "base" }
        );
      });
    } catch {
      attendance = [];
    }

    let classResultSubjects: string[] = [];
    let majorExamClassResults: any = { options: [], defaultOptionId: "" };
    try {
      classResultSubjects = await listParentClassResultSubjects(classId);
    } catch {
      classResultSubjects = [];
    }
    try {
      majorExamClassResults =
        classResultSubjects.length > 0
          ? await loadParentMajorExamClassResults(
              classId,
              classResultSubjects[0]!
            )
          : { options: [], defaultOptionId: "" };
    } catch {
      majorExamClassResults = { options: [], defaultOptionId: "" };
    }

    let subjectResultsUnread: SubjectResultsUnreadState =
      initialEmptySubjectResultsUnread();
    if (admin) {
      try {
        subjectResultsUnread = await loadParentSubjectResultsUnread(
          supabase,
          parentUserId,
          studentId,
          classId
        );
      } catch {
        subjectResultsUnread = initialEmptySubjectResultsUnread();
      }
    }

    entry.reportCards = reportCards;
    entry.classResultSheets = classResultSheets;
    entry.attendance = attendance;
    entry.classResultSubjects = classResultSubjects;
    entry.majorExamClassResults = majorExamClassResults;
    entry.subjectResultsUnread = subjectResultsUnread;
  }

  return byStudent;
}

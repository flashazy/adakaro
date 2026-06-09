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
  loadParentReportCardsForStudentDebug,
  type ParentReportCardsLoadDebug,
} from "./parent-child-tab-loaders";
import { loadParentSubjectResultsUnread } from "./parent-subject-results-unread";
import type { SubjectResultsUnreadState } from "@/lib/parent-subject-results-unread-types";
import { initialEmptySubjectResultsUnread } from "@/lib/parent-subject-results-unread-types";
import { countParentChatUnreadForClass } from "@/lib/chat/parent-messages-unread";
import { reportParentDataLoadAlert } from "@/lib/watchdog/auth-health-alerts";

export type ChildTabData = {
  reportCards: any[];
  /** Server-side load trace for the Report cards tab (empty-state debugging). */
  reportCardsDebug: ParentReportCardsLoadDebug | null;
  classResultSheets: any[];
  attendance: any[];
  majorExamClassResults: any;
  classResultSubjects: string[];
  subjectResultsUnread: SubjectResultsUnreadState;
  messagesUnread: number;
};

function emptyTabData(): ChildTabData {
  return {
    reportCards: [],
    reportCardsDebug: null,
    classResultSheets: [],
    attendance: [],
    majorExamClassResults: { options: [], defaultOptionId: "" },
    classResultSubjects: [],
    subjectResultsUnread: initialEmptySubjectResultsUnread(),
    messagesUnread: 0,
  };
}

/**
 * Loads read-only data for parent child-card tabs. Verifies `parent_students`
 * before loading. Gradebook / noticeboard paths use the service role where
 * parent RLS cannot read those tables.
 */
export async function loadParentChildTabData(
  students: {
    id: string;
    school_id?: string | null;
    class_id: string;
    class_teacher_id?: string | null;
    enrollment_date: string | null;
  }[]
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
    const schoolId = s.school_id ?? null;
    const classId = s.class_id;
    const enrollmentDate = s.enrollment_date;

    let reportCards: any[] = [];
    let reportCardsDebug: ParentReportCardsLoadDebug | null = null;
    try {
      const loaded = await loadParentReportCardsForStudentDebug(supabase, {
        parentUserId,
        studentId,
        schoolId,
        enrollmentDate,
      });
      reportCards = loaded.rows;
      reportCardsDebug = loaded.debug;
    } catch (err) {
      reportParentDataLoadAlert({
        phase: "report_cards_tab",
        schoolId,
        studentId,
        error: err instanceof Error ? err.message : String(err),
      });
      reportCards = [];
      reportCardsDebug = {
        studentId,
        parentUserId,
        enrollmentDate,
        query: {
          table: "report_cards",
          filters: { student_id: studentId, status: "approved" },
        },
        rawApprovedCount: 0,
        rawApproved: [],
        afterEnrollmentFilterCount: 0,
        excludedByEnrollment: [],
        buildOutcomes: [],
        finalRowCount: 0,
        queryError: null,
        loadError:
          err instanceof Error ? err.message : "loadParentReportCardsForStudent",
      };
      console.log(
        "[parent-dashboard/report-cards]",
        JSON.stringify(reportCardsDebug, null, 2)
      );
    }

    let classResultSheets: any[] = [];
    if (admin) {
      try {
        classResultSheets = await loadParentClassResultSheets(admin, classId, {
          studentId,
          schoolId,
          enrollmentDate,
        });
      } catch {
        classResultSheets = [];
      }
    }

    let attendance: any[] = [];
    try {
      attendance = await loadParentAttendanceForStudent(
        supabase,
        studentId,
        enrollmentDate,
        schoolId
      );
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
      classResultSubjects = await listParentClassResultSubjects(classId, {
        enrollmentDate,
      });
    } catch {
      classResultSubjects = [];
    }
    try {
      majorExamClassResults =
        classResultSubjects.length > 0
          ? await loadParentMajorExamClassResults(
              classId,
              classResultSubjects[0]!,
              { enrollmentDate }
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
          classId,
          { enrollmentDate }
        );
      } catch {
        subjectResultsUnread = initialEmptySubjectResultsUnread();
      }
    }

    let messagesUnread = 0;
    try {
      messagesUnread = await countParentChatUnreadForClass(
        parentUserId,
        classId,
        s.class_teacher_id ?? null
      );
    } catch {
      messagesUnread = 0;
    }

    entry.reportCards = reportCards;
    entry.reportCardsDebug = reportCardsDebug;
    entry.classResultSheets = classResultSheets;
    entry.attendance = attendance;
    entry.classResultSubjects = classResultSubjects;
    entry.majorExamClassResults = majorExamClassResults;
    entry.subjectResultsUnread = subjectResultsUnread;
    entry.messagesUnread = messagesUnread;
  }

  return byStudent;
}

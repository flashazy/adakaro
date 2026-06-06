import type { UserRole } from "@/types/supabase";

export interface StudentProfileBackNav {
  href: string;
  label: string;
}

export const STUDENT_PROFILE_CLASS_TEACHER_ENTRY = "class-teacher";

/**
 * Resolves the profile header back button from the viewer's relationship to this
 * student. Class teachers never fall through to the academic student list.
 */
export function resolveStudentProfileBackNav(opts: {
  classTeacherForStudent: boolean;
  studentClassId: string;
  adminOk: boolean;
  hasAcademicDepartmentRole: boolean;
  hasAnyClassTeacherRole: boolean;
  primaryClassTeacherClassId: string | null;
  openedFromClassTeacherEntry: boolean;
  userRole: UserRole | null | undefined;
}): StudentProfileBackNav {
  const {
    classTeacherForStudent,
    studentClassId,
    adminOk,
    hasAcademicDepartmentRole,
    hasAnyClassTeacherRole,
    primaryClassTeacherClassId,
    openedFromClassTeacherEntry,
    userRole,
  } = opts;

  const studentClass = studentClassId.trim();

  if (classTeacherForStudent && studentClass) {
    return {
      href: `/teacher-dashboard/class-teacher/${studentClass}`,
      label: "← Back to class",
    };
  }

  const inClassTeacherContext =
    hasAnyClassTeacherRole &&
    !adminOk &&
    (openedFromClassTeacherEntry || userRole === "teacher");

  if (inClassTeacherContext) {
    const backClassId = primaryClassTeacherClassId?.trim();
    if (backClassId) {
      return {
        href: `/teacher-dashboard/class-teacher/${backClassId}`,
        label: "← Back to class",
      };
    }
    return {
      href: "/teacher-dashboard/class-teacher",
      label: "← Back to class",
    };
  }

  if (adminOk) {
    return {
      href: "/dashboard/students",
      label: "← Back to students",
    };
  }

  if (hasAcademicDepartmentRole) {
    return {
      href: "/teacher-dashboard/academic/student-profiles",
      label: "← Back to students",
    };
  }

  if (userRole === "teacher") {
    return {
      href: "/teacher-dashboard",
      label: "← Back to dashboard",
    };
  }

  return {
    href: "/dashboard/students",
    label: "← Back to students",
  };
}

/** Safe fallback when profile access is denied (no student context to link). */
export function resolveStudentProfileDeniedBackNav(opts: {
  userRole: UserRole | null | undefined;
  adminOk: boolean;
  hasAnyClassTeacherRole?: boolean;
}): string {
  if (opts.hasAnyClassTeacherRole && !opts.adminOk) {
    return "/teacher-dashboard/class-teacher";
  }
  if (opts.userRole === "teacher" && !opts.adminOk) {
    return "/teacher-dashboard";
  }
  return "/dashboard/students";
}

/// Minimal student row for teacher read-only lists (RLS may hide some fields).
class TeacherStudentMini {
  TeacherStudentMini({
    required this.id,
    required this.fullName,
    this.admissionNumber,
    required this.classId,
    this.status,
  });

  final String id;
  final String fullName;
  final String? admissionNumber;
  final String classId;
  final String? status;
}

/// One row from `teacher_assignments` prepared for UI.
class TeacherAssignmentDisplay {
  TeacherAssignmentDisplay({
    required this.id,
    required this.classId,
    required this.className,
    required this.schoolId,
    required this.subjectLabel,
    required this.academicYear,
  });

  final String id;
  final String classId;
  final String className;
  final String schoolId;
  final String subjectLabel;
  final String academicYear;
}

/// School-wide subject linked to the teacher (`teacher_subjects`).
class TeacherCatalogSubject {
  TeacherCatalogSubject({
    required this.subjectId,
    required this.name,
  });

  final String subjectId;
  final String name;
}

class TeacherHomeData {
  TeacherHomeData({
    required this.teacherName,
    required this.assignments,
    required this.catalogSubjects,
    required this.studentsByClassId,
    required this.classNames,
  });

  final String? teacherName;
  final List<TeacherAssignmentDisplay> assignments;
  final List<TeacherCatalogSubject> catalogSubjects;
  final Map<String, List<TeacherStudentMini>> studentsByClassId;
  final Map<String, String> classNames;
}

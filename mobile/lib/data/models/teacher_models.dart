/// Minimal student row for teacher roster lists.
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
    this.subjectId,
  });

  final String id;
  final String classId;
  final String className;
  final String schoolId;
  final String subjectLabel;
  final String academicYear;

  /// When set, attendance/marks align with subject enrolment.
  final String? subjectId;
}

class TeacherCatalogSubject {
  TeacherCatalogSubject({
    required this.subjectId,
    required this.name,
  });

  final String subjectId;
  final String name;
}

class TeacherClassTeacherBrief {
  const TeacherClassTeacherBrief({
    required this.id,
    required this.name,
    this.schoolId,
  });

  final String id;
  final String name;
  final String? schoolId;
}

/// School admin hints when teacher has no assignments (best-effort under RLS).
class TeacherLockedContact {
  TeacherLockedContact({
    required this.schoolName,
    required this.adminName,
    this.adminEmail,
    this.adminPhone,
    this.schoolLogoUrl,
  });

  final String schoolName;
  final String adminName;
  final String? adminEmail;
  final String? adminPhone;
  /// `schools.logo_url` when loaded for the locked teacher context.
  final String? schoolLogoUrl;
}

class TeacherLessonPlanListRow {
  TeacherLessonPlanListRow({
    required this.id,
    required this.lessonDate,
    required this.period,
    required this.className,
    required this.subjectName,
    required this.durationMinutes,
  });

  final String id;
  final String lessonDate;
  final String period;
  final String className;
  final String subjectName;
  final int durationMinutes;
}

/// Edit mode: [row] is a `lesson_plans` map from [TeacherRepository.loadLessonPlanDetail].
class TeacherLessonPlanEditSeed {
  const TeacherLessonPlanEditSeed({
    required this.id,
    required this.row,
  });

  final String id;
  final Map<String, dynamic> row;
}

/// Registered / present counts for lesson plan class profile (mirrors web demographics + attendance).
class TeacherLessonPlanClassProfile {
  const TeacherLessonPlanClassProfile({
    required this.registeredGirls,
    required this.registeredBoys,
    required this.registeredTotal,
    required this.presentGirls,
    required this.presentBoys,
    required this.presentTotal,
  });

  final int registeredGirls;
  final int registeredBoys;
  final int registeredTotal;
  final int presentGirls;
  final int presentBoys;
  final int presentTotal;

  static const TeacherLessonPlanClassProfile zeros = TeacherLessonPlanClassProfile(
    registeredGirls: 0,
    registeredBoys: 0,
    registeredTotal: 0,
    presentGirls: 0,
    presentBoys: 0,
    presentTotal: 0,
  );
}

class TeacherGradebookAssignmentMini {
  TeacherGradebookAssignmentMini({
    required this.id,
    required this.title,
    required this.maxScore,
    required this.weight,
    required this.subject,
    this.dueDate,
    this.term,
    this.academicYear,
    this.createdAt,
    this.examType,
  });

  final String id;
  final String title;
  final double maxScore;
  final double weight;
  final String subject;
  final String? dueDate;
  final String? term;
  final String? academicYear;
  final String? createdAt;
  /// Non-null for seeded major exams (`April_Midterm`, etc.); custom rows are null.
  final String? examType;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TeacherGradebookAssignmentMini && other.id == id;

  @override
  int get hashCode => id.hashCode;
}

/// Gradebook matrix for subject evaluation (matches web `loadGradebookClassMatrix`).
class TeacherGradebookMatrixSnapshot {
  TeacherGradebookMatrixSnapshot({
    required this.assignments,
    required this.students,
    required this.scoreMatrix,
  });

  final List<TeacherGradebookAssignmentMini> assignments;
  final List<TeacherEvaluateStudentRow> students;
  final Map<String, Map<String, TeacherEvaluateScoreCell>> scoreMatrix;
}

class TeacherEvaluateStudentRow {
  TeacherEvaluateStudentRow({
    required this.id,
    required this.fullName,
    this.gender,
  });

  final String id;
  final String fullName;
  final String? gender;
}

class TeacherEvaluateScoreCell {
  TeacherEvaluateScoreCell({this.score, this.remarks});

  final double? score;
  final String? remarks;
}

/// Header lines for subject evaluation report (web `loadFullGradeReportMeta`).
class TeacherEvaluateReportMeta {
  TeacherEvaluateReportMeta({
    required this.schoolName,
    required this.className,
    required this.subject,
    required this.teacherName,
    required this.termLabel,
  });

  final String schoolName;
  final String className;
  final String subject;
  final String teacherName;

  /// Academic year label from assignments (may be `—`).
  final String termLabel;
}

class TeacherDocumentRow {
  TeacherDocumentRow({
    required this.id,
    required this.documentName,
    required this.fileUrl,
    required this.fileType,
    required this.category,
    this.fileSize,
    required this.uploadedAt,
  });

  final String id;
  final String documentName;
  final String fileUrl;
  final String fileType;
  final String category;
  final int? fileSize;
  final String uploadedAt;
}

/// Full desktop context for teacher mobile home + feature tabs.
class TeacherDeskData {
  TeacherDeskData({
    required this.teacherName,
    required this.primarySchoolName,
    required this.assignments,
    required this.catalogSubjects,
    required this.studentsByClassId,
    required this.classNames,
    required this.hasTeachingAssignments,
    required this.classTeacherClasses,
    this.lockedContact,
    this.schoolLevel,
    this.schoolLogoUrl,
    this.teacherDepartments = const {},
    this.isCoordinator = false,
    this.hasProfileFinanceAccess = false,
    this.departmentContextSchoolId,
  });

  final String? teacherName;
  final String? primarySchoolName;
  /// `schools.logo_url` for the resolved primary school (or locked-desk school).
  final String? schoolLogoUrl;
  /// `primary` / `secondary` from `schools.school_level` when available.
  final String? schoolLevel;
  final List<TeacherAssignmentDisplay> assignments;
  final List<TeacherCatalogSubject> catalogSubjects;
  final Map<String, List<TeacherStudentMini>> studentsByClassId;
  final Map<String, String> classNames;

  /// True when at least one `teacher_assignments` row exists.
  final bool hasTeachingAssignments;
  final List<TeacherClassTeacherBrief> classTeacherClasses;

  /// Populated only when neither teaching assignments nor class-teacher role.
  final TeacherLockedContact? lockedContact;

  /// Normalized `department` values from `teacher_department_roles` (e.g. academic, finance, accounts).
  final Set<String> teacherDepartments;

  /// True when `teacher_coordinators` has at least one row for this teacher.
  final bool isCoordinator;

  /// `profiles.role` is `finance` or `accounts` (web parity for finance access).
  final bool hasProfileFinanceAccess;

  /// School id from `teacher_department_roles` when assignments/class-teacher give no school (e.g. dept-only teacher).
  final String? departmentContextSchoolId;

  bool get showFullLock =>
      !hasTeachingAssignments && classTeacherClasses.isEmpty;

  bool get showClassTeacherOnly =>
      !hasTeachingAssignments && classTeacherClasses.isNotEmpty;

  bool get showsClassTeacherResponsibility => classTeacherClasses.isNotEmpty;

  bool get showsCoordinatorResponsibility => isCoordinator;

  bool get showsAcademicDepartment =>
      teacherDepartments.contains('academic');

  bool get showsDisciplineDepartment =>
      teacherDepartments.contains('discipline');

  bool get showsHealthDepartment => teacherDepartments.contains('health');

  bool get showsFinanceResponsibility =>
      teacherDepartments.contains('finance') ||
      teacherDepartments.contains('accounts') ||
      hasProfileFinanceAccess;

  /// Any responsibility card in the Roles tab (excluding plain subject-teaching).
  bool get hasAnyAssignedResponsibility =>
      showsClassTeacherResponsibility ||
      showsCoordinatorResponsibility ||
      showsAcademicDepartment ||
      showsDisciplineDepartment ||
      showsHealthDepartment ||
      showsFinanceResponsibility;

  /// Resolves school for academic reports / dept flows (matches prior mobile logic, extended for dept-only).
  String? get resolvedSchoolIdForAcademicReports {
    if (assignments.isNotEmpty) return assignments.first.schoolId;
    for (final c in classTeacherClasses) {
      if (c.schoolId != null && c.schoolId!.trim().isNotEmpty) {
        return c.schoolId;
      }
    }
    return departmentContextSchoolId;
  }
}

/// @deprecated Prefer [TeacherDeskData]; kept for transitional imports.
typedef TeacherHomeData = TeacherDeskData;

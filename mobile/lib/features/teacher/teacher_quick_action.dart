/// Feature entry points used from the teacher home grid / navigation.
///
/// Maps to tabs or stacked routes handled by [TeacherMainScaffold].
enum TeacherQuickDestination {
  attendance,
  lessonPlans,
  marks,
  documents,

  /// Subject statistics (web “Evaluate Subject”).
  evaluateSubject,

  /// Academic department reports — may be empty under RLS.
  academicReports,
}

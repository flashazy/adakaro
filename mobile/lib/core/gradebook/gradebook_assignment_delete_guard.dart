/// Major school exams must not be deleted from the teacher marks UI.
/// Rows with a non-null [examType] are treated as major exams (DB constraint).
/// [title] fallback covers legacy rows without `exam_type` set.
bool isTeacherGradebookAssignmentDeletable({
  required String title,
  String? examType,
}) {
  if ((examType ?? '').trim().isNotEmpty) return false;
  switch (title.trim().toLowerCase()) {
    case 'april midterm examination':
    case 'june terminal examination':
    case 'september midterm examination':
    case 'december annual examination':
      return false;
    default:
      return true;
  }
}

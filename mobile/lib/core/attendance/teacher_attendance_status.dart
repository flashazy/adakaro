// Shared P/A/L rules for teacher (and related) attendance.
//
// Aligns with web `countAttendanceRollup`: late is stored separately but counts
// as attended for totals and rates; only absent reduces attendance.

/// Returns one of `present`, `absent`, or `late`.
String normalizeTeacherAttendanceStatus(String? raw) {
  switch ((raw ?? 'present').toLowerCase().trim()) {
    case 'absent':
      return 'absent';
    case 'late':
      return 'late';
    case 'present':
    default:
      return 'present';
  }
}

bool teacherAttendanceCountsAsAttended(String normalizedStatus) {
  return normalizedStatus == 'present' || normalizedStatus == 'late';
}

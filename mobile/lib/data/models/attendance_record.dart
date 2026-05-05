/// One row from `teacher_attendance` (parent RLS via linked student).
class AttendanceRecord {
  const AttendanceRecord({
    required this.id,
    required this.attendanceDate,
    required this.status,
    this.subjectId,
    required this.createdAt,
  });

  final String id;
  final String attendanceDate;
  final String status;
  final String? subjectId;
  final String createdAt;

  factory AttendanceRecord.fromJson(Map<String, dynamic> j) {
    return AttendanceRecord(
      id: j['id'] as String,
      attendanceDate: j['attendance_date'] as String,
      status: (j['status'] as String?)?.toLowerCase() ?? 'present',
      subjectId: j['subject_id'] as String?,
      createdAt: j['created_at'] as String? ?? '',
    );
  }
}

class StudentSummary {
  StudentSummary({
    required this.id,
    required this.fullName,
    this.admissionNumber,
    required this.schoolId,
    required this.classId,
    this.className,
    this.gender,
    this.dateOfBirth,
    this.status,
    this.parentName,
    this.parentPhone,
    this.schoolName,
    this.avatarUrl,
    required this.currencyCode,
  });

  final String id;
  final String fullName;
  final String? admissionNumber;
  final String schoolId;
  final String classId;
  final String? className;
  final String? gender;
  final String? dateOfBirth;
  final String? status;
  final String? parentName;
  final String? parentPhone;
  final String? schoolName;
  /// Public HTTPS URL when set by the school (same as web `students.avatar_url`).
  final String? avatarUrl;
  final String currencyCode;
}

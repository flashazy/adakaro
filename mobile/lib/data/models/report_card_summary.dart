Map<String, dynamic>? _singleRel(dynamic v) {
  if (v is Map<String, dynamic>) return v;
  if (v is List && v.isNotEmpty && v.first is Map<String, dynamic>) {
    return v.first as Map<String, dynamic>;
  }
  return null;
}

/// Row from `report_cards` visible to parents (approved per RLS), with nested school/class/student joins.
class ReportCardSummary {
  const ReportCardSummary({
    required this.id,
    required this.studentId,
    required this.classId,
    required this.schoolId,
    required this.teacherId,
    required this.term,
    required this.academicYear,
    required this.status,
    this.submittedAt,
    this.adminNote,
    this.approvedAt,
    this.createdAt,
    this.updatedAt,
    this.studentNameFromSchool,
    this.className,
    this.schoolName,
    this.logoUrl,
    this.schoolMotto,
    this.schoolStampUrl,
    this.headTeacherSignatureUrl,
    this.schoolLevel,
    this.teacherNameFromProfile,
  });

  final String id;
  final String studentId;
  final String classId;
  final String schoolId;
  final String teacherId;
  final String term;
  final String academicYear;
  final String status;
  final String? submittedAt;
  final String? adminNote;
  final String? approvedAt;
  final String? createdAt;
  final String? updatedAt;

  /// From nested `students.full_name` when the join succeeds.
  final String? studentNameFromSchool;
  final String? className;
  final String? schoolName;
  final String? logoUrl;
  final String? schoolMotto;
  final String? schoolStampUrl;
  final String? headTeacherSignatureUrl;

  /// `"primary"` or `"secondary"` from nested `schools`.
  final String? schoolLevel;

  /// From nested teacher profile — may be null under parent RLS.
  final String? teacherNameFromProfile;

  factory ReportCardSummary.fromJson(Map<String, dynamic> j) {
    final students = _singleRel(j['students']);
    final classes = _singleRel(j['classes']);
    final schools = _singleRel(j['schools']);
    final teacher = _singleRel(j['teacher']);

    final rawLevel = schools?['school_level'];

    String? motto = schools?['motto'] as String?;
    motto = motto?.trim();
    if (motto?.isEmpty ?? false) motto = null;

    return ReportCardSummary(
      id: j['id'] as String,
      studentId: j['student_id'] as String,
      classId: j['class_id'] as String,
      schoolId: j['school_id'] as String,
      teacherId: j['teacher_id'] as String,
      term: (j['term'] as String?) ?? '—',
      academicYear:
          j['academic_year'] == null ? '—' : j['academic_year'].toString(),
      status: (j['status'] as String?) ?? 'draft',
      submittedAt: j['submitted_at'] as String?,
      adminNote: j['admin_note'] as String?,
      approvedAt: j['approved_at'] as String?,
      createdAt: j['created_at'] as String?,
      updatedAt: j['updated_at'] as String?,
      studentNameFromSchool: students?['full_name'] as String?,
      className: classes?['name'] as String?,
      schoolName: schools?['name'] as String?,
      logoUrl: _trimUrl(schools?['logo_url'] as String?),
      schoolMotto: motto,
      schoolStampUrl: _trimUrl(schools?['school_stamp_url'] as String?),
      headTeacherSignatureUrl:
          _trimUrl(schools?['head_teacher_signature_url'] as String?),
      schoolLevel: rawLevel is String ? rawLevel : rawLevel?.toString(),
      teacherNameFromProfile: teacher?['full_name'] as String?,
    );
  }

  static String? _trimUrl(String? u) {
    final t = u?.trim();
    if (t == null || t.isEmpty) return null;
    return t;
  }
}

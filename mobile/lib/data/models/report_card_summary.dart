/// Row from `report_cards` visible to parents (pending_review / approved per RLS).
class ReportCardSummary {
  const ReportCardSummary({
    required this.id,
    required this.term,
    required this.academicYear,
    required this.status,
    this.submittedAt,
    this.adminNote,
  });

  final String id;
  final String term;
  final String academicYear;
  final String status;
  final String? submittedAt;
  final String? adminNote;

  factory ReportCardSummary.fromJson(Map<String, dynamic> j) {
    return ReportCardSummary(
      id: j['id'] as String,
      term: (j['term'] as String?) ?? '—',
      academicYear: j['academic_year'] == null
          ? '—'
          : j['academic_year'].toString(),
      status: (j['status'] as String?) ?? 'draft',
      submittedAt: j['submitted_at'] as String?,
      adminNote: j['admin_note'] as String?,
    );
  }
}

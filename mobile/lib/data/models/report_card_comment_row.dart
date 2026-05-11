/// Subject line from `teacher_report_card_comments` (parent read via report_cards RLS).
class ReportCardCommentRow {
  const ReportCardCommentRow({
    required this.id,
    required this.reportCardId,
    required this.subject,
    required this.term,
    required this.academicYear,
    required this.status,
    this.comment,
    this.scorePercent,
    this.letterGrade,
    this.exam1Score,
    this.exam2Score,
    this.calculatedScore,
    this.calculatedGrade,
    this.position,
    this.exam1ScoreOverridden,
    this.exam2ScoreOverridden,
  });

  final String id;
  final String reportCardId;
  final String subject;
  final String term;
  final String academicYear;
  final String status;
  final String? comment;
  final double? scorePercent;
  final String? letterGrade;
  final double? exam1Score;
  final double? exam2Score;
  final double? calculatedScore;
  final String? calculatedGrade;
  final int? position;
  final bool? exam1ScoreOverridden;
  final bool? exam2ScoreOverridden;

  factory ReportCardCommentRow.fromJson(Map<String, dynamic> j) {
    double? d(dynamic v) =>
        v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
    int? i(dynamic v) => v == null ? null : (v is int ? v : int.tryParse('$v'));
    bool? boolOrNull(dynamic v) {
      if (v == null) return null;
      if (v is bool) return v;
      if (v is num) return v != 0;
      final s = '$v'.trim().toLowerCase();
      if (s == 'true' || s == 't' || s == '1') return true;
      if (s == 'false' || s == 'f' || s == '0') return false;
      return null;
    }

    return ReportCardCommentRow(
      id: j['id'] as String,
      reportCardId: j['report_card_id'] as String,
      subject: (j['subject'] as String?)?.trim().isNotEmpty == true
          ? (j['subject'] as String).trim()
          : 'Subject',
      term: (j['term'] as String?) ?? '—',
      academicYear:
          j['academic_year'] == null ? '—' : j['academic_year'].toString(),
      status: (j['status'] as String?) ?? 'draft',
      comment: j['comment'] as String?,
      scorePercent: d(j['score_percent']),
      letterGrade: j['letter_grade'] as String?,
      exam1Score: d(j['exam1_score']),
      exam2Score: d(j['exam2_score']),
      calculatedScore: d(j['calculated_score']),
      calculatedGrade: j['calculated_grade'] as String?,
      position: i(j['position']),
      exam1ScoreOverridden: boolOrNull(j['exam1_score_overridden']),
      exam2ScoreOverridden: boolOrNull(j['exam2_score_overridden']),
    );
  }

  /// Never throws; skips rows that cannot be parsed (keeps Results tab resilient).
  static ReportCardCommentRow? tryFromJson(dynamic raw) {
    if (raw is! Map) return null;
    try {
      return ReportCardCommentRow.fromJson(Map<String, dynamic>.from(raw));
    } catch (_) {
      return null;
    }
  }
}

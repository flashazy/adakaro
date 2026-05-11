import '../data/models/fee_balance_row.dart';
import '../data/models/report_card_comment_row.dart';

/// Best N subjects for secondary roll-ups (matches web `SECONDARY_BEST_SUBJECT_COUNT`).
const int secondaryBestSubjectCount = 7;

double? _parseNum(dynamic v) {
  if (v == null) return null;
  final s = '$v'.trim();
  if (s.isEmpty) return null;
  return double.tryParse(s);
}

double? computeReportCardTermAverage(double? exam1, double? exam2) {
  if (exam1 == null || exam2 == null) return null;
  if (!exam1.isFinite || !exam2.isFinite) return null;
  return ((exam1 + exam2) / 2 * 10).roundToDouble() / 10;
}

/// Normalizes DB / API school level to `primary` or `secondary`.
String normalizeSchoolLevel(String? raw) {
  final v = (raw ?? '').trim().toLowerCase();
  return v == 'primary' ? 'primary' : 'secondary';
}

/// Map report-card academic year string (e.g. "2025/2026") to enrolment integer year.
int reportAcademicYearToEnrollmentYear(String reportYear) {
  final m = RegExp(r'\d{4}').firstMatch(reportYear.trim());
  if (m != null) return int.parse(m.group(0)!);
  return DateTime.now().year;
}

bool feeBalanceRowMatchesReportPeriod(
  String? feeStructureTerm,
  String reportTerm,
  String reportAcademicYear,
) {
  final ft = (feeStructureTerm ?? '').trim();
  if (ft.isEmpty) return false;
  final rt = reportTerm.trim();
  if (ft == rt) return true;
  final reportYear = reportAcademicYearToEnrollmentYear(reportAcademicYear);
  if (ft == '$reportYear') return true;
  final ym = RegExp(r'\d{4}').firstMatch(ft);
  if (ym != null) {
    final y = int.tryParse(ym.group(0)!);
    if (y == reportYear) return true;
  }
  return false;
}

({String start, String end}) termDateRange(String term, String academicYear) {
  final parts = academicYear.trim().split(RegExp(r'[-/]'));
  final startYear =
      int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? DateTime.now().year;
  final y2 = startYear + 1;
  switch (term.trim()) {
    case 'Term 1':
      return (start: '$y2-04-01', end: '$y2-06-30');
    case 'Term 2':
      return (start: '$y2-09-01', end: '$y2-12-31');
    default:
      return (start: '$y2-04-01', end: '$y2-06-30');
  }
}

/// Letter grade from 0–100% (bands match web Tanzania scales).
String letterGradeFromPercent(double? pct, String schoolLevel) {
  if (pct == null || !pct.isFinite) return '—';
  final p = pct;
  if (schoolLevel == 'primary') {
    if (p >= 82) return 'A';
    if (p >= 62) return 'B';
    if (p >= 42) return 'C';
    if (p >= 22) return 'D';
    return 'E';
  }
  if (p >= 75) return 'A';
  if (p >= 65) return 'B';
  if (p >= 45) return 'C';
  if (p >= 30) return 'D';
  return 'F';
}

double getMaxScoreForLevel(String schoolLevel) {
  return schoolLevel == 'primary' ? 50 : 100;
}

/// Mirrors web `termAverageFromComment`.
double? termAverageFromComment(ReportCardCommentRow c) {
  double? e1 = _parseNum(c.exam1Score);
  double? e2 = _parseNum(c.exam2Score);
  if (e1 == null && e2 == null && c.scorePercent != null) {
    e1 = c.scorePercent;
  }
  final storedCalc = _parseNum(c.calculatedScore);
  final computed = computeReportCardTermAverage(e1, e2);
  final avgRaw = computed ??
      ((storedCalc != null && storedCalc.isFinite) ? storedCalc : null);
  return (avgRaw != null && avgRaw.isFinite) ? avgRaw : null;
}

({
  String exam1,
  String exam2,
}) examLabelsForTerm(String term) {
  if (term.trim() == 'Term 2') {
    return (exam1: 'September Midterm', exam2: 'December Annual');
  }
  return (exam1: 'April Midterm', exam2: 'June Terminal');
}

String gradingScaleDescription(String schoolLevel) {
  return schoolLevel == 'primary'
      ? 'A 82–100% (41–50) · B 62–80% (31–40) · C 42–60% (21–30) · '
          'D 22–40% (11–20) · E 0–20% (0–10)'
      : 'A 75–100% · B 65–74% · C 45–64% · D 30–44% · F 0–29%';
}

String formatPercentOrDash(double? v) {
  if (v == null || !v.isFinite) return '—';
  return '${(v * 10).round() / 10}%';
}

class ReportCardFeeStatement {
  const ReportCardFeeStatement({
    required this.currencyCode,
    required this.totalFees,
    required this.amountPaid,
    required this.balanceDue,
  });

  final String currencyCode;
  final double totalFees;
  final double amountPaid;
  final double balanceDue;
}

ReportCardFeeStatement? feeStatementForBalances(
  List<FeeBalanceRow> balances,
  String studentId,
  String reportTerm,
  String reportAcademicYear,
  String currencyCode,
) {
  final matching = balances.where(
    (r) =>
        r.studentId == studentId &&
        feeBalanceRowMatchesReportPeriod(
            r.term, reportTerm, reportAcademicYear),
  );
  if (matching.isEmpty) return null;
  double totalFees = 0;
  double amountPaid = 0;
  double balanceDue = 0;
  for (final r in matching) {
    totalFees += r.totalFee;
    amountPaid += r.totalPaid;
    balanceDue += r.balance;
  }
  return ReportCardFeeStatement(
    currencyCode: currencyCode,
    totalFees: totalFees,
    amountPaid: amountPaid,
    balanceDue: balanceDue,
  );
}

class MobileReportRollup {
  MobileReportRollup({
    required this.totalMarksRounded,
    this.divisionLabel,
    this.divisionPoints,
    required this.contributingSubjects,
    required this.droppedSubjects,
    required this.subjectCountUsed,
    required this.scoredSubjectCount,
  });

  final int totalMarksRounded;
  final String? divisionLabel;
  final int? divisionPoints;
  final List<String> contributingSubjects;
  final bool droppedSubjects;
  final int subjectCountUsed;
  final int scoredSubjectCount;
}

MobileReportRollup? computeMobileReportRollup({
  required List<ReportCardCommentRow> lines,
  required String schoolLevel,
}) {
  final pairs = <({String subject, double avg})>[];
  final seen = <String>{};
  for (final c in lines) {
    final sub = c.subject.trim();
    final key = sub.toLowerCase();
    if (!seen.add(key)) continue;
    final avg = termAverageFromComment(c);
    if (avg != null && avg.isFinite) {
      pairs.add((subject: sub, avg: avg));
    }
  }
  if (pairs.isEmpty) return null;

  final ordered = [...pairs];
  ordered.sort((a, b) => b.avg.compareTo(a.avg));

  List<({String subject, double avg})> contributing;
  if (schoolLevel == 'secondary') {
    contributing =
        ordered.take(secondaryBestSubjectCount).toList(growable: false);
  } else {
    contributing = ordered;
  }

  final dropped =
      schoolLevel == 'secondary' && pairs.length > secondaryBestSubjectCount;

  final sumPct = contributing.fold<double>(0, (a, p) => a + p.avg);
  final maxScore = getMaxScoreForLevel(schoolLevel);
  final total = (sumPct * maxScore) / 100;

  String? divLabel;
  int? divPts;
  if (schoolLevel == 'secondary') {
    final grades = contributing
        .map((p) => letterGradeFromPercent(p.avg, schoolLevel))
        .toList();
    final div = _calculateDivision(grades);
    divLabel = div?.division;
    divPts = div?.totalPoints;
  }

  return MobileReportRollup(
    totalMarksRounded: total.round(),
    divisionLabel: divLabel,
    divisionPoints: divPts,
    contributingSubjects: contributing.map((e) => e.subject).toList(),
    droppedSubjects: dropped,
    subjectCountUsed: contributing.length,
    scoredSubjectCount: pairs.length,
  );
}

({int totalPoints, String division})? _calculateDivision(List<String> grades) {
  const pointsByGrade = {
    'A': 1,
    'B': 2,
    'C': 3,
    'D': 4,
    'F': 5,
    'E': 5,
  };
  final pts = <int>[];
  for (final g in grades) {
    final key = g.trim().toUpperCase();
    final p = pointsByGrade[key];
    if (p != null) pts.add(p);
  }
  if (pts.isEmpty) return null;
  final totalPoints = pts.fold<int>(0, (a, b) => a + b);
  return (
    totalPoints: totalPoints,
    division: _divisionLabelForPoints(totalPoints),
  );
}

String _divisionLabelForPoints(int totalPoints) {
  if (totalPoints <= 17) return 'I';
  if (totalPoints <= 21) return 'II';
  if (totalPoints <= 25) return 'III';
  if (totalPoints <= 33) return 'IV';
  return '0';
}

String bannerLabelForReportStatus(String status) {
  switch (status) {
    case 'approved':
      return 'Approved — may be printed and shared.';
    case 'pending_review':
      return 'Pending review — awaiting head teacher approval.';
    case 'changes_requested':
      return 'Head teacher requested changes — your school is updating this report.';
    default:
      return 'Report card';
  }
}

String displayGradeForSubject(ReportCardCommentRow c, String schoolLevel) {
  final g = (c.calculatedGrade ?? c.letterGrade ?? '').trim();
  if (g.isNotEmpty) return g;
  final avg = termAverageFromComment(c);
  if (avg == null) return '—';
  return letterGradeFromPercent(avg, schoolLevel);
}

String displaySubjectPosition(ReportCardCommentRow c) {
  if (c.position != null && c.position! >= 1) return '${c.position}';
  return '—';
}

String attendanceSummaryLine(int present, int absent, int late) {
  final presentDays = present + late;
  if (presentDays == 0 && absent == 0) {
    return 'No attendance logged for this term window.';
  }
  return 'Present/Late ~$presentDays days · absent $absent this term '
      '(school calendar)';
}

/// Narrative summary using only this student's subject lines (no class rank).
String buildMobileReportSummaryParagraph({
  required String studentName,
  required String term,
  required String academicYear,
  required String schoolLevel,
  MobileReportRollup? rollup,
}) {
  final name = studentName.trim().isEmpty ? 'This student' : studentName.trim();
  final examPhrase =
      [term.trim(), academicYear.trim()].where((x) => x.isNotEmpty).join(' ');
  if (rollup == null) {
    return '$name — $examPhrase: there are not enough recorded subject '
        'marks on this report to build a total yet.';
  }
  final divPart = schoolLevel == 'secondary' && rollup.divisionLabel != null
      ? ' Division ${rollup.divisionLabel}'
          '${rollup.divisionPoints != null ? ' (${rollup.divisionPoints} points)' : ''}.'
      : '';
  final capNote = rollup.droppedSubjects
      ? ' Total uses the best $secondaryBestSubjectCount subject averages for secondary schools.'
      : '';
  return '$name completed the $examPhrase examinations with an indicative '
      'total of ${rollup.totalMarksRounded} marks (from '
      '${rollup.subjectCountUsed} contributing subject average'
      '${rollup.subjectCountUsed == 1 ? '' : 's'}).$divPart$capNote '
      'Overall class position, if used by your school, may appear on the printed report.';
}

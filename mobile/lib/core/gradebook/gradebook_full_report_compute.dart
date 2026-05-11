import 'tanzania_grades.dart';

/// Draft shape: assignmentId -> studentId -> cell (mirrors web `ClassDraft`).
typedef ClassDraft = Map<String, Map<String, DraftCell>>;

class DraftCell {
  DraftCell({required this.score, required this.remarks});

  final String score;
  final String remarks;
}

class PassRateStats {
  PassRateStats({
    required this.passRateLine,
    required this.boysLine,
    required this.girlsLine,
  });

  final String passRateLine;
  final String boysLine;
  final String girlsLine;
}

class FailRateStats {
  FailRateStats({
    required this.failRateLine,
    required this.boysLine,
    required this.girlsLine,
  });

  final String failRateLine;
  final String boysLine;
  final String girlsLine;
}

class GradeDist {
  GradeDist({this.a = 0, this.b = 0, this.c = 0, this.d = 0, this.e = 0, this.f = 0});

  int a;
  int b;
  int c;
  int d;
  int e;
  int f;
}

class AssignmentStats {
  AssignmentStats({
    required this.passing,
    required this.failing,
    required this.dist,
  });

  final PassRateStats passing;
  final FailRateStats failing;
  final GradeDist dist;
}

class RankingRow {
  RankingRow({
    required this.rank,
    required this.name,
    required this.scorePct,
    required this.grade,
    required this.badge,
  });

  final int rank;
  final String name;
  final String scorePct;
  final String grade;
  final String badge;
}

double? cellPercentFromDraft(String? raw, double maxScore) {
  final trimmed = (raw ?? '').trim();
  if (trimmed.isEmpty) return null;
  final n = double.tryParse(trimmed.replaceAll(',', '.'));
  if (n == null || !n.isFinite || maxScore <= 0) return null;
  return tanzaniaPercentFromScore(n, maxScore);
}

({String scoreLabel, String grade, double? pct}) scoreGradeForAssignment(
  String? raw,
  double maxScore,
  String? schoolLevel,
) {
  final trimmed = (raw ?? '').trim();
  if (trimmed.isEmpty) {
    return (scoreLabel: '—', grade: '—', pct: null);
  }
  final n = double.tryParse(trimmed.replaceAll(',', '.'));
  if (n == null || !n.isFinite) {
    return (scoreLabel: '—', grade: '—', pct: null);
  }
  final pct = tanzaniaPercentFromScore(n, maxScore);
  if (pct == null) return (scoreLabel: '—', grade: '—', pct: null);
  final letter = tanzaniaLetterGrade(pct, schoolLevel);
  final scoreLabel = '${pct.toStringAsFixed(1)}%';
  return (scoreLabel: scoreLabel, grade: letter, pct: pct);
}

double pctRate(int part, int whole) {
  if (whole <= 0) return 0;
  return ((part / whole) * 1000).round() / 10;
}

String passRateLineWithGrade(
  int part,
  int whole,
  String outOfNoun,
  String? schoolLevel,
) {
  final r = pctRate(part, whole);
  final letter = tanzaniaLetterGrade(r, schoolLevel);
  return '$r% ($part out of $whole $outOfNoun) ($letter)';
}

({PassRateStats passing, FailRateStats failing}) emptyPassFailStats() {
  const empty = '— (0 out of 0 students)';
  const emptyBoys = '— (0 out of 0 boys)';
  const emptyGirls = '— (0 out of 0 girls)';
  return (
    passing: PassRateStats(
      passRateLine: empty,
      boysLine: emptyBoys,
      girlsLine: emptyGirls,
    ),
    failing: FailRateStats(
      failRateLine: empty,
      boysLine: emptyBoys,
      girlsLine: emptyGirls,
    ),
  );
}

({PassRateStats passing, FailRateStats failing}) computePassFailRates(
  List<({String id, double pct, String letter, String? gender})> cells,
  String? schoolLevel,
) {
  if (cells.isEmpty) {
    final e = emptyPassFailStats();
    return (passing: e.passing, failing: e.failing);
  }
  final passingMin = passingThresholdPercent(schoolLevel);
  final total = cells.length;
  final passingCells = cells.where((c) => c.pct >= passingMin).toList();
  final failingCells = cells.where((c) => c.pct < passingMin).toList();

  final boysAll = cells.where((c) => c.gender == 'male').toList();
  final girlsAll = cells.where((c) => c.gender == 'female').toList();
  final boysPass = passingCells.where((c) => c.gender == 'male').toList();
  final girlsPass = passingCells.where((c) => c.gender == 'female').toList();
  final boysFail = failingCells.where((c) => c.gender == 'male').toList();
  final girlsFail = failingCells.where((c) => c.gender == 'female').toList();

  final passCount = passingCells.length;
  final failCount = failingCells.length;

  final passing = PassRateStats(
    passRateLine: passRateLineWithGrade(passCount, total, 'students', schoolLevel),
    boysLine: boysAll.isNotEmpty
        ? passRateLineWithGrade(boysPass.length, boysAll.length, 'boys', schoolLevel)
        : '— (0 out of 0 boys)',
    girlsLine: girlsAll.isNotEmpty
        ? passRateLineWithGrade(girlsPass.length, girlsAll.length, 'girls', schoolLevel)
        : '— (0 out of 0 girls)',
  );

  final failing = FailRateStats(
    failRateLine:
        '${pctRate(failCount, total)}% ($failCount out of $total students)',
    boysLine: boysAll.isNotEmpty
        ? '${pctRate(boysFail.length, boysAll.length)}% (${boysFail.length} out of ${boysAll.length} boys)'
        : '— (0 out of 0 boys)',
    girlsLine: girlsAll.isNotEmpty
        ? '${pctRate(girlsFail.length, girlsAll.length)}% (${girlsFail.length} out of ${girlsAll.length} girls)'
        : '— (0 out of 0 girls)',
  );

  return (passing: passing, failing: failing);
}

AssignmentStats computeReportStatsForAssignment(
  List<({String id, String? gender})> students,
  ({String id, double maxScore}) assignment,
  ClassDraft draft,
  String? schoolLevel,
) {
  final cells = <({String id, double pct, String letter, String? gender})>[];
  for (final s in students) {
    final raw = draft[assignment.id]?[s.id]?.score ?? '';
    final p = cellPercentFromDraft(raw, assignment.maxScore);
    if (p == null) continue;
    final letter = tanzaniaLetterGrade(p, schoolLevel);
    cells.add((id: s.id, pct: p, letter: letter, gender: s.gender));
  }

  final pf = computePassFailRates(cells, schoolLevel);
  final dist = GradeDist();
  for (final c in cells) {
    switch (c.letter) {
      case 'A':
        dist.a++;
        break;
      case 'B':
        dist.b++;
        break;
      case 'C':
        dist.c++;
        break;
      case 'D':
        dist.d++;
        break;
      case 'E':
        dist.e++;
        break;
      case 'F':
        dist.f++;
        break;
      default:
        break;
    }
  }

  return AssignmentStats(passing: pf.passing, failing: pf.failing, dist: dist);
}

List<RankingRow> buildStudentRanking(
  List<({String id, String fullName})> students,
  ({String id, double maxScore}) assignment,
  ClassDraft draft,
  String? schoolLevel,
) {
  final scored = <({String id, String name, double pct, String scoreLabel, String grade})>[];
  for (final s in students) {
    final g = scoreGradeForAssignment(
      draft[assignment.id]?[s.id]?.score,
      assignment.maxScore,
      schoolLevel,
    );
    if (g.pct == null) continue;
    scored.add((
      id: s.id,
      name: s.fullName,
      pct: g.pct!,
      scoreLabel: g.scoreLabel,
      grade: g.grade,
    ));
  }
  scored.sort((a, b) {
    if (b.pct != a.pct) return b.pct.compareTo(a.pct);
    return a.name.toLowerCase().compareTo(b.name.toLowerCase());
  });

  final n = scored.length;
  final out = <RankingRow>[];
  for (var i = 0; i < scored.length; i++) {
    final row = scored[i];
    final rank = i + 1;
    final parts = <String>[];
    if (rank == 1 && n >= 1) parts.add('Top performer');
    if (rank == 2) parts.add('2nd');
    if (rank == 3) parts.add('3rd');
    if (n >= 2 && rank == n && n > 3) parts.add('Needs improvement');
    out.add(
      RankingRow(
        rank: rank,
        name: row.name,
        scorePct: row.scoreLabel,
        grade: row.grade,
        badge: parts.join(' · '),
      ),
    );
  }
  return out;
}

String buildPlainTextReport({
  required TeacherEvaluateReportMetaLines meta,
  required ({String id, String title, double maxScore}) assignment,
  required List<({String id, String fullName, String? gender})> students,
  required AssignmentStats stats,
  required List<RankingRow> ranking,
  required ClassDraft draft,
  required String? schoolLevel,
}) {
  final passingPct = passingThresholdPercent(schoolLevel);
  final failingLetter = schoolLevel == 'primary' ? 'E' : 'F';
  final failingCount = schoolLevel == 'primary' ? stats.dist.e : stats.dist.f;

  final lines = <String>[
    meta.schoolName.toUpperCase(),
    '${meta.className} — ${meta.subject}',
    'Teacher: ${meta.teacherName}',
    'Term: ${meta.termLabel}',
    'Assignment: ${assignment.title} (max ${assignment.maxScore})',
    '',
    'CLASS STATISTICS (this assignment)',
    'PASSING STUDENTS (score ≥ $passingPct%)',
    'Pass rate: ${stats.passing.passRateLine}',
    'Boys pass rate: ${stats.passing.boysLine}',
    'Girls pass rate: ${stats.passing.girlsLine}',
    '',
    'FAILING STUDENTS (score < $passingPct%)',
    'Fail rate: ${stats.failing.failRateLine}',
    'Boys fail rate: ${stats.failing.boysLine}',
    'Girls fail rate: ${stats.failing.girlsLine}',
    '',
    'Grade distribution — A: ${stats.dist.a}  B: ${stats.dist.b}  C: ${stats.dist.c}  D: ${stats.dist.d}  $failingLetter: $failingCount',
    '',
    'STUDENT RANKING (highest to lowest)',
    if (ranking.isEmpty) '(No scores entered for this assignment.)',
    ...ranking.map((r) => '${r.rank}. ${r.name}  ${r.scorePct} (${r.grade})  ${r.badge}'.trim()),
    '',
    'STUDENT SCORES & REMARKS',
    'Student\tGender\tScore\tGrade\tRemarks',
  ];

  for (final s in students) {
    final g = scoreGradeForAssignment(
      draft[assignment.id]?[s.id]?.score,
      assignment.maxScore,
      schoolLevel,
    );
    final genderLabel = s.gender == 'male'
        ? 'Male'
        : s.gender == 'female'
            ? 'Female'
            : '—';
    final remarks = draft[assignment.id]?[s.id]?.remarks.trim() ?? '';
    lines.add('${s.fullName}\t$genderLabel\t${g.scoreLabel}\t${g.grade}\t$remarks');
  }

  return lines.join('\n');
}

/// Minimal meta for plain-text builder (maps from `TeacherEvaluateReportMeta`).
class TeacherEvaluateReportMetaLines {
  TeacherEvaluateReportMetaLines({
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
  final String termLabel;
}

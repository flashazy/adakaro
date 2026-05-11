/// Tanzania grading (mirrors web `lib/tanzania-grades.ts`).
double? tanzaniaPercentFromScore(double score, double max) {
  if (max <= 0 || !score.isFinite) return null;
  return ((score / max) * 1000).round() / 10;
}

int passingThresholdPercent(String? schoolLevel) {
  return schoolLevel == 'primary' ? 22 : 30;
}

String tanzaniaLetterGrade(double? percent, String? schoolLevel) {
  if (percent == null || percent.isNaN) return '—';
  if (schoolLevel == 'primary') {
    if (percent >= 82) return 'A';
    if (percent >= 62) return 'B';
    if (percent >= 42) return 'C';
    if (percent >= 22) return 'D';
    return 'E';
  }
  if (percent >= 75) return 'A';
  if (percent >= 65) return 'B';
  if (percent >= 45) return 'C';
  if (percent >= 30) return 'D';
  return 'F';
}

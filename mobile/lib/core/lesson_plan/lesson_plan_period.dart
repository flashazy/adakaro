// Mirrors `lib/lesson-plan-period.ts` for lesson plan period storage on mobile.

const List<int> kLessonPlanPeriodCheckboxRange = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10
];

const List<int> kDurationPresets = [40, 60, 80, 120];

String ordinalPeriod(int n) {
  final j = n % 10;
  final k = n % 100;
  if (j == 1 && k != 11) return '${n}st';
  if (j == 2 && k != 12) return '${n}nd';
  if (j == 3 && k != 13) return '${n}rd';
  return '${n}th';
}

/// Stored value, e.g. `"1st period"` or `"1st & 2nd period"`.
String periodsToStorageString(List<int> periods) {
  final sorted = periods.where((n) => n >= 1 && n <= 10).toSet().toList()
    ..sort();
  if (sorted.isEmpty) return '1st period';
  return '${sorted.map(ordinalPeriod).join(' & ')} period';
}

bool isConsecutivePeriods(List<int> periods) {
  if (periods.length <= 1) return true;
  final s = [...periods]..sort();
  for (var i = 1; i < s.length; i++) {
    if (s[i] != s[i - 1] + 1) return false;
  }
  return true;
}

/// Backward compatible: numeric DB values, or strings like `"1st period"` / `"1st & 2nd period"`.
/// Mirrors `parsePeriodsFromDb` in `lib/lesson-plan-period.ts`.
List<int> parsePeriodsFromDb(Object? value) {
  if (value == null) return [1];
  if (value is num && value.isFinite) {
    final n = value.floor();
    return (n >= 1 && n <= 10) ? [n] : [1];
  }
  final re = RegExp(r'\b(\d+)(?:st|nd|rd|th)\b', caseSensitive: false);
  final nums = <int>[];
  for (final m in re.allMatches('$value')) {
    final v = int.tryParse(m.group(1) ?? '') ?? 0;
    if (v >= 1 && v <= 10) nums.add(v);
  }
  final uniq = nums.toSet().toList()..sort();
  return uniq.isNotEmpty ? uniq : [1];
}

/// Display only; strips trailing ` period` (mirrors web `formatPeriodForDisplay`).
String formatPeriodForDisplay(Object? value) {
  if (value is num && value.isFinite) {
    return ordinalPeriod(value.floor());
  }
  final period = '$value'.trim();
  if (period.isEmpty) return '\u2014';
  return period
      .replaceAll(RegExp(r'\s+period$', caseSensitive: false), '')
      .trim();
}

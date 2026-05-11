/// Returns a professionally title-cased name, or empty if [profileName] is blank.
/// Strips a leading `test` demo prefix when it clearly prefixes a real name
/// (e.g. `testHALIMA SAIDI` → title case without the prefix).
String formatParentHeroDisplayName(String? profileName) {
  final raw = profileName?.trim();
  if (raw == null || raw.isEmpty) return '';
  return toHeroProfessionalTitleCase(stripLeadingTestDemoPrefix(raw));
}

/// Title-cases school/class lines for the hero (e.g. `FORM ONE` → `Form One`).
String formatHeroContextLine(String line) {
  final t = line.trim();
  if (t.isEmpty) return line;
  return toHeroProfessionalTitleCase(t);
}

String stripLeadingTestDemoPrefix(String input) {
  var t = input.trim();
  if (t.isEmpty) return t;

  final lower = t.toLowerCase();
  if (lower.startsWith('test ')) {
    return t.substring(5).trimLeft();
  }

  final glued = RegExp(r'^test(?=[A-Z\s])', caseSensitive: false);
  if (glued.hasMatch(t) && t.length > 4) {
    return t.substring(4).trimLeft();
  }

  return t;
}

String toHeroProfessionalTitleCase(String input) {
  return input
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .map(_titleCaseWord)
      .join(' ');
}

String _titleCaseWord(String word) {
  return word.split('-').map((segment) {
    if (segment.isEmpty) return segment;
    final lower = segment.toLowerCase();
    if (_isRomanNumeralToken(lower)) {
      return lower.toUpperCase();
    }
    return '${lower[0].toUpperCase()}${lower.substring(1)}';
  }).join('-');
}

bool _isRomanNumeralToken(String s) {
  if (s.isEmpty) return false;
  return RegExp(r'^[ivxlcdm]+$', caseSensitive: false).hasMatch(s) &&
      s.length <= 5;
}

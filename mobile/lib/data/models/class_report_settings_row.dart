/// Row from `class_report_settings` visible to parents linked to the class.
class ClassReportSettingsRow {
  const ClassReportSettingsRow({
    this.closingDate,
    this.openingDate,
    this.coordinatorMessage,
    this.requiredItems,
  });

  final String? closingDate;
  final String? openingDate;
  final String? coordinatorMessage;
  final List<String>? requiredItems;

  factory ClassReportSettingsRow.fromJson(Map<String, dynamic> j) {
    List<String>? items;
    final raw = j['required_items'];
    if (raw is List) {
      final out = <String>[];
      for (final e in raw) {
        final s = '$e'.trim();
        if (s.isNotEmpty) out.add(s);
      }
      if (out.isNotEmpty) items = out;
    }

    return ClassReportSettingsRow(
      closingDate: j['closing_date'] as String?,
      openingDate: j['opening_date'] as String?,
      coordinatorMessage: j['coordinator_message'] as String?,
      requiredItems: items,
    );
  }
}

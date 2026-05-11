import 'class_report_settings_row.dart';

/// Optional blocks loaded when viewing a single report card (settings + attendance counts).
class ReportCardDetailExtras {
  const ReportCardDetailExtras({
    this.settings,
    this.attendancePresent = 0,
    this.attendanceAbsent = 0,
    this.attendanceLate = 0,
  });

  final ClassReportSettingsRow? settings;
  final int attendancePresent;
  final int attendanceAbsent;
  final int attendanceLate;
}

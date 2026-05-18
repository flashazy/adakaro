import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/lesson_plan/lesson_plan_period.dart';
import '../../data/models/teacher_models.dart';

const _emDash = '\u2014';

const _tlStages = <(String key, String label)>[
  ('introduction', 'Introduction'),
  ('competence_development', 'Competence Development'),
  ('design_and_realization', 'Design and Realization'),
  ('closure', 'Closure'),
];

String _str(dynamic v) {
  if (v == null) return '';
  return '$v'.trim();
}

String _webBody(dynamic v) {
  final t = _str(v);
  return t.isEmpty ? _emDash : t;
}

String _classNameFromRow(Map<String, dynamic> r) {
  final cls = r['classes'];
  if (cls is Map) return '${cls['name'] ?? ''}'.trim();
  if (cls is List && cls.isNotEmpty && cls.first is Map) {
    return '${(cls.first as Map)['name'] ?? ''}'.trim();
  }
  return '';
}

String _subjectNameFromRow(Map<String, dynamic> r) {
  final sub = r['subjects'];
  if (sub is Map) return '${sub['name'] ?? ''}'.trim();
  if (sub is List && sub.isNotEmpty && sub.first is Map) {
    return '${(sub.first as Map)['name'] ?? ''}'.trim();
  }
  return '';
}

String _referencesField(Map<String, dynamic> r) {
  final a = r['references'];
  if (a == null) return '';
  return '$a'.trim();
}

Map<String, dynamic>? _stageMap(Map<String, dynamic> r, String key) {
  final tlp = r['teaching_learning_process'];
  if (tlp is! Map) return null;
  final s = tlp[key];
  if (s is! Map) return null;
  return Map<String, dynamic>.from(
    s.map((k, v) => MapEntry(k.toString(), v)),
  );
}

String _webTimeMinutes(Map<String, dynamic>? m) {
  if (m == null) return _emDash;
  final ti = m['time'];
  if (ti == null) return _emDash;
  final s = '$ti'.trim();
  return s.isEmpty ? _emDash : s;
}

String _lessonDateDisplay(String raw) {
  final s = raw.split('T').first.trim();
  final parts = s.split('-');
  if (parts.length == 3) {
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
  return s.isEmpty ? _emDash : s;
}

int _intField(Map<String, dynamic> r, String key) {
  final v = r[key];
  if (v is num) return v.toInt();
  return int.tryParse('$v') ?? 0;
}

/// Web-style pupil counts: registered from row; present split when only [present_count] exists.
(int rg, int rb, int rt, int pg, int pb, int pt) _pupilCounts(
    Map<String, dynamic> r) {
  final rg = _intField(r, 'total_girls');
  final rb = _intField(r, 'total_boys');
  var rt = _intField(r, 'total_pupils');
  if (rt <= 0) rt = rg + rb;
  final pc = _intField(r, 'present_count');
  final half = pc ~/ 2;
  return (rg, rb, rt, pc - half, half, pc);
}

pw.Widget _cell(
  String text, {
  bool header = false,
  PdfColor? color,
}) {
  return pw.Container(
    padding: const pw.EdgeInsets.all(6),
    decoration: pw.BoxDecoration(
      border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
      color: header ? PdfColors.grey200 : null,
    ),
    child: pw.Text(
      text,
      style: pw.TextStyle(
        fontSize: header ? 9 : 9,
        fontWeight: header ? pw.FontWeight.bold : pw.FontWeight.normal,
        color: color ?? PdfColors.black,
      ),
    ),
  );
}

pw.Widget _sectionTitle(String title) {
  return pw.Padding(
    padding: const pw.EdgeInsets.only(top: 12, bottom: 6),
    child: pw.Text(
      title,
      style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
    ),
  );
}

pw.Widget _sectionBody(String text) {
  return pw.Text(
    text,
    style: const pw.TextStyle(fontSize: 9, lineSpacing: 1.35),
  );
}

/// Builds PDF bytes aligned with web lesson plan print layout and field order.
Future<Uint8List> buildLessonPlanPdfBytes({
  required Map<String, dynamic> row,
  required TeacherDeskData deskData,
  required TeacherLessonPlanListRow summary,
  required String teacherDisplayName,
}) async {
  final doc = pw.Document();

  final schoolName = deskData.primarySchoolName?.trim().isNotEmpty == true
      ? deskData.primarySchoolName!.trim()
      : '_______________________________';

  final subject = _subjectNameFromRow(row).isNotEmpty
      ? _subjectNameFromRow(row)
      : summary.subjectName;
  final className = _classNameFromRow(row).isNotEmpty
      ? _classNameFromRow(row)
      : summary.className;
  final lessonDateRaw = _str(row['lesson_date']).isNotEmpty
      ? _str(row['lesson_date'])
      : summary.lessonDate;
  final lessonDateDisplay = _lessonDateDisplay(lessonDateRaw);
  final periodLabel = formatPeriodForDisplay(
    row['period'] ?? summary.period,
  );
  final dur = row['duration_minutes'];
  final durationMinutes = dur is num
      ? dur.toInt()
      : int.tryParse('$dur') ?? summary.durationMinutes;

  final (rg, rb, rt, pg, pb, pt) = _pupilCounts(row);

  final mainComp = _webBody(row['main_competence']);
  final specComp = _webBody(row['specific_competence']);
  final mainAct = _webBody(row['main_activities']);
  final specAct = _webBody(row['specific_activities']);
  final teachRes = _webBody(row['teaching_resources']);
  final refs = _webBody(_referencesField(row));
  final remarks = _webBody(row['remarks']);

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(40),
      build: (context) => [
        pw.Center(
          child: pw.Column(
            children: [
              pw.Text(
                schoolName,
                style:
                    pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
                textAlign: pw.TextAlign.center,
              ),
              pw.SizedBox(height: 8),
              pw.Text(
                "TEACHER'S LESSON PLAN",
                style:
                    pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
              ),
              pw.SizedBox(height: 4),
              pw.Container(width: 180, height: 1, color: PdfColors.black),
            ],
          ),
        ),
        pw.SizedBox(height: 16),
        pw.Text(
          'Basic information',
          style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
        ),
        pw.SizedBox(height: 6),
        pw.Table(
          border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
          columnWidths: {
            0: const pw.FlexColumnWidth(1.1),
            1: const pw.FlexColumnWidth(1.2),
            2: const pw.FlexColumnWidth(1.1),
            3: const pw.FlexColumnWidth(1.1),
            4: const pw.FlexColumnWidth(0.9),
          },
          children: [
            pw.TableRow(
              children: [
                _cell('Date', header: true),
                _cell('Subject', header: true),
                _cell('Class', header: true),
                _cell('Period', header: true),
                _cell('Time', header: true),
              ],
            ),
            pw.TableRow(
              children: [
                _cell(lessonDateDisplay),
                _cell(subject),
                _cell(className),
                _cell(periodLabel),
                _cell('$durationMinutes minutes'),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 12),
        pw.Center(
          child: pw.Text(
            'Number of Pupils',
            style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
          ),
        ),
        pw.SizedBox(height: 6),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.stretch,
                children: [
                  pw.Container(
                    padding: const pw.EdgeInsets.all(6),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.grey200,
                      border: pw.Border.all(
                        color: PdfColors.grey400,
                        width: 0.5,
                      ),
                    ),
                    child: pw.Center(
                      child: pw.Text(
                        'Registered',
                        style: pw.TextStyle(
                          fontSize: 8,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  pw.Table(
                    border: pw.TableBorder(
                      left: pw.BorderSide(color: PdfColors.grey400, width: 0.5),
                      right:
                          pw.BorderSide(color: PdfColors.grey400, width: 0.5),
                      bottom:
                          pw.BorderSide(color: PdfColors.grey400, width: 0.5),
                    ),
                    columnWidths: {
                      0: const pw.FlexColumnWidth(1),
                      1: const pw.FlexColumnWidth(1),
                      2: const pw.FlexColumnWidth(1),
                    },
                    children: [
                      pw.TableRow(
                        children: [
                          _cell('Girls', header: true),
                          _cell('Boys', header: true),
                          _cell('Total', header: true),
                        ],
                      ),
                      pw.TableRow(
                        children: [
                          _cell('$rg'),
                          _cell('$rb'),
                          _cell('$rt'),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: 10),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.stretch,
                children: [
                  pw.Container(
                    padding: const pw.EdgeInsets.all(6),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.grey200,
                      border: pw.Border.all(
                        color: PdfColors.grey400,
                        width: 0.5,
                      ),
                    ),
                    child: pw.Center(
                      child: pw.Text(
                        'Present',
                        style: pw.TextStyle(
                          fontSize: 8,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  pw.Table(
                    border: pw.TableBorder(
                      left: pw.BorderSide(color: PdfColors.grey400, width: 0.5),
                      right:
                          pw.BorderSide(color: PdfColors.grey400, width: 0.5),
                      bottom:
                          pw.BorderSide(color: PdfColors.grey400, width: 0.5),
                    ),
                    columnWidths: {
                      0: const pw.FlexColumnWidth(1),
                      1: const pw.FlexColumnWidth(1),
                      2: const pw.FlexColumnWidth(1),
                    },
                    children: [
                      pw.TableRow(
                        children: [
                          _cell('Girls', header: true),
                          _cell('Boys', header: true),
                          _cell('Total', header: true),
                        ],
                      ),
                      pw.TableRow(
                        children: [
                          _cell('$pg'),
                          _cell('$pb'),
                          _cell('$pt'),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        _sectionTitle('Main competence'),
        _sectionBody(mainComp),
        _sectionTitle('Specific competence'),
        _sectionBody(specComp),
        _sectionTitle('Main Activities'),
        _sectionBody(mainAct),
        _sectionTitle('Specific Activities'),
        _sectionBody(specAct),
        _sectionTitle('Teaching and Learning Resources'),
        _sectionBody(teachRes),
        _sectionTitle('Teaching and Learning Process'),
        pw.SizedBox(height: 4),
        pw.Table(
          border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
          columnWidths: {
            0: const pw.FlexColumnWidth(1.1),
            1: const pw.FlexColumnWidth(0.65),
            2: const pw.FlexColumnWidth(1.35),
            3: const pw.FlexColumnWidth(1.35),
            4: const pw.FlexColumnWidth(1.35),
          },
          children: [
            pw.TableRow(
              children: [
                _cell('Stage', header: true),
                _cell('Time (minutes)', header: true),
                _cell('Teaching Activities', header: true),
                _cell('Learning Activities', header: true),
                _cell('Assessment Criteria', header: true),
              ],
            ),
            for (final (key, label) in _tlStages)
              pw.TableRow(
                children: [
                  _cell(label),
                  _cell(_webTimeMinutes(_stageMap(row, key))),
                  _cell(_webBody(_stageMap(row, key)?['teaching_activities'])),
                  _cell(_webBody(_stageMap(row, key)?['learning_activities'])),
                  _cell(_webBody(_stageMap(row, key)?['assessment_criteria'])),
                ],
              ),
          ],
        ),
        _sectionTitle('References'),
        _sectionBody(refs),
        _sectionTitle('Remarks / evaluation'),
        _sectionBody(remarks),
        pw.SizedBox(height: 20),
        pw.Text(
          'Date: $lessonDateDisplay',
          style: const pw.TextStyle(fontSize: 9),
        ),
        pw.SizedBox(height: 6),
        pw.Text(
          "Teacher's name: $teacherDisplayName",
          style: const pw.TextStyle(fontSize: 9),
        ),
      ],
    ),
  );

  return doc.save();
}

/// Filename like `lesson-plan-FORM-ONE-KISWAHILI-2026-05-15.pdf`.
String lessonPlanExportFilename({
  required String className,
  required String subjectName,
  required String lessonDateYmd,
}) {
  String seg(String s) {
    var t = s.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]+'), '-');
    while (t.startsWith('-')) {
      t = t.substring(1);
    }
    while (t.endsWith('-')) {
      t = t.substring(0, t.length - 1);
    }
    return t.isEmpty ? 'CLASS' : t;
  }

  final c = seg(className.isEmpty ? 'CLASS' : className);
  final su = seg(subjectName.isEmpty ? 'SUBJECT' : subjectName);
  final d = lessonDateYmd.split('T').first.replaceAll(RegExp(r'[^0-9-]'), '');
  return 'lesson-plan-$c-$su-$d.pdf'.toLowerCase();
}

/// Uses joined [row] + [summary] like the detail screen.
String lessonPlanExportFilenameFromRow(
  Map<String, dynamic> row,
  TeacherLessonPlanListRow summary,
) {
  final className = _classNameFromRow(row).isNotEmpty
      ? _classNameFromRow(row)
      : summary.className;
  final subjectName = _subjectNameFromRow(row).isNotEmpty
      ? _subjectNameFromRow(row)
      : summary.subjectName;
  final raw = _str(row['lesson_date']).isNotEmpty
      ? _str(row['lesson_date'])
      : summary.lessonDate;
  return lessonPlanExportFilename(
    className: className,
    subjectName: subjectName,
    lessonDateYmd: raw,
  );
}

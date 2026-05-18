import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/gradebook/gradebook_full_report_compute.dart';
import '../../core/gradebook/tanzania_grades.dart';

const _emDash = '\u2014';

/// Sanitizes text for PDF output; strips emoji and normalizes whitespace.
String _pdfText(String value) {
  if (value.isEmpty) return _emDash;
  return value
      .replaceAll(RegExp(r'[\u{1F300}-\u{1FAFF}]', unicode: true), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

/// Filename like `subject-evaluation-FORM-ONE-KISWAHILI-Term-1-2026-05-15.pdf`.
String evaluateSubjectExportFilename({
  required String className,
  required String subject,
  required String selectedTerm,
}) {
  String slug(String s) =>
      s.trim().replaceAll(RegExp(r'[^\w\-]+'), '-').replaceAll(RegExp(r'-+'), '-');
  final c = slug(className);
  final sub = slug(subject);
  final term = slug(selectedTerm);
  final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
  return 'subject-evaluation-$c-$sub-$term-$date.pdf'.toLowerCase();
}

class EvaluateSubjectPdfInput {
  EvaluateSubjectPdfInput({
    required this.schoolName,
    required this.className,
    required this.subject,
    required this.teacherName,
    required this.termLabel,
    required this.selectedTerm,
    required this.dateLabel,
    required this.assignmentTitle,
    required this.assignmentMaxScore,
    required this.schoolLevel,
    required this.passing,
    required this.failing,
    required this.dist,
    required this.ranking,
    required this.rows,
  });

  final String schoolName;
  final String className;
  final String subject;
  final String teacherName;
  final String termLabel;
  final String selectedTerm;
  final String dateLabel;
  final String assignmentTitle;
  final double assignmentMaxScore;
  final String schoolLevel;
  final PassRateStats passing;
  final FailRateStats failing;
  final GradeDist dist;
  final List<RankingRow> ranking;
  final List<EvaluateSubjectPdfStudentRow> rows;
}

class EvaluateSubjectPdfStudentRow {
  EvaluateSubjectPdfStudentRow({
    required this.name,
    required this.gender,
    required this.scorePct,
    required this.grade,
    required this.remarks,
  });

  final String name;
  final String gender;
  final String scorePct;
  final String grade;
  final String remarks;
}

Future<pw.Font> _notoRegular() async {
  final d = await rootBundle.load('assets/fonts/NotoSans-Regular.ttf');
  return pw.Font.ttf(d);
}

Future<pw.Font> _notoBold() async {
  final d = await rootBundle.load('assets/fonts/NotoSans-Bold.ttf');
  return pw.Font.ttf(d);
}

Future<Uint8List> buildEvaluateSubjectPdfBytes(EvaluateSubjectPdfInput data) async {
  final regular = await _notoRegular();
  final bold = await _notoBold();

  final doc = pw.Document();
  final passingPct = passingThresholdPercent(data.schoolLevel);
  final failingLetter = data.schoolLevel == 'primary' ? 'E' : 'F';
  final failingCount =
      data.schoolLevel == 'primary' ? data.dist.e : data.dist.f;

  final theme = pw.ThemeData.withFont(
    base: regular,
    bold: bold,
  );

  pw.Widget statBlock(String title, String subtitle, List<String> lines) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 7),
      padding: const pw.EdgeInsets.all(9),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey300),
        borderRadius: pw.BorderRadius.circular(4),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            title,
            style: pw.TextStyle(
              fontSize: 10,
              fontWeight: pw.FontWeight.bold,
              font: bold,
            ),
          ),
          pw.SizedBox(height: 2),
          pw.Text(
            subtitle,
            style: pw.TextStyle(
              fontSize: 8,
              color: PdfColors.grey700,
              font: regular,
            ),
          ),
          pw.SizedBox(height: 5),
          for (final line in lines)
            pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 3),
              child: pw.Text(
                _pdfText(line),
                style: pw.TextStyle(fontSize: 9, font: regular),
              ),
            ),
        ],
      ),
    );
  }

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(28),
      theme: theme,
      build: (ctx) {
        final children = <pw.Widget>[
          pw.Center(
            child: pw.Text(
              _pdfText(data.schoolName).toUpperCase(),
              style: pw.TextStyle(
                fontSize: 16,
                fontWeight: pw.FontWeight.bold,
                font: bold,
              ),
              textAlign: pw.TextAlign.center,
            ),
          ),
          pw.SizedBox(height: 6),
          pw.Center(
            child: pw.Text(
              _pdfText('${data.className} · ${data.subject}'),
              style: pw.TextStyle(
                fontSize: 12,
                fontWeight: pw.FontWeight.bold,
                font: bold,
              ),
            ),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            'Teacher: ${_pdfText(data.teacherName)}',
            style: pw.TextStyle(fontSize: 10, font: regular),
          ),
          pw.Text(
            'Period: ${_pdfText(data.selectedTerm)}',
            style: pw.TextStyle(fontSize: 10, font: regular),
          ),
          pw.Text(
            'Academic year: ${_pdfText(data.termLabel)}',
            style: pw.TextStyle(fontSize: 10, font: regular),
          ),
          pw.Text(
            'Date: ${_pdfText(data.dateLabel)}',
            style: pw.TextStyle(fontSize: 10, font: regular),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            'Assignment: ${_pdfText(data.assignmentTitle)} (max ${data.assignmentMaxScore})',
            style: pw.TextStyle(
              fontSize: 10,
              fontWeight: pw.FontWeight.bold,
              font: bold,
            ),
          ),
          pw.SizedBox(height: 11),
          pw.Text(
            'CLASS STATISTICS (this assignment)',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
              font: bold,
            ),
          ),
          pw.SizedBox(height: 5),
          statBlock(
            'Passing students',
            'Score ≥ $passingPct%',
            [
              'Pass rate: ${data.passing.passRateLine}',
              'Boys pass rate: ${data.passing.boysLine}',
              'Girls pass rate: ${data.passing.girlsLine}',
            ],
          ),
          statBlock(
            'Failing students',
            'Score < $passingPct%',
            [
              'Fail rate: ${data.failing.failRateLine}',
              'Boys fail rate: ${data.failing.boysLine}',
              'Girls fail rate: ${data.failing.girlsLine}',
            ],
          ),
          pw.Container(
            padding: const pw.EdgeInsets.all(9),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(
                color: PdfColors.grey400,
                style: pw.BorderStyle.dashed,
              ),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'Grade distribution (all scored)',
                  style: pw.TextStyle(
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                    font: bold,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  'A: ${data.dist.a} · B: ${data.dist.b} · C: ${data.dist.c} · '
                  'D: ${data.dist.d} · $failingLetter: $failingCount',
                  style: pw.TextStyle(fontSize: 9, font: regular),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 11),
          pw.Text(
            'STUDENT RANKING (highest to lowest)',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
              font: bold,
            ),
          ),
          pw.SizedBox(height: 5),
        ];

        if (data.ranking.isEmpty) {
          children.add(
            pw.Text(
              'No scores entered for this assignment.',
              style: pw.TextStyle(
                fontSize: 9,
                color: PdfColors.grey700,
                font: regular,
              ),
            ),
          );
        } else {
          children.add(
            pw.Table(
              border: pw.TableBorder.all(
                color: PdfColors.grey400,
                width: 0.5,
              ),
              columnWidths: {
                0: const pw.FixedColumnWidth(28),
                1: const pw.FlexColumnWidth(3),
                2: const pw.FlexColumnWidth(1.2),
                3: const pw.FixedColumnWidth(28),
              },
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey800),
                  children: [
                    _pdfHeaderCell('#', bold, regular),
                    _pdfHeaderCell('Student', bold, regular),
                    _pdfHeaderCell('Score', bold, regular),
                    _pdfHeaderCell('Gr', bold, regular),
                  ],
                ),
                for (final r in data.ranking)
                  pw.TableRow(
                    children: [
                      _pdfBodyCell('${r.rank}', regular),
                      _pdfBodyCell(r.name, regular),
                      _pdfBodyCell(r.scorePct, regular),
                      _pdfBodyCell(r.grade, regular),
                    ],
                  ),
              ],
            ),
          );
        }

        children.addAll([
          pw.SizedBox(height: 12),
          pw.Text(
            'STUDENT SCORES & REMARKS',
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
              font: bold,
            ),
          ),
          pw.SizedBox(height: 5),
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
            columnWidths: {
              0: const pw.FlexColumnWidth(2.2),
              1: const pw.FlexColumnWidth(0.8),
              2: const pw.FlexColumnWidth(0.9),
              3: const pw.FixedColumnWidth(28),
              4: const pw.FlexColumnWidth(2.5),
            },
            children: [
              pw.TableRow(
                decoration:
                    const pw.BoxDecoration(color: PdfColors.grey800),
                children: [
                  _pdfHeaderCell('Student', bold, regular),
                  _pdfHeaderCell('Gender', bold, regular),
                  _pdfHeaderCell('Score', bold, regular),
                  _pdfHeaderCell('Gr', bold, regular),
                  _pdfHeaderCell('Remarks', bold, regular),
                ],
              ),
              for (final r in data.rows)
                pw.TableRow(
                  children: [
                    _pdfBodyCell(r.name, regular),
                    _pdfBodyCell(r.gender, regular),
                    _pdfBodyCell(r.scorePct, regular),
                    _pdfBodyCell(r.grade, regular),
                    _pdfBodyCell(r.remarks, regular),
                  ],
                ),
            ],
          ),
        ]);

        return children;
      },
    ),
  );

  return doc.save();
}

pw.Widget _pdfHeaderCell(String text, pw.Font bold, pw.Font regular) =>
    pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 5),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 8,
          fontWeight: pw.FontWeight.bold,
          font: bold,
          color: PdfColors.white,
        ),
      ),
    );

pw.Widget _pdfBodyCell(String text, pw.Font regular) => pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: pw.Text(
        _pdfText(text),
        style: pw.TextStyle(fontSize: 8, font: regular),
      ),
    );

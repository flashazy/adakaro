import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/gradebook/gradebook_full_report_compute.dart';
import '../../core/gradebook/tanzania_grades.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import 'teacher_evaluate_subject_pdf.dart';

const _emDash = '\u2014';
const double _cardRadius = 14;
const double _cardRadiusSm = 12;

/// Shared grade chip geometry (ranking + student cards).
const double _kEvalGradeChipRadius = 8;
const EdgeInsets _kEvalGradeChipPadding =
    EdgeInsets.symmetric(horizontal: 10, vertical: 5);

/// Class statistics accents (semantic, light touch).
const Color _kEvalPassAccent = Color(0xFF16A34A);
const Color _kEvalWarnAccent = Color(0xFFEA580C);

/// Full-screen subject evaluation report (web FullGradeReport parity).
class TeacherEvaluateSubjectReportScreen extends StatefulWidget {
  const TeacherEvaluateSubjectReportScreen({
    super.key,
    required this.schoolLevel,
    required this.meta,
    required this.selectedTerm,
    required this.snapshot,
    required this.draft,
  });

  final String schoolLevel;
  final TeacherEvaluateReportMeta meta;
  final String selectedTerm;
  final TeacherGradebookMatrixSnapshot snapshot;
  final ClassDraft draft;

  @override
  State<TeacherEvaluateSubjectReportScreen> createState() =>
      _TeacherEvaluateSubjectReportScreenState();
}

class _TeacherEvaluateSubjectReportScreenState
    extends State<TeacherEvaluateSubjectReportScreen> {
  late String _assignmentId;
  bool _exportBusy = false;

  @override
  void initState() {
    super.initState();
    _assignmentId = widget.snapshot.assignments.first.id;
  }

  TeacherGradebookAssignmentMini get _selectedAssignment =>
      widget.snapshot.assignments.firstWhere((a) => a.id == _assignmentId);

  String get _dateLabel =>
      DateFormat('d MMMM yyyy').format(DateTime.now());

  AssignmentStats get _stats {
    final sel = _selectedAssignment;
    final students = widget.snapshot.students
        .map((s) => (id: s.id, gender: s.gender))
        .toList();
    return computeReportStatsForAssignment(
      students,
      (id: sel.id, maxScore: sel.maxScore),
      widget.draft,
      widget.schoolLevel,
    );
  }

  List<RankingRow> get _ranking {
    final sel = _selectedAssignment;
    final students = widget.snapshot.students
        .map((s) => (id: s.id, fullName: s.fullName))
        .toList();
    return buildStudentRanking(
      students,
      (id: sel.id, maxScore: sel.maxScore),
      widget.draft,
      widget.schoolLevel,
    );
  }

  List<EvaluateSubjectPdfStudentRow> get _scoreRows {
    final sel = _selectedAssignment;
    return [
      for (final s in widget.snapshot.students)
        () {
          final g = scoreGradeForAssignment(
            widget.draft[sel.id]?[s.id]?.score,
            sel.maxScore,
            widget.schoolLevel,
          );
          final remarks = widget.draft[sel.id]?[s.id]?.remarks.trim() ?? '';
          return EvaluateSubjectPdfStudentRow(
            name: s.fullName,
            gender: _genderLabel(s.gender),
            scorePct: g.scoreLabel,
            grade: g.grade,
            remarks: remarks.isEmpty ? _emDash : remarks,
          );
        }(),
    ];
  }

  EvaluateSubjectPdfInput _pdfInput() {
    final sel = _selectedAssignment;
    final stats = _stats;
    return EvaluateSubjectPdfInput(
      schoolName: widget.meta.schoolName,
      className: widget.meta.className,
      subject: widget.meta.subject,
      teacherName: widget.meta.teacherName,
      termLabel: widget.meta.termLabel,
      selectedTerm: widget.selectedTerm,
      dateLabel: _dateLabel,
      assignmentTitle: sel.title,
      assignmentMaxScore: sel.maxScore,
      schoolLevel: widget.schoolLevel,
      passing: stats.passing,
      failing: stats.failing,
      dist: stats.dist,
      ranking: _ranking,
      rows: _scoreRows,
    );
  }

  String _genderLabel(String? gender) {
    if (gender == 'male') return 'Male';
    if (gender == 'female') return 'Female';
    return _emDash;
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  bool _isPluginUnavailable(Object error) =>
      error is MissingPluginException ||
      (error is PlatformException && error.code == 'channel-error');

  Future<({String path, String filename, Uint8List bytes})> _savePdf() async {
    final bytes = await buildEvaluateSubjectPdfBytes(_pdfInput());
    final fname = evaluateSubjectExportFilename(
      className: widget.meta.className,
      subject: widget.meta.subject,
      selectedTerm: widget.selectedTerm,
    );
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory('${docs.path}/subject_evaluations');
    if (!await dir.exists()) await dir.create(recursive: true);
    final path = '${dir.path}/$fname';
    await File(path).writeAsBytes(bytes, flush: true);
    debugPrint('Subject evaluation PDF saved: $path');
    return (path: path, filename: fname, bytes: bytes);
  }

  Future<void> _copyPlainTextReport() async {
    final sel = _selectedAssignment;
    final stats = _stats;
    final metaLines = TeacherEvaluateReportMetaLines(
      schoolName: widget.meta.schoolName,
      className: widget.meta.className,
      subject: widget.meta.subject,
      teacherName: widget.meta.teacherName,
      termLabel: widget.meta.termLabel,
    );
    final studentsFull = widget.snapshot.students
        .map(
          (s) =>
              (id: s.id, fullName: s.fullName, gender: s.gender),
        )
        .toList();
    final report = buildPlainTextReport(
      meta: metaLines,
      assignment:
          (id: sel.id, title: sel.title, maxScore: sel.maxScore),
      students: studentsFull,
      stats: stats,
      ranking: _ranking,
      draft: widget.draft,
      schoolLevel: widget.schoolLevel,
    );
    await Clipboard.setData(ClipboardData(text: report));
    if (mounted) {
      _showSnack('Report text copied.');
    }
  }

  Future<void> _exportPdf() async {
    if (_exportBusy) return;
    setState(() => _exportBusy = true);
    try {
      final saved = await _savePdf();
      if (!mounted) return;
      try {
        await Share.shareXFiles(
          [
            XFile.fromData(
              saved.bytes,
              mimeType: 'application/pdf',
              name: saved.filename,
            ),
          ],
          subject: 'Subject evaluation',
        );
        if (!mounted) return;
        _showSnack('Evaluation PDF ready to share or save.');
      } catch (e, st) {
        debugPrint('share_plus export failed (${e.runtimeType}): $e\n$st');
        if (!mounted) return;
        if (_isPluginUnavailable(e)) {
          try {
            await Printing.sharePdf(
              bytes: saved.bytes,
              filename: saved.filename,
            );
            if (!mounted) return;
            _showSnack('Evaluation PDF ready to share or save.');
            return;
          } catch (e2, st2) {
            debugPrint('Printing.sharePdf failed: $e2\n$st2');
          }
        }
        _showSnack('PDF saved:\n${saved.path}');
      }
    } catch (e, st) {
      debugPrint('evaluate PDF export failed: $e\n$st');
      if (mounted) _showSnack('Could not create PDF. Please try again.');
    } finally {
      if (mounted) setState(() => _exportBusy = false);
    }
  }

  Future<void> _printPdf() async {
    try {
      final bytes = await buildEvaluateSubjectPdfBytes(_pdfInput());
      await Printing.layoutPdf(
        name: evaluateSubjectExportFilename(
          className: widget.meta.className,
          subject: widget.meta.subject,
          selectedTerm: widget.selectedTerm,
        ),
        onLayout: (_) async => bytes,
      );
    } catch (e, st) {
      debugPrint('printing layoutPdf failed (${e.runtimeType}): $e\n$st');
      if (!mounted) return;
      if (_isPluginUnavailable(e)) {
        _showSnack(
          'Printing is not available. Try Export PDF instead.',
        );
      } else {
        _showSnack('Could not open print dialog. Please try again.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final borderColor =
        AppColors.cardBorder.withValues(alpha: dark ? 0.38 : 0.72);
    final pageBg = dark
        ? Color.lerp(theme.colorScheme.surfaceContainerLowest, theme.colorScheme.surface, 0.25)!
        : Color.lerp(AppColors.surface, Colors.white, 0.35)!;

    final sel = _selectedAssignment;
    final stats = _stats;
    final ranking = _ranking;
    final passingPct = passingThresholdPercent(widget.schoolLevel);
    final failingLetter = widget.schoolLevel == 'primary' ? 'E' : 'F';
    final failingCount =
        widget.schoolLevel == 'primary' ? stats.dist.e : stats.dist.f;

    return Scaffold(
      backgroundColor: pageBg,
      appBar: AppBar(
        title: const Text('Subject evaluation'),
        backgroundColor: pageBg,
        surfaceTintColor: Colors.transparent,
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Export & print',
            onSelected: (v) {
              switch (v) {
                case 'pdf':
                  _exportPdf();
                  break;
                case 'print':
                  _printPdf();
                  break;
                case 'copy':
                  _copyPlainTextReport();
                  break;
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'pdf',
                enabled: !_exportBusy,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.picture_as_pdf_outlined,
                    color: theme.colorScheme.onSurface,
                  ),
                  title: Text(
                    _exportBusy ? 'Preparing PDF…' : 'Export PDF',
                  ),
                ),
              ),
              PopupMenuItem(
                value: 'print',
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.print_outlined,
                    color: theme.colorScheme.onSurface,
                  ),
                  title: const Text('Print'),
                ),
              ),
              PopupMenuItem(
                value: 'copy',
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.copy_outlined,
                    color: theme.colorScheme.onSurface,
                  ),
                  title: const Text('Copy report text'),
                ),
              ),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
          TeacherUiTokens.horizontalPadding,
          5,
          TeacherUiTokens.horizontalPadding,
          MediaQuery.paddingOf(context).bottom + 18,
        ),
        children: [
          _HeaderReportCard(
            borderColor: borderColor,
            dark: dark,
            schoolName: widget.meta.schoolName,
            classSubject:
                '${widget.meta.className} · ${widget.meta.subject}',
            teacherName: widget.meta.teacherName,
            period: widget.selectedTerm,
            academicYear:
                widget.meta.termLabel == _emDash ? null : widget.meta.termLabel,
            dateLabel: _dateLabel,
          ),
          const SizedBox(height: 8),
          _ReportCard(
            borderColor: borderColor,
            dark: dark,
            softShadow: true,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 9),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Assignment',
                  style: theme.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 5),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _assignmentId,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    isDense: true,
                    contentPadding: EdgeInsetsDirectional.only(
                      start: 12,
                      end: 8,
                      top: 10,
                      bottom: 10,
                    ),
                  ),
                  style: theme.textTheme.bodyMedium,
                  selectedItemBuilder: (context) {
                    return [
                      for (final a in widget.snapshot.assignments)
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                '${a.title} (max ${a.maxScore})',
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                softWrap: true,
                              ),
                            ),
                          ],
                        ),
                    ];
                  },
                  items: [
                    for (final a in widget.snapshot.assignments)
                      DropdownMenuItem(
                        value: a.id,
                        child: Text(
                          '${a.title} (max ${a.maxScore})',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _assignmentId = v);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Text(
              'Uses saved marks only. Analysis only — does not write report cards.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary.withValues(alpha: 0.88),
                height: 1.35,
                fontSize: 11.5,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
          const SizedBox(height: 8),
          _SectionTitle(title: 'Class statistics', subtitle: sel.title),
          const SizedBox(height: 6),
          _ClassStatisticsSection(
            borderColor: borderColor,
            dark: dark,
            passingPct: passingPct,
            passing: stats.passing,
            failing: stats.failing,
            failingLetter: failingLetter,
            gradeDist: stats.dist,
            failingGradeCount: failingCount,
          ),
          const SizedBox(height: 14),
          _SectionTitle(
            title: 'Student ranking',
            subtitle: 'Highest to lowest',
          ),
          const SizedBox(height: 5),
          if (ranking.isEmpty)
            _ReportCard(
              borderColor: borderColor,
              dark: dark,
              softShadow: true,
              child: Text(
                'No scores entered for this assignment yet.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            )
          else
            ...ranking.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: _RankingCard(
                  borderColor: borderColor,
                  dark: dark,
                  rank: r.rank,
                  name: r.name,
                  scorePct: r.scorePct,
                  grade: r.grade,
                  remark: r.badge,
                ),
              ),
            ),
          const SizedBox(height: 14),
          _SectionTitle(title: 'Student scores & remarks'),
          const SizedBox(height: 5),
          ...widget.snapshot.students.map((s) {
            final g = scoreGradeForAssignment(
              widget.draft[sel.id]?[s.id]?.score,
              sel.maxScore,
              widget.schoolLevel,
            );
            final remarks =
                widget.draft[sel.id]?[s.id]?.remarks.trim() ?? '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: _StudentScoreCard(
                borderColor: borderColor,
                dark: dark,
                name: s.fullName,
                scorePct: g.scoreLabel,
                grade: g.grade,
                remarks: remarks,
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -0.15,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(
            subtitle!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
              height: 1.3,
            ),
          ),
        ],
      ],
    );
  }
}

class _HeaderReportCard extends StatelessWidget {
  const _HeaderReportCard({
    required this.borderColor,
    required this.dark,
    required this.schoolName,
    required this.classSubject,
    required this.teacherName,
    required this.period,
    this.academicYear,
    required this.dateLabel,
  });

  final Color borderColor;
  final bool dark;
  final String schoolName;
  final String classSubject;
  final String teacherName;
  final String period;
  final String? academicYear;
  final String dateLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onStrong = theme.colorScheme.onSurface.withValues(
      alpha: dark ? 0.94 : 0.91,
    );
    final softBorder =
        borderColor.withValues(alpha: dark ? 0.38 : 0.52);
    return _ReportCard(
      borderColor: borderColor,
      dark: dark,
      radius: _cardRadius,
      softShadow: true,
      borderTint: softBorder,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            schoolName.toUpperCase(),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
              fontSize: 12.5,
              height: 1.25,
              color: onStrong,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            classSubject,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: -0.12,
              height: 1.28,
            ),
          ),
          const SizedBox(height: 12),
          Divider(
            height: 1,
            color: borderColor.withValues(alpha: dark ? 0.35 : 0.65),
          ),
          const SizedBox(height: 10),
          _HeaderMetaRow(label: 'Teacher', value: teacherName),
          _HeaderMetaRow(label: 'Period', value: period),
          if (academicYear != null && academicYear!.trim().isNotEmpty)
            _HeaderMetaRow(label: 'Year', value: academicYear!.trim()),
          _HeaderMetaRow(label: 'Date', value: dateLabel),
        ],
      ),
    );
  }
}

class _HeaderMetaRow extends StatelessWidget {
  const _HeaderMetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                height: 1.3,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ClassStatisticsSection extends StatelessWidget {
  const _ClassStatisticsSection({
    required this.borderColor,
    required this.dark,
    required this.passingPct,
    required this.passing,
    required this.failing,
    required this.failingLetter,
    required this.gradeDist,
    required this.failingGradeCount,
  });

  final Color borderColor;
  final bool dark;
  final int passingPct;
  final PassRateStats passing;
  final FailRateStats failing;
  final String failingLetter;
  final GradeDist gradeDist;
  final int failingGradeCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final summaryLine =
        'A: ${gradeDist.a} · B: ${gradeDist.b} · C: ${gradeDist.c} · '
        'D: ${gradeDist.d} · $failingLetter: $failingGradeCount';

    final maxLetterCount = math.max(
      1,
      math.max(
        math.max(math.max(gradeDist.a, gradeDist.b), math.max(gradeDist.c, gradeDist.d)),
        failingGradeCount,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PassFailStatCard(
          borderColor: borderColor,
          dark: dark,
          isPassingBlock: true,
          heading: 'PASSING STUDENTS',
          thresholdLine: 'Score ≥ $passingPct%',
          metricRows: [
            ('Pass rate', passing.passRateLine),
            ('Boys pass rate', passing.boysLine),
            ('Girls pass rate', passing.girlsLine),
          ],
        ),
        const SizedBox(height: 8),
        _PassFailStatCard(
          borderColor: borderColor,
          dark: dark,
          isPassingBlock: false,
          heading: 'FAILING STUDENTS',
          thresholdLine: 'Score < $passingPct%',
          metricRows: [
            ('Fail rate', failing.failRateLine),
            ('Boys fail rate', failing.boysLine),
            ('Girls fail rate', failing.girlsLine),
          ],
        ),
        const SizedBox(height: 8),
        _ReportCard(
          borderColor: borderColor,
          dark: dark,
          radius: _cardRadiusSm,
          softShadow: true,
          surfaceTint:
              AppColors.primary.withValues(alpha: dark ? 0.078 : 0.048),
          borderTint:
              AppColors.primary.withValues(alpha: dark ? 0.30 : 0.195),
          padding: const EdgeInsets.fromLTRB(14, 11, 14, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'GRADE DISTRIBUTION (ALL SCORED)',
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.35,
                  fontSize: 11.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                summaryLine,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.4,
                  letterSpacing: -0.1,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _GradeChip(
                      label: 'A',
                      count: gradeDist.a,
                      barFraction: gradeDist.a / maxLetterCount,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: _GradeChip(
                      label: 'B',
                      count: gradeDist.b,
                      barFraction: gradeDist.b / maxLetterCount,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: _GradeChip(
                      label: 'C',
                      count: gradeDist.c,
                      barFraction: gradeDist.c / maxLetterCount,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: _GradeChip(
                      label: 'D',
                      count: gradeDist.d,
                      barFraction: gradeDist.d / maxLetterCount,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: _GradeChip(
                      label: failingLetter,
                      count: failingGradeCount,
                      barFraction: failingGradeCount / maxLetterCount,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PassFailStatCard extends StatelessWidget {
  const _PassFailStatCard({
    required this.borderColor,
    required this.dark,
    required this.isPassingBlock,
    required this.heading,
    required this.thresholdLine,
    required this.metricRows,
  });

  final Color borderColor;
  final bool dark;
  final bool isPassingBlock;
  final String heading;
  final String thresholdLine;
  final List<(String label, String value)> metricRows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = isPassingBlock ? _kEvalPassAccent : _kEvalWarnAccent;
    return _ReportCard(
      borderColor: borderColor,
      dark: dark,
      radius: _cardRadiusSm,
      softShadow: true,
      surfaceTint: accent.withValues(alpha: dark ? 0.078 : 0.045),
      borderTint: accent.withValues(alpha: dark ? 0.34 : 0.265),
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            heading,
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: 0.45,
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            thresholdLine,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 11),
          for (var i = 0; i < metricRows.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _StatMetricRow(
              label: metricRows[i].$1,
              value: metricRows[i].$2,
              isMainRate: i == 0,
            ),
          ],
        ],
      ),
    );
  }
}

class _StatMetricRow extends StatelessWidget {
  const _StatMetricRow({
    required this.label,
    required this.value,
    this.isMainRate = false,
  });

  final String label;
  final String value;
  final bool isMainRate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final labelStyle = isMainRate
        ? theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w800,
            height: 1.32,
            fontSize: 12.5,
          )
        : theme.textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
            height: 1.4,
            fontSize: 12,
          );
    final valueStyle = isMainRate
        ? theme.textTheme.bodyMedium?.copyWith(
            height: 1.38,
            fontWeight: FontWeight.w700,
            fontSize: 14,
            letterSpacing: -0.1,
            color: theme.colorScheme.onSurface.withValues(
              alpha: theme.brightness == Brightness.dark ? 0.85 : 0.86,
            ),
          )
        : theme.textTheme.bodySmall?.copyWith(
            height: 1.44,
            fontWeight: FontWeight.w400,
            fontSize: 12.5,
            color: theme.colorScheme.onSurface.withValues(
              alpha: theme.brightness == Brightness.dark ? 0.66 : 0.68,
            ),
          );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$label: ', style: labelStyle),
        Expanded(
          child: Text(value, style: valueStyle),
        ),
      ],
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({
    required this.borderColor,
    required this.dark,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = _cardRadius,
    this.softShadow = false,
    this.surfaceTint,
    this.borderTint,
  });

  final Color borderColor;
  final bool dark;
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final bool softShadow;
  final Color? surfaceTint;
  final Color? borderTint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    var fill = dark
        ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.22)
        : Colors.white;
    if (surfaceTint != null) {
      fill = Color.alphaBlend(surfaceTint!, fill);
    }
    final border = borderTint ??
        borderColor.withValues(alpha: dark ? 0.55 : 0.82);
    final shadows = softShadow
        ? <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: dark ? 0.20 : 0.038),
              blurRadius: 10,
              offset: const Offset(0, 2),
              spreadRadius: -2,
            ),
          ]
        : <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: dark ? 0.26 : 0.05),
              blurRadius: 12,
              offset: const Offset(0, 3),
              spreadRadius: -1,
            ),
          ];

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: border),
          boxShadow: shadows,
        ),
        child: Padding(
          padding: padding,
          child: child,
        ),
      ),
    );
  }
}

/// Letter grade pill — identical geometry on ranking and student rows.
class _EvalGradePill extends StatelessWidget {
  const _EvalGradePill({
    required this.grade,
    this.muted = false,
  });

  final String grade;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: muted ? 0.04 : 0.076),
        borderRadius: BorderRadius.circular(_kEvalGradeChipRadius),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: muted ? 0.07 : 0.115),
        ),
      ),
      child: Padding(
        padding: _kEvalGradeChipPadding,
        child: Text(
          grade,
          style: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 12.5,
            height: 1.05,
            letterSpacing: -0.08,
            color: AppColors.primaryDark.withValues(alpha: muted ? 0.36 : 0.90),
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ),
    );
  }
}

class _GradeChip extends StatelessWidget {
  const _GradeChip({
    required this.label,
    required this.count,
    required this.barFraction,
  });

  final String label;
  final int count;
  final double barFraction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final frac = barFraction.clamp(0.0, 1.0).toDouble();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.14),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(6, 7, 6, 7),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: theme.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: AppColors.primaryDark,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              '$count',
              style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: theme.colorScheme.onSurface.withValues(
                      alpha:
                          theme.brightness == Brightness.dark ? 0.88 : 0.84,
                    ),
                  ),
            ),
            const SizedBox(height: 5),
            ClipRRect(
              borderRadius: BorderRadius.circular(1.5),
              child: SizedBox(
                height: 1.5,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(
                      color: AppColors.primary.withValues(alpha: 0.032),
                    ),
                    FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: frac,
                      child: ColoredBox(
                        color: AppColors.primary.withValues(alpha: 0.15),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RankingCard extends StatelessWidget {
  const _RankingCard({
    required this.borderColor,
    required this.dark,
    required this.rank,
    required this.name,
    required this.scorePct,
    required this.grade,
    required this.remark,
  });

  final Color borderColor;
  final bool dark;
  final int rank;
  final String name;
  final String scorePct;
  final String grade;
  final String remark;

  bool get _isTopThree => rank >= 1 && rank <= 3;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    Color? surfaceTint;
    Color? borderTint;
    double topRankFill = 0;
    double topRankBorder = 0;
    if (_isTopThree) {
      final primary = AppColors.primary;
      if (rank == 1) {
        surfaceTint = primary.withValues(alpha: dark ? 0.058 : 0.036);
        borderTint = primary.withValues(alpha: dark ? 0.30 : 0.19);
        topRankFill = 0.11;
        topRankBorder = dark ? 0.24 : 0.16;
      } else if (rank == 2) {
        surfaceTint = primary.withValues(alpha: dark ? 0.045 : 0.028);
        borderTint = primary.withValues(alpha: dark ? 0.23 : 0.15);
        topRankFill = 0.085;
        topRankBorder = dark ? 0.19 : 0.13;
      } else {
        surfaceTint = primary.withValues(alpha: dark ? 0.034 : 0.021);
        borderTint = primary.withValues(alpha: dark ? 0.17 : 0.11);
        topRankFill = 0.068;
        topRankBorder = dark ? 0.15 : 0.10;
      }
    }

    return _ReportCard(
      borderColor: borderColor,
      dark: dark,
      softShadow: true,
      surfaceTint: surfaceTint,
      borderTint: borderTint,
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 34,
            height: 34,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: _isTopThree
                    ? AppColors.primary.withValues(alpha: topRankFill)
                    : theme.colorScheme.surfaceContainerHighest.withValues(
                        alpha: dark ? 0.35 : 0.45,
                      ),
                borderRadius: BorderRadius.circular(9),
                border: Border.all(
                  color: _isTopThree
                      ? AppColors.primary.withValues(alpha: topRankBorder)
                      : Colors.transparent,
                ),
              ),
              child: Center(
                child: Text(
                  '$rank',
                  style: theme.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    height: 1,
                    color: AppColors.primaryDark.withValues(alpha: 0.88),
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                    fontSize: 15,
                    letterSpacing: -0.28,
                  ),
                ),
                const SizedBox(height: 2),
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: 'Score: ',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                          fontSize: 12,
                        ),
                      ),
                      TextSpan(
                        text: scorePct,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          height: 1.25,
                          color: theme.colorScheme.onSurface.withValues(
                            alpha: dark ? 0.82 : 0.84,
                          ),
                          fontFeatures:
                              const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ],
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (remark.trim().isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    remark.trim(),
                    maxLines: 6,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary.withValues(alpha: 0.78),
                      height: 1.42,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 6),
          _EvalGradePill(grade: grade),
        ],
      ),
    );
  }
}

class _StudentScoreCard extends StatelessWidget {
  const _StudentScoreCard({
    required this.borderColor,
    required this.dark,
    required this.name,
    required this.scorePct,
    required this.grade,
    required this.remarks,
  });

  final Color borderColor;
  final bool dark;
  final String name;
  final String scorePct;
  final String grade;
  final String remarks;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final remarkText = remarks.trim();
    final hasRemark = remarkText.isNotEmpty;
    final isEmptyScore = scorePct == _emDash && grade == _emDash;

    return _ReportCard(
      borderColor: borderColor,
      dark: dark,
      radius: _cardRadiusSm,
      softShadow: true,
      padding: const EdgeInsets.fromLTRB(11, 6, 11, 7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              height: 1.2,
              fontSize: 15,
              letterSpacing: -0.22,
            ),
          ),
          const SizedBox(height: 4),
          Opacity(
            opacity: isEmptyScore ? 0.46 : 1,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      style: theme.textTheme.bodyMedium?.copyWith(height: 1.22),
                      children: [
                        TextSpan(
                          text: 'Score: ',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                            fontSize: 12,
                          ),
                        ),
                        TextSpan(
                          text: scorePct,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w500,
                            color: theme.colorScheme.onSurface.withValues(
                              alpha: isEmptyScore
                                  ? (dark ? 0.55 : 0.58)
                                  : (dark ? 0.82 : 0.84),
                            ),
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Opacity(
                  opacity: isEmptyScore ? 0.72 : 1,
                  child: _EvalGradePill(
                    grade: grade,
                    muted: isEmptyScore,
                  ),
                ),
              ],
            ),
          ),
          if (hasRemark) ...[
            const SizedBox(height: 5),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: 'Remark: ',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppColors.textSecondary.withValues(alpha: 0.72),
                      fontWeight: FontWeight.w600,
                      fontSize: 10.5,
                      height: 1.45,
                    ),
                  ),
                  TextSpan(
                    text: remarkText,
                    style: theme.textTheme.bodySmall?.copyWith(
                      height: 1.45,
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      fontStyle: FontStyle.normal,
                      color: theme.colorScheme.onSurface.withValues(
                        alpha: dark ? 0.64 : 0.66,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            const SizedBox(height: 4),
            Opacity(
              opacity: isEmptyScore ? 0.5 : 0.78,
              child: Text(
                'No remark',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary.withValues(alpha: 0.62),
                  fontStyle: FontStyle.italic,
                  fontSize: 11.5,
                  height: 1.36,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

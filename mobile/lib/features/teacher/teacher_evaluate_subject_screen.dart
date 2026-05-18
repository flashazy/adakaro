import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/gradebook/gradebook_full_report_compute.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_enrollment.dart';
import '../../data/teacher_repository.dart';
import 'teacher_evaluate_subject_pdf.dart';
import 'teacher_evaluate_subject_report_screen.dart';

const _emDash = '\u2014';

/// Horizontal padding for this screen (keeps dropdowns, card, and CTA aligned).
const _kPageHPadding = 20.0;

/// Entry screen for **Evaluate Subject** — filters and summary; full report on tap.
class TeacherEvaluateSubjectScreen extends StatefulWidget {
  const TeacherEvaluateSubjectScreen({
    super.key,
    required this.user,
    required this.data,
  });

  final User user;
  final TeacherDeskData data;

  @override
  State<TeacherEvaluateSubjectScreen> createState() =>
      _TeacherEvaluateSubjectScreenState();
}

class _TeacherEvaluateSubjectScreenState
    extends State<TeacherEvaluateSubjectScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);

  late String _term;
  int _pairIx = 0;
  TeacherGradebookMatrixSnapshot? _matrix;
  TeacherEvaluateReportMeta? _meta;
  bool _loading = false;
  String? _error;
  bool _exportBusy = false;

  TeacherAssignmentDisplay? get _pair {
    final a = widget.data.assignments;
    if (a.isEmpty || _pairIx < 0 || _pairIx >= a.length) return null;
    return a[_pairIx];
  }

  @override
  void initState() {
    super.initState();
    _term = teacherCurrentEnrollmentPeriod().term;
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  ClassDraft _draftFromMatrix(TeacherGradebookMatrixSnapshot snap) {
    final d = <String, Map<String, DraftCell>>{};
    for (final a in snap.assignments) {
      d[a.id] = {};
      for (final s in snap.students) {
        final cell = snap.scoreMatrix[a.id]?[s.id];
        final scoreStr = cell?.score == null
            ? ''
            : _stripScore(cell!.score!);
        final rem = cell?.remarks?.trim() ?? '';
        d[a.id]![s.id] = DraftCell(score: scoreStr, remarks: rem);
      }
    }
    return d;
  }

  String _stripScore(double v) {
    if (v == v.roundToDouble()) return '${v.round()}';
    return v.toString();
  }

  int _countScoredCells(TeacherGradebookMatrixSnapshot snap) {
    var n = 0;
    for (final a in snap.assignments) {
      for (final s in snap.students) {
        final sc = snap.scoreMatrix[a.id]?[s.id]?.score;
        if (sc != null) n++;
      }
    }
    return n;
  }

  Future<void> _reload() async {
    final p = _pair;
    if (p == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final matrix = await _repo.loadGradebookClassMatrix(
        teacherId: widget.user.id,
        classId: p.classId,
        subjectLabel: p.subjectLabel,
        term: _term,
        subjectId: p.subjectId,
      );
      final meta = await _repo.loadEvaluateReportMeta(
        teacherId: widget.user.id,
        classId: p.classId,
        subjectLabel: p.subjectLabel,
      );
      if (!mounted) return;
      setState(() {
        _matrix = matrix;
        _meta = meta;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyDataLoadError(e);
        _loading = false;
      });
    }
  }

  Future<void> _promptNewAssignment() async {
    final p = _pair;
    if (p == null) return;
    final titleCtrl = TextEditingController();
    final maxCtrl = TextEditingController(text: '100');
    final weightCtrl = TextEditingController(text: '100');
    final dueCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New assignment'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: maxCtrl,
                decoration: const InputDecoration(
                  labelText: 'Max score',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: weightCtrl,
                decoration: const InputDecoration(
                  labelText: 'Weight (%)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dueCtrl,
                decoration: const InputDecoration(
                  labelText: 'Due date (optional, YYYY-MM-DD)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Create'),
          ),
        ],
      ),
    );

    final title = titleCtrl.text.trim();
    final mxRaw = maxCtrl.text.trim();
    final wRaw = weightCtrl.text.trim();
    final due = dueCtrl.text.trim();
    titleCtrl.dispose();
    maxCtrl.dispose();
    weightCtrl.dispose();
    dueCtrl.dispose();

    if (ok != true || title.isEmpty) return;
    final mx = double.tryParse(mxRaw.replaceAll(',', '.')) ?? 100;
    final weight = double.tryParse(wRaw.replaceAll(',', '.')) ?? 100;

    try {
      await _repo.createGradebookAssignment(
        teacherId: widget.user.id,
        classId: p.classId,
        subject: p.subjectLabel,
        title: title,
        maxScore: mx,
        weight: weight,
        dueDate: due.isEmpty ? null : due,
        term: _term,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Assignment created.')),
        );
        await _reload();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDataLoadError(e))),
        );
      }
    }
  }

  String get _schoolLevel => widget.data.schoolLevel ?? 'secondary';

  String get _dateLabel =>
      DateFormat('d MMMM yyyy').format(DateTime.now());

  bool get _canExportOrPrint =>
      _matrix != null &&
      _meta != null &&
      _matrix!.assignments.isNotEmpty &&
      _matrix!.students.isNotEmpty &&
      !_loading;

  TeacherGradebookAssignmentMini _assignmentFor(
    TeacherGradebookMatrixSnapshot snap,
  ) =>
      snap.assignments.first;

  String _genderLabel(String? gender) {
    if (gender == 'male') return 'Male';
    if (gender == 'female') return 'Female';
    return _emDash;
  }

  AssignmentStats _assignmentStats(
    TeacherGradebookMatrixSnapshot snap,
    ClassDraft draft,
  ) {
    final sel = _assignmentFor(snap);
    final students =
        snap.students.map((s) => (id: s.id, gender: s.gender)).toList();
    return computeReportStatsForAssignment(
      students,
      (id: sel.id, maxScore: sel.maxScore),
      draft,
      _schoolLevel,
    );
  }

  List<RankingRow> _assignmentRanking(
    TeacherGradebookMatrixSnapshot snap,
    ClassDraft draft,
  ) {
    final sel = _assignmentFor(snap);
    final students =
        snap.students.map((s) => (id: s.id, fullName: s.fullName)).toList();
    return buildStudentRanking(
      students,
      (id: sel.id, maxScore: sel.maxScore),
      draft,
      _schoolLevel,
    );
  }

  List<EvaluateSubjectPdfStudentRow> _assignmentScoreRows(
    TeacherGradebookMatrixSnapshot snap,
    ClassDraft draft,
  ) {
    final sel = _assignmentFor(snap);
    return [
      for (final s in snap.students)
        () {
          final g = scoreGradeForAssignment(
            draft[sel.id]?[s.id]?.score,
            sel.maxScore,
            _schoolLevel,
          );
          final remarks = draft[sel.id]?[s.id]?.remarks.trim() ?? '';
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

  EvaluateSubjectPdfInput _buildPdfInput() {
    final snap = _matrix!;
    final meta = _meta!;
    final draft = _draftFromMatrix(snap);
    final sel = _assignmentFor(snap);
    final stats = _assignmentStats(snap, draft);
    return EvaluateSubjectPdfInput(
      schoolName: meta.schoolName,
      className: meta.className,
      subject: meta.subject,
      teacherName: meta.teacherName,
      termLabel: meta.termLabel,
      selectedTerm: _term,
      dateLabel: _dateLabel,
      assignmentTitle: sel.title,
      assignmentMaxScore: sel.maxScore,
      schoolLevel: _schoolLevel,
      passing: stats.passing,
      failing: stats.failing,
      dist: stats.dist,
      ranking: _assignmentRanking(snap, draft),
      rows: _assignmentScoreRows(snap, draft),
    );
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
    final bytes = await buildEvaluateSubjectPdfBytes(_buildPdfInput());
    final fname = evaluateSubjectExportFilename(
      className: _meta!.className,
      subject: _meta!.subject,
      selectedTerm: _term,
    );
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory('${docs.path}/subject_evaluations');
    if (!await dir.exists()) await dir.create(recursive: true);
    final path = '${dir.path}/$fname';
    await File(path).writeAsBytes(bytes, flush: true);
    debugPrint('Subject evaluation PDF saved: $path');
    return (path: path, filename: fname, bytes: bytes);
  }

  Future<void> _exportPdf() async {
    if (_exportBusy || !_canExportOrPrint) return;
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
    if (!_canExportOrPrint) return;
    try {
      final bytes = await buildEvaluateSubjectPdfBytes(_buildPdfInput());
      await Printing.layoutPdf(
        name: evaluateSubjectExportFilename(
          className: _meta!.className,
          subject: _meta!.subject,
          selectedTerm: _term,
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

  void _openEvaluationReport() {
    final snap = _matrix;
    final meta = _meta;
    if (snap == null || meta == null) return;
    if (snap.assignments.isEmpty || snap.students.isEmpty) return;

    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => TeacherEvaluateSubjectReportScreen(
          schoolLevel: widget.data.schoolLevel ?? 'secondary',
          meta: meta,
          selectedTerm: _term,
          snapshot: snap,
          draft: _draftFromMatrix(snap),
        ),
      ),
    );
  }

  Color _pageBackground(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    return dark
        ? Color.lerp(
            theme.colorScheme.surfaceContainerLowest,
            theme.colorScheme.surface,
            0.25,
          )!
        : Color.lerp(AppColors.surface, Colors.white, 0.38)!;
  }

  InputDecoration _evalDropdownDecoration(
    BuildContext context, {
    required String labelText,
  }) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final borderColor =
        AppColors.cardBorder.withValues(alpha: dark ? 0.36 : 0.76);
    final radius = BorderRadius.circular(12);
    final baseBorder = OutlineInputBorder(
      borderRadius: radius,
      borderSide: BorderSide(color: borderColor, width: 1),
    );
    return InputDecoration(
      labelText: labelText,
      isDense: true,
      contentPadding: const EdgeInsetsDirectional.only(
        start: 16,
        end: 12,
        top: 16,
        bottom: 15,
      ),
      filled: true,
      fillColor: theme.colorScheme.surface.withValues(alpha: dark ? 0.38 : 0.92),
      border: baseBorder,
      enabledBorder: baseBorder,
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(
          color: AppColors.primary.withValues(alpha: 0.34),
          width: 1.1,
        ),
      ),
      labelStyle: theme.textTheme.bodySmall?.copyWith(
        color: AppColors.textSecondary.withValues(alpha: 0.85),
        fontWeight: FontWeight.w500,
        fontSize: 12.5,
        letterSpacing: 0.02,
      ),
      floatingLabelStyle: WidgetStateTextStyle.resolveWith((states) {
        final c = states.contains(WidgetState.focused)
            ? AppColors.primary.withValues(alpha: 0.82)
            : AppColors.textSecondary.withValues(alpha: 0.88);
        return TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 12,
          letterSpacing: 0.02,
          color: c,
        );
      }),
    );
  }

  /// Metrics line: balanced on wide layouts; stacks cleanly on narrow widths.
  Widget _summaryMetricsRow(
    BuildContext context,
    TeacherGradebookMatrixSnapshot snap,
    int scored,
  ) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final valueStyle = theme.textTheme.bodyMedium?.copyWith(
      height: 1.35,
      fontWeight: FontWeight.w500,
      letterSpacing: -0.06,
      color: theme.colorScheme.onSurface.withValues(
        alpha: dark ? 0.84 : 0.8,
      ),
    );
    final sepColor = AppColors.textSecondary.withValues(alpha: 0.35);
    final a = snap.assignments.length;
    final s = snap.students.length;
    final aLabel = '$a assignment${a == 1 ? '' : 's'}';
    final sLabel = '$s student${s == 1 ? '' : 's'}';
    final scLabel = '$scored score${scored == 1 ? '' : 's'} saved';

    return LayoutBuilder(
      builder: (context, constraints) {
        final narrow = constraints.maxWidth < 300;
        final dot = Padding(
          padding: const EdgeInsets.symmetric(horizontal: 5),
          child: Text(
            '·',
            style: theme.textTheme.bodySmall?.copyWith(
              color: sepColor,
              fontWeight: FontWeight.w300,
              height: 1.2,
            ),
          ),
        );
        if (narrow) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(aLabel, style: valueStyle),
              const SizedBox(height: 7),
              Text(sLabel, style: valueStyle),
              const SizedBox(height: 7),
              Text(scLabel, style: valueStyle),
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                aLabel,
                style: valueStyle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            dot,
            Expanded(
              child: Text(
                sLabel,
                style: valueStyle,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            dot,
            Expanded(
              child: Text(
                scLabel,
                style: valueStyle,
                textAlign: TextAlign.end,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _evaluationCta(
    BuildContext context, {
    required bool enabled,
    required VoidCallback? onPressed,
  }) {
    final theme = Theme.of(context);
    final radius = BorderRadius.circular(12);
    final shadow = [
      BoxShadow(
        color: AppColors.primary.withValues(alpha: enabled ? 0.11 : 0.04),
        blurRadius: enabled ? 14 : 6,
        offset: Offset(0, enabled ? 4 : 2),
        spreadRadius: -2,
      ),
    ];
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: shadow,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: enabled
            ? DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color.lerp(
                            AppColors.primary,
                            Colors.white,
                            0.07,
                          ) ??
                          AppColors.primary,
                      AppColors.primary,
                    ],
                  ),
                ),
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    elevation: 0,
                    shadowColor: Colors.transparent,
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.transparent,
                    minimumSize: const Size(double.infinity, 48),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    shape: RoundedRectangleBorder(borderRadius: radius),
                    textStyle: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.12,
                    ),
                    iconSize: 20.5,
                  ),
                  onPressed: onPressed,
                  icon: const Icon(Icons.insights_rounded),
                  label: const Text('View evaluation'),
                ),
              )
            : SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    elevation: 0,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.28),
                    foregroundColor: Colors.white.withValues(alpha: 0.72),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    shape: RoundedRectangleBorder(borderRadius: radius),
                    textStyle: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.12,
                    ),
                    iconSize: 20.5,
                  ),
                  onPressed: null,
                  icon: const Icon(Icons.insights_rounded),
                  label: const Text('View evaluation'),
                ),
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pageBg = _pageBackground(context);
    final theme = Theme.of(context);
    final iconMuted =
        theme.colorScheme.onSurface.withValues(alpha: 0.56);

    if (!widget.data.hasTeachingAssignments ||
        widget.data.assignments.isEmpty) {
      return Scaffold(
        backgroundColor: pageBg,
        appBar: AppBar(
          title: const Text('Evaluate subject'),
          backgroundColor: pageBg,
          elevation: 0,
          scrolledUnderElevation: 0,
          surfaceTintColor: Colors.transparent,
          centerTitle: true,
          toolbarHeight: 54,
          leadingWidth: 48,
          iconTheme: IconThemeData(color: iconMuted, size: 22),
          actionsIconTheme: IconThemeData(color: iconMuted, size: 22),
          titleTextStyle: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
            letterSpacing: -0.18,
          ),
        ),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: _kPageHPadding),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.groups_outlined,
                    size: 44,
                    color: AppColors.textSecondary.withValues(alpha: 0.45),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Evaluation is available when your school assigns you to classes.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.5,
                      fontWeight: FontWeight.w400,
                      fontSize: 14.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final pairs = widget.data.assignments;
    final snap = _matrix;
    final scored = snap == null ? 0 : _countScoredCells(snap);
    final canEvaluate = snap != null &&
        snap.assignments.isNotEmpty &&
        snap.students.isNotEmpty;
    final dark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: pageBg,
      appBar: AppBar(
        title: const Text('Evaluate subject'),
        backgroundColor: pageBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        toolbarHeight: 54,
        titleSpacing: 0,
        titleTextStyle: theme.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.18,
        ),
        iconTheme: IconThemeData(color: iconMuted, size: 22),
        actionsIconTheme: IconThemeData(color: iconMuted, size: 22),
        leadingWidth: 48,
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Export & print',
            padding: const EdgeInsetsDirectional.only(start: 8, end: 4),
            splashRadius: 22,
            icon: Icon(Icons.more_vert_rounded, color: iconMuted, size: 22),
            onSelected: (value) {
              switch (value) {
                case 'pdf':
                  unawaited(_exportPdf());
                  break;
                case 'print':
                  unawaited(_printPdf());
                  break;
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'pdf',
                enabled: _canExportOrPrint && !_exportBusy,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.picture_as_pdf_outlined,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.78),
                  ),
                  title: Text(
                    _exportBusy ? 'Preparing PDF…' : 'Export PDF',
                  ),
                ),
              ),
              PopupMenuItem(
                value: 'print',
                enabled: _canExportOrPrint,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.print_outlined,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.78),
                  ),
                  title: const Text('Print'),
                ),
              ),
            ],
          ),
          IconButton(
            tooltip: 'New assignment',
            style: IconButton.styleFrom(
              foregroundColor: iconMuted,
              padding: const EdgeInsetsDirectional.only(end: 12),
            ),
            onPressed: _pair == null ? null : _promptNewAssignment,
            icon: const Icon(Icons.add_rounded, size: 23),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            _kPageHPadding,
            6,
            _kPageHPadding,
            72,
          ),
          children: [
            Text(
              'Review class performance from saved marks — the same analysis as '
              'the Adakaro web gradebook. Enter scores on Enter scores first.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary.withValues(alpha: 0.78),
                height: 1.52,
                fontSize: 12,
                fontWeight: FontWeight.w400,
                letterSpacing: 0.01,
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _term,
              isExpanded: true,
              icon: Icon(
                Icons.expand_more_rounded,
                size: 22,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.42),
              ),
              decoration: _evalDropdownDecoration(context, labelText: 'Term'),
              items: const [
                DropdownMenuItem(value: 'Term 1', child: Text('Term 1')),
                DropdownMenuItem(value: 'Term 2', child: Text('Term 2')),
              ],
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
                letterSpacing: -0.12,
              ),
              onChanged: (v) {
                if (v == null) return;
                setState(() => _term = v);
                _reload();
              },
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<int>(
              value: _pairIx.clamp(0, pairs.length - 1),
              isExpanded: true,
              icon: Icon(
                Icons.expand_more_rounded,
                size: 22,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.42),
              ),
              decoration:
                  _evalDropdownDecoration(context, labelText: 'Class & subject'),
              selectedItemBuilder: (context) {
                return [
                  for (var i = 0; i < pairs.length; i++)
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Text(
                        '${pairs[i].className} · ${pairs[i].subjectLabel}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        softWrap: true,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                          height: 1.25,
                        ),
                      ),
                    ),
                ];
              },
              items: [
                for (var i = 0; i < pairs.length; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text(
                      '${pairs[i].className} · ${pairs[i].subjectLabel}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
                letterSpacing: -0.12,
              ),
              onChanged: (v) {
                if (v == null) return;
                setState(() => _pairIx = v);
                _reload();
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(
                _error!,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ],
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 44),
                child: Center(
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                ),
              )
            else if (snap != null) ...[
              const SizedBox(height: 20),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface.withValues(
                    alpha: dark ? 0.5 : 0.98,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: AppColors.cardBorder.withValues(
                      alpha: dark ? 0.34 : 0.68,
                    ),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: dark ? 0.1 : 0.035),
                      blurRadius: 14,
                      offset: const Offset(0, 3),
                      spreadRadius: -2,
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 17, 18, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Summary',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.12,
                          color: theme.colorScheme.onSurface.withValues(
                            alpha: 0.92,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _summaryMetricsRow(context, snap, scored),
                      if (snap.assignments.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Text(
                            'No assignments for this class, subject, and term yet.',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.45,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              _evaluationCta(
                context,
                enabled: canEvaluate,
                onPressed: canEvaluate ? _openEvaluationReport : null,
              ),
              if (!canEvaluate)
                Padding(
                  padding: const EdgeInsets.only(top: 9),
                  child: Text(
                    'Add assignments and saved marks to run evaluation.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary.withValues(alpha: 0.8),
                      height: 1.42,
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

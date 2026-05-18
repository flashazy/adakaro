import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';

import 'teacher_lesson_plan_pdf.dart';
import 'teacher_new_lesson_plan_screen.dart';

/// Matches `TEACHING_LEARNING_PROCESS_STAGES` in `lib/teaching-learning-process.ts`.
const _tlStageEntries = <(String key, String label)>[
  ('introduction', 'Introduction'),
  ('competence_development', 'Competence Development'),
  ('design_and_realization', 'Design and Realization'),
  ('closure', 'Closure'),
];

/// Same placeholder as web read-only lesson plan (`—`).
const _emDash = '\u2014';

/// Section / content cards (light mode): clean white, soft corners.
const double _kCardRadius = 14;
const EdgeInsets _kSectionCardPadding = EdgeInsets.fromLTRB(20, 18, 20, 18);
const EdgeInsets _kHeaderCardPadding = EdgeInsets.fromLTRB(20, 18, 20, 20);

class TeacherLessonPlanDetailScreen extends StatefulWidget {
  const TeacherLessonPlanDetailScreen({
    super.key,
    required this.user,
    required this.data,
    required this.summary,
  });

  final User user;
  final TeacherDeskData data;
  final TeacherLessonPlanListRow summary;

  @override
  State<TeacherLessonPlanDetailScreen> createState() =>
      _TeacherLessonPlanDetailScreenState();
}

class _TeacherLessonPlanDetailScreenState
    extends State<TeacherLessonPlanDetailScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);

  Map<String, dynamic>? _row;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final row = await _repo.loadLessonPlanDetail(
        widget.summary.id,
        widget.user.id,
      );
      if (!mounted) return;
      if (row == null) {
        setState(() {
          _row = null;
          _loading = false;
          _error = 'Could not open lesson plan. Please try again.';
        });
        return;
      }
      setState(() {
        _row = row;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not open lesson plan. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _openEditor() async {
    if (_row == null) return;
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (ctx) => TeacherNewLessonPlanScreen(
          user: widget.user,
          data: widget.data,
          editSeed: TeacherLessonPlanEditSeed(
            id: widget.summary.id,
            row: Map<String, dynamic>.from(_row!),
          ),
        ),
      ),
    );
    if (updated == true && mounted) {
      await _load();
    }
  }

  String _teacherDisplayName() {
    final n = widget.data.teacherName?.trim();
    if (n != null && n.isNotEmpty) return n;
    final e = widget.user.email?.trim();
    if (e != null && e.isNotEmpty) return e;
    return 'Teacher';
  }

  Future<Uint8List> _lessonPlanPdfBytes() => buildLessonPlanPdfBytes(
        row: _row!,
        deskData: widget.data,
        summary: widget.summary,
        teacherDisplayName: _teacherDisplayName(),
      );

  /// App-accessible folder for exported lesson plan PDFs.
  Future<Directory> _lessonPlanExportDir() async {
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory('${docs.path}/lesson_plans');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  /// Writes the lesson plan PDF; returns absolute path and filename.
  Future<({String path, String filename, Uint8List bytes})> _saveLessonPlanPdf() async {
    final bytes = await _lessonPlanPdfBytes();
    final fname = lessonPlanExportFilenameFromRow(_row!, widget.summary);
    final dir = await _lessonPlanExportDir();
    final path = '${dir.path}/$fname';
    await File(path).writeAsBytes(bytes, flush: true);
    debugPrint('Lesson plan PDF saved: $path (${bytes.length} bytes)');
    return (path: path, filename: fname, bytes: bytes);
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

  Future<void> _exportPdf() async {
    if (_row == null || !mounted) return;
    try {
      final saved = await _saveLessonPlanPdf();
      if (!mounted) return;
      try {
        final result = await Share.shareXFiles(
          [
            XFile.fromData(
              saved.bytes,
              mimeType: 'application/pdf',
              name: saved.filename,
            ),
          ],
          subject: 'Lesson plan',
        );
        debugPrint('share_plus export result: $result');
        if (!mounted) return;
        _showSnack('Lesson plan PDF ready to share or save.');
      } catch (e, st) {
        debugPrint('share_plus export failed (${e.runtimeType}): $e\n$st');
        if (!mounted) return;
        if (_isPluginUnavailable(e)) {
          try {
            await Printing.sharePdf(
              bytes: saved.bytes,
              filename: saved.filename,
            );
            debugPrint('Printing.sharePdf fallback succeeded');
            if (!mounted) return;
            _showSnack('Lesson plan PDF ready to share or save.');
            return;
          } catch (e2, st2) {
            debugPrint(
              'Printing.sharePdf fallback failed (${e2.runtimeType}): $e2\n$st2',
            );
          }
        }
        _showSnack(
          'PDF saved here:\n${saved.path}\n'
          'Open Files › app storage if sharing is unavailable.',
        );
      }
    } catch (e, st) {
      debugPrint('lesson plan PDF export failed (${e.runtimeType}): $e\n$st');
      if (!mounted) return;
      _showSnack('Could not create the lesson plan PDF. Please try again.');
    }
  }

  Future<void> _printPdf() async {
    if (_row == null || !mounted) return;
    try {
      await Printing.layoutPdf(
        name: lessonPlanExportFilenameFromRow(_row!, widget.summary),
        onLayout: (_) => _lessonPlanPdfBytes(),
      );
    } catch (e, st) {
      debugPrint('printing layoutPdf failed (${e.runtimeType}): $e\n$st');
      if (!mounted) return;
      if (_isPluginUnavailable(e)) {
        _showSnack(
          'Printing is not available on this device. Please export the PDF instead.',
        );
      } else {
        _showSnack('Could not open the print dialog. Please try again.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final pageBg = dark
        ? Color.lerp(cs.surfaceContainerLowest, cs.surface, 0.25)!
        : Color.lerp(AppColors.surface, Colors.white, 0.35)!;

    return Scaffold(
      backgroundColor: pageBg,
      appBar: AppBar(
        centerTitle: true,
        toolbarHeight: 48,
        title: Text(
          'Lesson plan',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
        ),
        actions: [
          if (_row != null && _error == null && !_loading) ...[
            IconButton(
              tooltip: 'Edit',
              onPressed: _openEditor,
              icon: Icon(
                Icons.edit_rounded,
                color: AppColors.primary.withValues(alpha: 0.92),
              ),
            ),
            PopupMenuButton<String>(
              tooltip: 'Export & print',
              icon: Icon(
                Icons.more_vert_rounded,
                color: theme.colorScheme.onSurface.withValues(
                  alpha: dark ? 0.82 : 0.55,
                ),
              ),
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
              itemBuilder: (ctx) => const [
                PopupMenuItem(
                  value: 'pdf',
                  child: Text('Export PDF'),
                ),
                PopupMenuItem(
                  value: 'print',
                  child: Text('Print'),
                ),
              ],
            ),
          ],
        ],
        backgroundColor: pageBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        shadowColor: Colors.black.withValues(alpha: dark ? 0.22 : 0.06),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: dark
                      ? Colors.white.withValues(alpha: 0.1)
                      : AppColors.cardBorder.withValues(alpha: 0.75),
                ),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: dark ? 0.25 : 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: const SizedBox(height: 1),
          ),
        ),
      ),
      body: _loading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: AppColors.primary.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Loading…',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary.withValues(
                        alpha: dark ? 0.55 : 0.72,
                      ),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.error_outline_rounded,
                          size: 44,
                          color: cs.error.withValues(alpha: 0.75),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.45,
                          ),
                        ),
                        const SizedBox(height: 20),
                        FilledButton.tonalIcon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded, size: 20),
                          label: const Text('Try again'),
                        ),
                      ],
                    ),
                  ),
                )
              : _row == null
                  ? const SizedBox.shrink()
                  : _DetailBody(row: _row!, summary: widget.summary),
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({
    required this.row,
    required this.summary,
  });

  final Map<String, dynamic> row;
  final TeacherLessonPlanListRow summary;

  static String _str(dynamic v) {
    if (v == null) return '';
    return '$v'.trim();
  }

  /// Web: `value?.trim() || "—"`.
  static String _webBody(dynamic v) {
    final t = _str(v);
    return t.isEmpty ? _emDash : t;
  }

  static String _classNameFromRow(Map<String, dynamic> r) {
    final cls = r['classes'];
    if (cls is Map) return '${cls['name'] ?? ''}'.trim();
    if (cls is List && cls.isNotEmpty && cls.first is Map) {
      return '${(cls.first as Map)['name'] ?? ''}'.trim();
    }
    return '';
  }

  static String _subjectNameFromRow(Map<String, dynamic> r) {
    final sub = r['subjects'];
    if (sub is Map) return '${sub['name'] ?? ''}'.trim();
    if (sub is List && sub.isNotEmpty && sub.first is Map) {
      return '${(sub.first as Map)['name'] ?? ''}'.trim();
    }
    return '';
  }

  /// `references` column (quoted in Postgres).
  static String _referencesField(Map<String, dynamic> r) {
    final a = r['references'];
    if (a == null) return '';
    return '$a'.trim();
  }

  static Map<String, dynamic>? _stageMap(Map<String, dynamic> r, String key) {
    final tlp = r['teaching_learning_process'];
    if (tlp is! Map) return null;
    final s = tlp[key];
    if (s is! Map) return null;
    return Map<String, dynamic>.from(
      s.map(
        (k, v) => MapEntry(k.toString(), v),
      ),
    );
  }

  /// Web view: `row?.time === null || row?.time === undefined ? "—" : String(row.time)`.
  static String _webTimeMinutes(Map<String, dynamic>? m) {
    if (m == null) return _emDash;
    final ti = m['time'];
    if (ti == null) return _emDash;
    final s = '$ti'.trim();
    return s.isEmpty ? _emDash : s;
  }

  static Color _onSurfaceStrong(ThemeData theme, bool dark) =>
      theme.colorScheme.onSurface.withValues(alpha: dark ? 0.96 : 0.94);

  static Color _bodyTextColor(ThemeData theme, bool dark) => dark
      ? theme.colorScheme.onSurface.withValues(alpha: 0.88)
      : const Color(0xFF334155);

  static Color _mutedLabelColor(bool dark) =>
      AppColors.textSecondary.withValues(alpha: dark ? 0.58 : 0.72);

  static Widget _documentSectionTitle(
    ThemeData theme,
    String title, {
    required bool dark,
  }) {
    return Text(
      title,
      style: theme.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.22,
        height: 1.2,
        color: _onSurfaceStrong(theme, dark),
      ),
    );
  }

  /// Thin rule under section headings for clearer scan hierarchy.
  static Widget _titleSeparator(bool dark) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 2),
      child: Container(
        height: 1,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(99),
          color: dark
              ? Colors.white.withValues(alpha: 0.1)
              : AppColors.primary.withValues(alpha: 0.12),
        ),
      ),
    );
  }

  static Widget _fieldLabel(
    ThemeData theme,
    String label, {
    required bool dark,
    bool timeStyle = false,

    /// Subtle indigo emphasis for official fourth column label only (no container).
    bool primaryEmphasis = false,
  }) {
    final base = theme.textTheme.labelLarge;
    if (timeStyle) {
      return Text(
        label,
        style: base?.copyWith(
          color: _mutedLabelColor(dark),
          fontWeight: FontWeight.w600,
          fontSize: 11,
          letterSpacing: 0.35,
          height: 1.2,
        ),
      );
    }
    if (primaryEmphasis) {
      return Text(
        label,
        style: base?.copyWith(
          color: dark
              ? const Color(0xFFC4B5FD).withValues(alpha: 0.92)
              : AppColors.primaryDark.withValues(alpha: 0.88),
          fontWeight: FontWeight.w800,
          letterSpacing: 0.14,
          height: 1.2,
        ),
      );
    }
    return Text(
      label,
      style: base?.copyWith(
        color: _mutedLabelColor(dark),
        fontWeight: FontWeight.w700,
        letterSpacing: 0.12,
        height: 1.2,
      ),
    );
  }

  static Widget _bodyParagraph(
    ThemeData theme,
    String text, {
    required bool dark,
  }) {
    return SelectableText(
      text,
      style: theme.textTheme.bodyMedium?.copyWith(
        height: 1.48,
        color: _bodyTextColor(theme, dark),
      ),
    );
  }

  /// One web section = one premium card (matches stacked `<section>` blocks on web).
  static Widget _webSectionCard({
    required ThemeData theme,
    required Color borderColor,
    required bool dark,
    required String heading,
    required String body,
  }) {
    return _PremiumCard(
      borderColor: borderColor,
      padding: _kSectionCardPadding,
      backgroundColor: dark ? null : Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _documentSectionTitle(theme, heading, dark: dark),
          _titleSeparator(dark),
          _bodyParagraph(theme, body, dark: dark),
        ],
      ),
    );
  }

  /// One table row on web → one premium card on mobile.
  static Widget _tlStageCard({
    required ThemeData theme,
    required Color borderColor,
    required bool dark,
    required String stageLabel,
    required Map<String, dynamic>? stage,
  }) {
    final m = stage;
    final time = _webTimeMinutes(m);
    final teaching = _webBody(m?['teaching_activities']);
    final learning = _webBody(m?['learning_activities']);
    final assessment = _webBody(m?['assessment_criteria']);

    final dividerColor = dark
        ? Colors.white.withValues(alpha: 0.1)
        : AppColors.cardBorder.withValues(alpha: 0.55);

    return _PremiumCard(
      borderColor: borderColor,
      padding: _kSectionCardPadding,
      backgroundColor: dark ? null : Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            stageLabel,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.25,
              height: 1.15,
              color: _onSurfaceStrong(theme, dark),
            ),
          ),
          const SizedBox(height: 12),
          _fieldLabel(theme, 'Time (minutes)', dark: dark, timeStyle: true),
          const SizedBox(height: 5),
          _bodyParagraph(theme, time, dark: dark),
          const SizedBox(height: 12),
          _fieldLabel(theme, 'Teaching Activities', dark: dark),
          const SizedBox(height: 5),
          _bodyParagraph(theme, teaching, dark: dark),
          const SizedBox(height: 12),
          _fieldLabel(theme, 'Learning Activities', dark: dark),
          const SizedBox(height: 5),
          _bodyParagraph(theme, learning, dark: dark),
          const SizedBox(height: 14),
          Divider(height: 1, thickness: 1, color: dividerColor),
          const SizedBox(height: 14),
          _fieldLabel(
            theme,
            'Assessment Criteria',
            dark: dark,
            primaryEmphasis: true,
          ),
          const SizedBox(height: 5),
          _bodyParagraph(theme, assessment, dark: dark),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final borderColor =
        AppColors.cardBorder.withValues(alpha: dark ? 0.38 : 0.72);

    final subject = _subjectNameFromRow(row).isNotEmpty
        ? _subjectNameFromRow(row)
        : summary.subjectName;
    final className = _classNameFromRow(row).isNotEmpty
        ? _classNameFromRow(row)
        : summary.className;
    final lessonDate = _str(row['lesson_date']).isNotEmpty
        ? _str(row['lesson_date'])
        : summary.lessonDate;
    final period =
        _str(row['period']).isNotEmpty ? _str(row['period']) : summary.period;
    final dur = row['duration_minutes'];
    final durationMinutes = dur is num
        ? dur.toInt()
        : int.tryParse('$dur') ?? summary.durationMinutes;

    // Mobile lesson plan edit/delete flows are not wired yet (web-only).
    // TODO: Add Edit / Delete when teacher lesson plan editor and delete RPC exist on mobile.

    final tlpChildren = <Widget>[
      _documentSectionTitle(
        theme,
        'Teaching and Learning Process',
        dark: dark,
      ),
      const SizedBox(height: 8),
    ];
    for (var i = 0; i < _tlStageEntries.length; i++) {
      final (key, label) = _tlStageEntries[i];
      if (i > 0) tlpChildren.add(const SizedBox(height: 10));
      tlpChildren.add(
        _tlStageCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          stageLabel: label,
          stage: _stageMap(row, key),
        ),
      );
    }

    final bottomPad = MediaQuery.paddingOf(context).bottom + 48;

    return ListView(
      padding: EdgeInsets.fromLTRB(
        TeacherUiTokens.horizontalPadding,
        4,
        TeacherUiTokens.horizontalPadding,
        bottomPad,
      ),
      children: [
        _LessonPlanHeaderCard(
          borderColor: borderColor,
          dark: dark,
          subject: subject,
          className: className,
          lessonDate: lessonDate,
          period: period,
          durationMinutes: durationMinutes,
        ),
        const SizedBox(height: 12),
        _webSectionCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          heading: 'Main competence',
          body: _webBody(row['main_competence']),
        ),
        const SizedBox(height: 12),
        _webSectionCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          heading: 'Specific competence',
          body: _webBody(row['specific_competence']),
        ),
        const SizedBox(height: 12),
        _webSectionCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          heading: 'Main Activities',
          body: _webBody(row['main_activities']),
        ),
        const SizedBox(height: 12),
        _webSectionCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          heading: 'Specific Activities',
          body: _webBody(row['specific_activities']),
        ),
        const SizedBox(height: 12),
        _webSectionCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          heading: 'Teaching and Learning Resources',
          body: _webBody(row['teaching_resources']),
        ),
        const SizedBox(height: 12),
        ...tlpChildren,
        const SizedBox(height: 12),
        _webSectionCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          heading: 'References',
          body: _webBody(_referencesField(row)),
        ),
        const SizedBox(height: 12),
        _webSectionCard(
          theme: theme,
          borderColor: borderColor,
          dark: dark,
          heading: 'Remarks / evaluation',
          body: _webBody(row['remarks']),
        ),
      ],
    );
  }
}

/// Summary header: soft indigo wash (light) — premium, still document-like.
class _LessonPlanHeaderCard extends StatelessWidget {
  const _LessonPlanHeaderCard({
    required this.borderColor,
    required this.dark,
    required this.subject,
    required this.className,
    required this.lessonDate,
    required this.period,
    required this.durationMinutes,
  });

  final Color borderColor;
  final bool dark;
  final String subject;
  final String className;
  final String lessonDate;
  final String period;
  final int durationMinutes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final decoration = BoxDecoration(
      borderRadius: BorderRadius.circular(_kCardRadius),
      border: Border.all(color: borderColor),
      boxShadow: TeacherUiTokens.cardLift,
      gradient: dark
          ? null
          : const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFFFFFFF),
                Color(0xFFFAF8FF),
                Color(0xFFF5F3FF),
              ],
              stops: [0.0, 0.45, 1.0],
            ),
      color: dark
          ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.24)
          : null,
    );

    return DecoratedBox(
      decoration: decoration,
      child: Padding(
        padding: _kHeaderCardPadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              subject,
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.45,
                height: 1.12,
                color: _DetailBody._onSurfaceStrong(theme, dark),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '$className · $lessonDate',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: _DetailBody._mutedLabelColor(dark).withValues(
                  alpha: dark ? 0.72 : 0.88,
                ),
                height: 1.42,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Period $period · $durationMinutes min',
              style: theme.textTheme.labelLarge?.copyWith(
                color: _DetailBody._mutedLabelColor(dark),
                fontWeight: FontWeight.w600,
                letterSpacing: 0.12,
                height: 1.25,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PremiumCard extends StatelessWidget {
  const _PremiumCard({
    required this.child,
    required this.borderColor,
    this.padding = _kSectionCardPadding,
    this.backgroundColor,
  });

  final Widget child;
  final Color borderColor;
  final EdgeInsetsGeometry padding;

  /// When null, light mode uses clean white; dark uses a soft elevated surface.
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fill = backgroundColor ??
        (dark
            ? Theme.of(context)
                .colorScheme
                .surfaceContainerHighest
                .withValues(alpha: 0.22)
            : Colors.white);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(_kCardRadius),
        border: Border.all(color: borderColor),
        boxShadow: TeacherUiTokens.cardLift,
      ),
      child: Padding(
        padding: padding,
        child: child,
      ),
    );
  }
}

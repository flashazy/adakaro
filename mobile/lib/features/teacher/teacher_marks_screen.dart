import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/gradebook/gradebook_assignment_delete_guard.dart';
import '../../core/gradebook/tanzania_grades.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_enrollment.dart';
import '../../data/teacher_repository.dart';

typedef _NewAssignmentValues = ({String title, double maxScore});

/// Canonical score text for dirty/compare (shared by screen + score field).
String _marksFieldCompareKey(String raw) {
  final t = raw.trim().replaceAll(',', '.');
  if (t.isEmpty) return '';
  final v = double.tryParse(t);
  if (v == null) return raw.trim();
  if (v == v.roundToDouble()) return '${v.round()}';
  return t;
}

class TeacherMarksScreen extends StatefulWidget {
  const TeacherMarksScreen({
    super.key,
    required this.user,
    required this.data,
  });

  final User user;
  final TeacherDeskData data;

  @override
  State<TeacherMarksScreen> createState() => _TeacherMarksScreenState();
}

class _TeacherMarksScreenState extends State<TeacherMarksScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);
  final _studentSearchController = TextEditingController();

  int _assignmentIx = 0;
  TeacherGradebookAssignmentMini? _selectedGb;
  List<TeacherGradebookAssignmentMini> _gbAssignments = [];
  List<Map<String, String>> _students = [];
  final Map<String, TextEditingController> _scoreCtrls = {};
  /// Last saved score text per student (canonical for comparison).
  final Map<String, String> _baselineMarksByStudent = {};
  bool _loading = false;
  bool _saving = false;
  bool _dirty = false;
  String? _error;
  /// Which row’s score field has focus (subtle row chrome only).
  String? _focusedScoreStudentId;

  TeacherAssignmentDisplay? get _teachSel {
    final a = widget.data.assignments;
    if (a.isEmpty || _assignmentIx < 0 || _assignmentIx >= a.length) {
      return null;
    }
    return a[_assignmentIx];
  }

  void _disposeCtrls() {
    for (final c in _scoreCtrls.values) {
      c.removeListener(_syncDirtyFromScoreFields);
      c.dispose();
    }
    _scoreCtrls.clear();
    _baselineMarksByStudent.clear();
  }

  bool _computeMarksDirty() {
    if (_loading || _students.isEmpty) return false;
    for (final s in _students) {
      final id = s['id']!;
      final c = _scoreCtrls[id];
      if (c == null) return false;
      final cur = _marksFieldCompareKey(c.text);
      final base = _baselineMarksByStudent[id] ?? '';
      if (cur != base) return true;
    }
    return false;
  }

  void _syncDirtyFromScoreFields() {
    if (!mounted) return;
    // Rebuild summary (entered / missing / average) on every keystroke.
    setState(() => _dirty = _computeMarksDirty());
  }

  void _onStudentSearchChanged() {
    if (mounted) setState(() {});
  }

  String get _schoolLevel => widget.data.schoolLevel ?? 'secondary';

  /// Multi-word: every whitespace-separated token must occur in [full_name] (case-insensitive, partial).
  bool _studentMatchesSearch(Map<String, String> student) {
    final q = _studentSearchController.text.trim().toLowerCase();
    if (q.isEmpty) return true;
    final name = (student['full_name'] ?? '').toLowerCase();
    for (final t in q.split(RegExp(r'\s+')).where((e) => e.isNotEmpty)) {
      if (!name.contains(t)) return false;
    }
    return true;
  }

  List<Map<String, String>> get _visibleStudents =>
      _students.where(_studentMatchesSearch).toList();

  /// Tanzania letter from raw score; [—] when empty or not in range.
  String _letterGradeForScoreText(String raw, double maxScore) {
    final t = raw.trim();
    if (t.isEmpty || maxScore <= 0) return '—';
    final v = double.tryParse(t.replaceAll(',', '.'));
    if (v == null || v < 0 || v > maxScore) return '—';
    final pct = tanzaniaPercentFromScore(v, maxScore);
    return tanzaniaLetterGrade(pct, _schoolLevel);
  }

  /// Filled = non-empty; average uses valid in-range scores only.
  ({
    int total,
    int filled,
    int empty,
    String averageLine,
    double? averageNumeric,
  }) _marksSummaryLine() {
    final max = _selectedGb?.maxScore ?? 0;
    final total = _students.length;
    var filled = 0;
    var empty = 0;
    final inRange = <double>[];
    for (final s in _students) {
      final id = s['id']!;
      final raw = _scoreCtrls[id]?.text ?? '';
      if (raw.trim().isEmpty) {
        empty++;
        continue;
      }
      filled++;
      if (max > 0) {
        final v = double.tryParse(raw.trim().replaceAll(',', '.'));
        if (v != null && v >= 0 && v <= max) inRange.add(v);
      }
    }
    String averageLine;
    double? averageNumeric;
    if (inRange.isEmpty) {
      averageLine = '—';
    } else {
      final sum = inRange.reduce((a, b) => a + b);
      final avg = sum / inRange.length;
      averageNumeric = avg;
      final rounded = (avg * 10).round() / 10;
      averageLine = rounded == rounded.roundToDouble()
          ? '${rounded.round()}'
          : '$rounded';
    }
    return (
      total: total,
      filled: filled,
      empty: empty,
      averageLine: averageLine,
      averageNumeric: averageNumeric,
    );
  }

  /// Insight line + tone for Marks summary (average as % of assignment max only).
  ({
    String text,
    Color accentColor,
    IconData icon,
  }) _marksSummaryInsightMeta(
    ThemeData theme, {
    required double? averageNumeric,
    required double maxScore,
  }) {
    final brightness = theme.brightness;
    final cs = theme.colorScheme;

    Color softGreen() => brightness == Brightness.dark
        ? const Color(0xFF81C784).withValues(alpha: 0.9)
        : const Color(0xFF2E7D32).withValues(alpha: 0.78);

    Color softAmber() => brightness == Brightness.dark
        ? const Color(0xFFFFB74D).withValues(alpha: 0.88)
        : const Color(0xFFC67600).withValues(alpha: 0.76);

    Color softRed() =>
        cs.error.withValues(alpha: brightness == Brightness.dark ? 0.85 : 0.76);

    Color mutedGray() => AppColors.textSecondary.withValues(
          alpha: brightness == Brightness.dark ? 0.52 : 0.58,
        );

    if (maxScore <= 0 || averageNumeric == null) {
      return (
        text: 'No scores entered yet.',
        accentColor: mutedGray(),
        icon: Icons.edit_note_outlined,
      );
    }
    final pct = ((averageNumeric / maxScore) * 100).clamp(0.0, 100.0);
    if (pct >= 80) {
      return (
        text: 'Excellent class performance.',
        accentColor: softGreen(),
        icon: Icons.workspace_premium_outlined,
      );
    }
    if (pct >= 65) {
      return (
        text: 'Good overall class performance.',
        accentColor: softGreen(),
        icon: Icons.check_circle_outline_rounded,
      );
    }
    if (pct >= 50) {
      return (
        text: 'Class performance can improve.',
        accentColor: softAmber(),
        icon: Icons.trending_up_outlined,
      );
    }
    return (
      text: 'Class performance needs attention.',
      accentColor: softRed(),
      icon: Icons.flag_outlined,
    );
  }

  void _onScoreFieldFocusChanged(String studentId, bool hasFocus) {
    if (!mounted) return;
    setState(() {
      if (hasFocus) {
        _focusedScoreStudentId = studentId;
      } else if (_focusedScoreStudentId == studentId) {
        _focusedScoreStudentId = null;
      }
    });
  }

  static String _matchesWord(int n) => n == 1 ? 'match' : 'matches';

  Widget _marksSummaryCard(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final m = _marksSummaryLine();
    final maxScore = _selectedGb?.maxScore ?? 0;
    final insightMeta = _marksSummaryInsightMeta(
      theme,
      averageNumeric: m.averageNumeric,
      maxScore: maxScore,
    );

    final cardBg = dark
        ? cs.surfaceContainerHighest.withValues(alpha: 0.36)
        : Color.lerp(
            const Color(0xFFFBFBFD),
            cs.surface,
            0.045,
          )!;
    final borderC = AppColors.cardBorder.withValues(alpha: dark ? 0.48 : 0.72);

    final titleStyle = theme.textTheme.titleSmall?.copyWith(
      fontWeight: FontWeight.w800,
      color: cs.onSurface.withValues(alpha: 0.82),
      height: 1.18,
    );
    final primaryMetricLabel = theme.textTheme.labelSmall!.copyWith(
      color: AppColors.textSecondary.withValues(alpha: 0.54),
      fontWeight: FontWeight.w500,
      height: 1.1,
      fontSize: 10,
      letterSpacing: 0.15,
    );
    final secondaryMetricLabel = theme.textTheme.labelSmall!.copyWith(
      color: AppColors.textSecondary.withValues(alpha: 0.5),
      fontWeight: FontWeight.w500,
      height: 1.1,
      fontSize: 9.5,
      letterSpacing: 0.12,
    );
    final averageValueStyle = theme.textTheme.titleMedium!.copyWith(
      fontWeight: FontWeight.w800,
      fontSize: 20,
      height: 1.05,
      letterSpacing: -0.32,
      color: cs.onSurface.withValues(alpha: 0.92),
    );
    final enteredValueStyle = theme.textTheme.titleMedium!.copyWith(
      fontWeight: FontWeight.w800,
      fontSize: 17,
      height: 1.06,
      letterSpacing: -0.26,
      color: cs.onSurface.withValues(alpha: 0.86),
    );
    final secondaryValueStyle = theme.textTheme.titleSmall!.copyWith(
      fontWeight: FontWeight.w700,
      fontSize: 15,
      height: 1.05,
      letterSpacing: -0.2,
      color: cs.onSurface.withValues(alpha: 0.7),
    );

    /// Single metric block (label + value); left group [alignEnd=false] or right [true].
    Widget metricBlock({
      required String label,
      required String value,
      required TextStyle labelStyle,
      required TextStyle valueStyle,
      required double minValueHeight,
      bool alignEnd = false,
    }) {
      final valueAlign =
          alignEnd ? Alignment.centerRight : Alignment.centerLeft;
      final textAlign = alignEnd ? TextAlign.end : TextAlign.start;
      return Column(
        crossAxisAlignment:
            alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: labelStyle,
            textAlign: textAlign,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          SizedBox(
            height: minValueHeight,
            width: double.infinity,
            child: Align(
              alignment: valueAlign,
              child: AnimatedDefaultTextStyle(
                duration: _marksSoftAnim,
                curve: _marksAnimCurve,
                style: valueStyle,
                child: Text(
                  value,
                  textAlign: textAlign,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        TeacherUiTokens.horizontalPadding,
        2,
        TeacherUiTokens.horizontalPadding,
        4,
      ),
      child: AnimatedSwitcher(
        duration: _marksSoftAnim,
        switchInCurve: _marksAnimCurve,
        switchOutCurve: Curves.easeIn,
        child: KeyedSubtree(
          key: ValueKey<String>(
            '${_selectedGb?.id ?? "none"}_${_students.length}',
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderC),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: dark ? 0.18 : 0.026),
                  blurRadius: dark ? 12 : 8,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 7, 12, 7),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text('Marks summary', style: titleStyle),
                      ),
                      const SizedBox(width: 6),
                      Align(
                        alignment: Alignment.centerRight,
                        child: _marksSyncStatusPill(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Divider(
                    height: 1,
                    thickness: 0.5,
                    color: AppColors.cardBorder.withValues(alpha: 0.42),
                  ),
                  const SizedBox(height: 7),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Align(
                          alignment: Alignment.topLeft,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              metricBlock(
                                label: 'Average',
                                value: m.averageLine,
                                labelStyle: primaryMetricLabel,
                                valueStyle: averageValueStyle,
                                minValueHeight: 24,
                              ),
                              const SizedBox(height: 8),
                              metricBlock(
                                label: 'Students',
                                value: '${m.total}',
                                labelStyle: secondaryMetricLabel,
                                valueStyle: secondaryValueStyle,
                                minValueHeight: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                      Expanded(
                        child: Align(
                          alignment: Alignment.topRight,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              metricBlock(
                                label: 'Entered',
                                value: '${m.filled}',
                                labelStyle: primaryMetricLabel,
                                valueStyle: enteredValueStyle,
                                minValueHeight: 24,
                                alignEnd: true,
                              ),
                              const SizedBox(height: 8),
                              metricBlock(
                                label: 'Missing',
                                value: '${m.empty}',
                                labelStyle: secondaryMetricLabel,
                                valueStyle: m.empty == 0
                                    ? secondaryValueStyle.copyWith(
                                        color: AppColors.textSecondary
                                            .withValues(alpha: 0.38),
                                      )
                                    : secondaryValueStyle,
                                minValueHeight: 20,
                                alignEnd: true,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  AnimatedSwitcher(
                    duration: _marksSoftAnim,
                    switchInCurve: _marksAnimCurve,
                    switchOutCurve: Curves.easeIn,
                    transitionBuilder: (child, anim) => FadeTransition(
                      opacity: anim,
                      child: child,
                    ),
                    child: LayoutBuilder(
                      key: ValueKey<String>(insightMeta.text),
                      builder: (context, constraints) {
                        const iconSize = 13.0;
                        const gap = 5.0;
                        final textMax = math.max(
                          48.0,
                          constraints.maxWidth - iconSize - gap,
                        );
                        final insightStyle =
                            theme.textTheme.labelSmall?.copyWith(
                          color: insightMeta.accentColor,
                          fontWeight: FontWeight.w500,
                          height: 1.35,
                          fontSize: 10.5,
                        );
                        return Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Icon(
                              insightMeta.icon,
                              size: iconSize,
                              color: insightMeta.accentColor
                                  .withValues(alpha: 0.92),
                            ),
                            const SizedBox(width: gap),
                            ConstrainedBox(
                              constraints: BoxConstraints(maxWidth: textMax),
                              child: Text(
                                insightMeta.text,
                                textAlign: TextAlign.center,
                                style: insightStyle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  bool get _showMarksSaveFooter =>
      _selectedGb != null &&
      !_loading &&
      _students.isNotEmpty &&
      (_dirty || _saving);

  static const double _saveFooterReserve = 108;
  /// Primary motion duration (rows, pills, summary, modal, search).
  static const Duration _marksSoftAnim = Duration(milliseconds: 220);
  static const Curve _marksAnimCurve = Curves.easeOutCubic;

  InputDecoration _premiumDropdownDecoration(
    BuildContext context, {
    required String labelText,
    String? hintText,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final radius = BorderRadius.circular(14);
    final softBorder = const Color(0xFFCBD5E1).withValues(alpha: dark ? 0.36 : 0.48);
    final fill = dark
        ? cs.surfaceContainerHighest.withValues(alpha: 0.42)
        : cs.surface;
    final calmLabel = theme.textTheme.labelLarge?.copyWith(
      color: AppColors.textSecondary.withValues(alpha: 0.66),
      fontWeight: FontWeight.w500,
      fontSize: 12.5,
    );
    return InputDecoration(
      labelText: labelText,
      hintText: hintText,
      labelStyle: calmLabel,
      floatingLabelStyle: calmLabel?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.textSecondary.withValues(alpha: 0.62),
      ),
      filled: true,
      fillColor: fill,
      isDense: true,
      floatingLabelBehavior: FloatingLabelBehavior.auto,
      contentPadding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
      border: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: softBorder, width: 1),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: softBorder, width: 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(
          color: AppColors.primary.withValues(alpha: 0.4),
          width: 1.12,
        ),
      ),
    );
  }

  Widget _marksSyncStatusPill(BuildContext context) {
    final theme = Theme.of(context);
    final small = theme.textTheme.labelSmall;
    final chipText = (small ?? const TextStyle()).copyWith(
      fontSize: 10.5,
      height: 1.05,
    );
    if (_saving) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.indigoWash.withValues(alpha: 0.58),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.13),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(
                strokeWidth: 1.75,
                color: AppColors.primaryDark.withValues(alpha: 0.82),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'Saving…',
              style: chipText.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.primaryDark.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
      );
    }
    if (_dirty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7ED).withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFFFDBA74).withValues(alpha: 0.34),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(
              Icons.fiber_manual_record_rounded,
              size: 8,
              color: const Color(0xFFEA580C).withValues(alpha: 0.92),
            ),
            const SizedBox(width: 5),
            Text(
              'Unsaved changes',
              style: chipText.copyWith(
                fontWeight: FontWeight.w700,
                color: const Color(0xFFC2410C).withValues(alpha: 0.88),
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF5FBF7).withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFD1FAE5).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            Icons.check_circle_rounded,
            size: 11.5,
            color: const Color(0xFF059669).withValues(alpha: 0.58),
          ),
          const SizedBox(width: 4),
          Text(
            'All marks saved',
            style: chipText.copyWith(
              fontWeight: FontWeight.w600,
              color: const Color(0xFF047857).withValues(alpha: 0.68),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _studentSearchController.removeListener(_onStudentSearchChanged);
    _studentSearchController.dispose();
    _disposeCtrls();
    super.dispose();
  }

  Future<void> _loadAssignments() async {
    final sel = _teachSel;
    if (sel == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _repo.loadGradebookAssignments(
        teacherId: widget.user.id,
        classId: sel.classId,
        subjectLabel: sel.subjectLabel,
      );
      if (!mounted) return;
      setState(() {
        _gbAssignments = list;
        _selectedGb = list.isEmpty ? null : list.first;
        _loading = false;
      });
      await _loadRosterAndScores();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyDataLoadError(e);
        _loading = false;
        _dirty = false;
      });
    }
  }

  Future<void> _loadRosterAndScores() async {
    final teach = _teachSel;
    final gb = _selectedGb;
    if (teach == null) return;

    // Capture old controllers; clear map only after UI stops building
    // TextFields (loading replaces ListView) so we never dispose while attached.
    final oldCtrls = _scoreCtrls.values.toList(growable: false);
    setState(() {
      _scoreCtrls.clear();
      _loading = true;
      _error = null;
      _focusedScoreStudentId = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final c in oldCtrls) {
        c.removeListener(_syncDirtyFromScoreFields);
        c.dispose();
      }
    });

    try {
      final period = teacherCurrentEnrollmentPeriod();
      final ay = enrollmentYearFromAssignmentString(teach.academicYear);
      List<Map<String, String>> roster;
      roster = await teacherGetStudentsForSubject(
        Supabase.instance.client,
        classId: teach.classId,
        subjectId: teach.subjectId,
        academicYear: ay,
        term: period.term,
        enrollmentDateOnOrBefore: null,
      );

      Map<String, double?> scores = {};
      if (gb != null) {
        scores = await _repo.loadScores(assignmentId: gb.id);
      }

      final ctrls = <String, TextEditingController>{};
      for (final s in roster) {
        final id = s['id']!;
        final v = scores[id];
        final c = TextEditingController(
          text: v == null ? '' : _stripTrailingZeros(v),
        );
        c.addListener(_syncDirtyFromScoreFields);
        ctrls[id] = c;
      }

      if (!mounted) return;
      setState(() {
        _students = roster;
        _scoreCtrls.addAll(ctrls);
        _baselineMarksByStudent
          ..clear()
          ..addEntries(
            roster.map((s) {
              final id = s['id']!;
              return MapEntry(
                id,
                _marksFieldCompareKey(ctrls[id]!.text),
              );
            }),
          );
        _dirty = false;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyDataLoadError(e);
        _loading = false;
        _dirty = false;
      });
    }
  }

  String _stripTrailingZeros(double v) {
    if (v == v.roundToDouble()) return '${v.round()}';
    return v.toString();
  }

  @override
  void initState() {
    super.initState();
    _studentSearchController.addListener(_onStudentSearchChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAssignments());
  }

  void _showMarksSavedSnackBar() {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 88),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Row(
          children: [
            Icon(
              Icons.check_circle_rounded,
              color: AppColors.success.withValues(alpha: 0.95),
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Marks saved successfully',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF065F46),
                    ),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.successBg,
      ),
    );
  }

  Future<void> _saveMarks() async {
    final gb = _selectedGb;
    if (gb == null || !_dirty || _saving) return;
    setState(() => _saving = true);
    try {
      for (final s in _students) {
        final id = s['id']!;
        final raw = _scoreCtrls[id]?.text.trim() ?? '';
        double? parsed;
        if (raw.isEmpty) {
          parsed = null;
        } else {
          parsed = double.tryParse(raw.replaceAll(',', '.'));
        }
        await _repo.upsertScore(
          assignmentId: gb.id,
          studentId: id,
          score: parsed,
        );
      }
      if (!mounted) return;
      setState(() {
        for (final s in _students) {
          final id = s['id']!;
          _baselineMarksByStudent[id] =
              _marksFieldCompareKey(_scoreCtrls[id]?.text ?? '');
        }
        _dirty = false;
      });
      _showMarksSavedSnackBar();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyDataLoadError(e))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _promptNewAssignment() async {
    final teach = _teachSel;
    if (teach == null) return;

    final result = await showGeneralDialog<_NewAssignmentValues?>(
      context: context,
      barrierDismissible: true,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      barrierColor: Colors.black.withValues(alpha: 0.28),
      transitionDuration: _marksSoftAnim,
      pageBuilder: (ctx, animation, secondaryAnimation) {
        return const _NewAssignmentPremiumDialog();
      },
      transitionBuilder: (ctx, animation, secondaryAnimation, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: curved,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.04),
              end: Offset.zero,
            ).animate(curved),
            child: child,
          ),
        );
      },
    );

    if (result == null) return;

    try {
      final period = teacherCurrentEnrollmentPeriod();
      final id = await _repo.createGradebookAssignment(
        teacherId: widget.user.id,
        classId: teach.classId,
        subject: teach.subjectLabel,
        title: result.title,
        maxScore: result.maxScore,
        term: period.term,
      );
      if (id != null && mounted) {
        await _loadAssignments();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDataLoadError(e))),
        );
      }
    }
  }

  String _gradebookAssignmentLine(TeacherGradebookAssignmentMini g) {
    final m = g.maxScore;
    final frac = m == m.roundToDouble() ? 0 : 2;
    return '${g.title} (/${m.toStringAsFixed(frac)})';
  }

  String _gradebookMaxScoreLabel(TeacherGradebookAssignmentMini g) {
    final m = g.maxScore;
    final frac = m == m.roundToDouble() ? 0 : 2;
    return 'Max score · ${m.toStringAsFixed(frac)}';
  }

  Future<void> _openAssignmentPickerSheet() async {
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        final theme = Theme.of(sheetCtx);
        final cs = theme.colorScheme;
        final dark = theme.brightness == Brightness.dark;
        final h = MediaQuery.sizeOf(sheetCtx).height;
        final bottomInset = MediaQuery.viewInsetsOf(sheetCtx).bottom;
        final sheetBg = dark
            ? Color.lerp(
                cs.surfaceContainerHighest,
                cs.surface,
                0.35,
              )!
            : Color.lerp(
                const Color(0xFFFBFBFD),
                cs.surface,
                0.06,
              )!;
        final tileIdleBg = dark
            ? cs.surfaceContainerHighest.withValues(alpha: 0.28)
            : Colors.white.withValues(alpha: 0.72);
        final tileBorder = AppColors.cardBorder.withValues(alpha: dark ? 0.38 : 0.55);
        final tileSelectedBg = dark
            ? AppColors.indigoWash.withValues(alpha: 0.26)
            : AppColors.indigoWash.withValues(alpha: 0.18);
        final tileSelectedBorder =
            AppColors.primary.withValues(alpha: dark ? 0.42 : 0.28);

        // Explicit height: Center + maxHeight-only ConstrainedBox can collapse
        // Column → Expanded to zero, hiding the list and empty state.
        final w = MediaQuery.sizeOf(sheetCtx).width;
        final sheetWidth = math.min(520.0, w);
        final sheetHeight =
            math.min(h * 0.62, math.max(300.0, h * 0.46)).toDouble();

        return Padding(
          padding: EdgeInsets.only(bottom: bottomInset),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: SizedBox(
              width: sheetWidth,
              height: sheetHeight,
              child: Material(
                color: sheetBg,
                elevation: 12,
                shadowColor: Colors.black.withValues(alpha: 0.12),
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(22)),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 8),
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.textSecondary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 6, 0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Select assignment',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                    height: 1.15,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  'Choose the assignment you want to enter scores for.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: AppColors.textSecondary
                                        .withValues(alpha: 0.78),
                                    height: 1.38,
                                    fontWeight: FontWeight.w500,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            onPressed: () => Navigator.of(sheetCtx).pop(),
                            icon: Icon(
                              Icons.close_rounded,
                              color: AppColors.textSecondary.withValues(alpha: 0.7),
                            ),
                            tooltip: 'Close',
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                      child: Divider(
                        height: 1,
                        thickness: 0.5,
                        color: AppColors.cardBorder.withValues(alpha: 0.42),
                      ),
                    ),
                    Expanded(
                      child: _gbAssignments.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.fromLTRB(
                                28,
                                8,
                                28,
                                28,
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.assignment_outlined,
                                    size: 40,
                                    color: AppColors.textSecondary
                                        .withValues(alpha: 0.35),
                                  ),
                                  const SizedBox(height: 14),
                                  Text(
                                    'No assignments yet',
                                    textAlign: TextAlign.center,
                                    style: theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.15,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Create one using the + button.',
                                    textAlign: TextAlign.center,
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: AppColors.textSecondary
                                          .withValues(alpha: 0.72),
                                      height: 1.4,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(
                                16,
                                4,
                                16,
                                18,
                              ),
                              itemCount: _gbAssignments.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 10),
                              itemBuilder: (_, i) {
                                final g = _gbAssignments[i];
                                final selected = _selectedGb?.id == g.id;
                                final canDelete =
                                    isTeacherGradebookAssignmentDeletable(
                                  title: g.title,
                                  examType: g.examType,
                                );
                                return DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: selected ? tileSelectedBg : tileIdleBg,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: selected
                                          ? tileSelectedBorder
                                          : tileBorder,
                                      width: selected ? 1.05 : 1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(
                                          alpha: dark ? 0.12 : 0.04,
                                        ),
                                        blurRadius: dark ? 8 : 6,
                                        offset: const Offset(0, 1),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      Expanded(
                                        child: InkWell(
                                          borderRadius:
                                              BorderRadius.circular(13),
                                          onTap: () {
                                            Navigator.of(sheetCtx).pop();
                                            setState(() => _selectedGb = g);
                                            _loadRosterAndScores();
                                          },
                                          child: Padding(
                                            padding: const EdgeInsets.fromLTRB(
                                              14,
                                              13,
                                              8,
                                              13,
                                            ),
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Row(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        g.title,
                                                        maxLines: 2,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                        style: theme.textTheme
                                                            .bodyLarge
                                                            ?.copyWith(
                                                          fontWeight:
                                                              FontWeight.w800,
                                                          height: 1.22,
                                                          fontSize: 15,
                                                          letterSpacing: -0.2,
                                                        ),
                                                      ),
                                                    ),
                                                    if (!canDelete) ...[
                                                      const SizedBox(width: 8),
                                                      Container(
                                                        padding:
                                                            const EdgeInsets
                                                                .symmetric(
                                                          horizontal: 7,
                                                          vertical: 3,
                                                        ),
                                                        decoration:
                                                            BoxDecoration(
                                                          color: AppColors
                                                              .textSecondary
                                                              .withValues(
                                                            alpha: dark
                                                                ? 0.14
                                                                : 0.1,
                                                          ),
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(8),
                                                        ),
                                                        child: Text(
                                                          'Official',
                                                          style: theme.textTheme
                                                              .labelSmall
                                                              ?.copyWith(
                                                            fontSize: 9.5,
                                                            fontWeight:
                                                                FontWeight.w700,
                                                            letterSpacing: 0.2,
                                                            color: AppColors
                                                                .textSecondary
                                                                .withValues(
                                                              alpha: 0.72,
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                                const SizedBox(height: 5),
                                                Text(
                                                  _gradebookMaxScoreLabel(g),
                                                  style: theme.textTheme
                                                      .labelSmall
                                                      ?.copyWith(
                                                    color: AppColors
                                                        .textSecondary
                                                        .withValues(alpha: 0.68),
                                                    fontWeight: FontWeight.w600,
                                                    fontSize: 11.5,
                                                    height: 1.2,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                      if (canDelete)
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            right: 4,
                                            top: 4,
                                            bottom: 4,
                                          ),
                                          child: Material(
                                            color: Colors.transparent,
                                            child: InkWell(
                                              onTap: () async {
                                                Navigator.of(sheetCtx).pop();
                                                await Future<void>.delayed(
                                                  Duration.zero,
                                                );
                                                if (!mounted) return;
                                                await _handleDeleteGradebookAssignment(
                                                  g,
                                                );
                                              },
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                              child: Tooltip(
                                                message: 'Delete',
                                                child: Padding(
                                                  padding:
                                                      const EdgeInsets.all(10),
                                                  child: Icon(
                                                    Icons
                                                        .delete_outline_rounded,
                                                    size: 20,
                                                    color: cs.error.withValues(
                                                      alpha: 0.52,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleDeleteGradebookAssignment(
    TeacherGradebookAssignmentMini g,
  ) async {
    if (!isTeacherGradebookAssignmentDeletable(
      title: g.title,
      examType: g.examType,
    )) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withValues(alpha: 0.32),
      builder: (dialogCtx) => const _DeleteGradebookAssignmentConfirmDialog(),
    );
    if (confirmed != true || !mounted) return;
    try {
      final err = await _repo.deleteGradebookAssignment(g.id);
      if (!mounted) return;
      if (err != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err)),
        );
        return;
      }
      final oldIdx = _gbAssignments.indexWhere((e) => e.id == g.id);
      final wasSelected = _selectedGb?.id == g.id;
      setState(() {
        _gbAssignments.removeWhere((e) => e.id == g.id);
        if (wasSelected) {
          if (_gbAssignments.isEmpty) {
            _selectedGb = null;
          } else {
            final newIdx = oldIdx >= _gbAssignments.length
                ? _gbAssignments.length - 1
                : oldIdx;
            _selectedGb = _gbAssignments[
                newIdx.clamp(0, _gbAssignments.length - 1)];
          }
        }
      });
      await _loadRosterAndScores();
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      messenger.hideCurrentSnackBar();
      messenger.showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 88),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          content: Text(
            'Assignment deleted',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDataLoadError(e))),
        );
      }
    }
  }

  /// Subtle performance wash from score / max (high / mid / low — no rainbow).
  Color _marksGradeRowTint(
    BuildContext context,
    String raw,
    double maxScore,
  ) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final neutral = dark
        ? const Color(0xFF2A2D32).withValues(alpha: 0.26)
        : const Color(0xFFF7F8FA);

    final t = raw.trim();
    if (t.isEmpty || maxScore <= 0) return neutral;
    final v = double.tryParse(t.replaceAll(',', '.'));
    if (v == null || v < 0 || v > maxScore) return neutral;

    final ratio = (v / maxScore).clamp(0.0, 1.0);
    final Color mist;
    if (ratio >= 0.72) {
      mist = const Color(0xFF059669);
    } else if (ratio >= 0.4) {
      mist = const Color(0xFFD97706);
    } else {
      mist = const Color(0xFFDC2626);
    }
    final mix = dark ? 0.082 : 0.055;
    return Color.lerp(neutral, mist, mix)!;
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.data.hasTeachingAssignments ||
        widget.data.assignments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Marks open when your school assigns you to a class.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
          ),
        ),
      );
    }

    final assigns = widget.data.assignments;
    final headerDark = Theme.of(context).brightness == Brightness.dark;
    final mq = MediaQuery.of(context);
    final viewInsets = mq.viewInsets;
    final listBottomPad =
        (_showMarksSaveFooter ? _saveFooterReserve : 20) + viewInsets.bottom;
    // Extra room so focused score scrolls above keyboard + save bar.
    final scoreScrollPad = viewInsets.bottom +
        mq.padding.bottom +
        (_showMarksSaveFooter ? _saveFooterReserve : 0) +
        120;
    final searchScrollPad = listBottomPad + 96;
    final visibleStudents = _visibleStudents;
    final searchQuery = _studentSearchController.text.trim();
    final searchActive = searchQuery.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            6,
            TeacherUiTokens.horizontalPadding,
            0,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Enter scores',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.2,
                            height: 1.12,
                          ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      'Marks',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.textSecondary
                                .withValues(alpha: 0.55),
                            fontWeight: FontWeight.w500,
                            fontSize: 11.5,
                            letterSpacing: 0.12,
                            height: 1.2,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              Tooltip(
                message: 'New assignment',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                    child: Material(
                      color: headerDark
                          ? const Color(0xFF312E81).withValues(alpha: 0.32)
                          : Colors.white.withValues(alpha: 0.14),
                      shadowColor: Colors.transparent,
                      child: InkWell(
                        onTap: _promptNewAssignment,
                        borderRadius: BorderRadius.circular(11),
                        splashColor: AppColors.primary.withValues(alpha: 0.1),
                        highlightColor:
                            AppColors.primary.withValues(alpha: 0.05),
                        child: Ink(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(11),
                            border: Border.all(
                              color: AppColors.primary.withValues(
                                alpha: headerDark ? 0.16 : 0.1,
                              ),
                            ),
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: headerDark
                                  ? [
                                      const Color(0xFF3730A3)
                                          .withValues(alpha: 0.38),
                                      Colors.white.withValues(alpha: 0.05),
                                      const Color(0xFF4F46E5)
                                          .withValues(alpha: 0.28),
                                    ]
                                  : [
                                      AppColors.indigoWash
                                          .withValues(alpha: 0.4),
                                      Colors.white.withValues(alpha: 0.16),
                                      AppColors.indigoWash
                                          .withValues(alpha: 0.26),
                                    ],
                            ),
                          ),
                          child: Center(
                            child: Icon(
                              Icons.add_rounded,
                              size: 20,
                              color: AppColors.primaryDark
                                  .withValues(alpha: 0.88),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            4,
            TeacherUiTokens.horizontalPadding,
            0,
          ),
          child: Text(
            'Record assignment scores for your class.',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.textSecondary.withValues(alpha: 0.58),
                  height: 1.32,
                  fontWeight: FontWeight.w500,
                  fontSize: 12,
                ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            4,
            TeacherUiTokens.horizontalPadding,
            0,
          ),
          child: Theme(
            data: Theme.of(context).copyWith(
              splashColor: AppColors.primary.withValues(alpha: 0.07),
              highlightColor: AppColors.indigoWash.withValues(alpha: 0.34),
              hoverColor: AppColors.indigoWash.withValues(alpha: 0.28),
            ),
            child: DropdownButtonFormField<int>(
              borderRadius: BorderRadius.circular(12),
              dropdownColor: Theme.of(context).colorScheme.surface,
              menuMaxHeight: 320,
              value: _assignmentIx.clamp(0, assigns.length - 1),
              decoration: _premiumDropdownDecoration(
                context,
                labelText: 'Class & subject',
              ),
              items: [
                for (var i = 0; i < assigns.length; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text(
                      '${assigns[i].className} · ${assigns[i].subjectLabel}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _assignmentIx = v);
                _loadAssignments();
              },
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            4,
            TeacherUiTokens.horizontalPadding,
            0,
          ),
          child: Theme(
            data: Theme.of(context).copyWith(
              splashColor: AppColors.primary.withValues(alpha: 0.07),
              highlightColor: AppColors.indigoWash.withValues(alpha: 0.34),
              hoverColor: AppColors.indigoWash.withValues(alpha: 0.28),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: _loading ? null : () => _openAssignmentPickerSheet(),
                child: InputDecorator(
                  decoration: _premiumDropdownDecoration(
                    context,
                    labelText: 'Assignment',
                    hintText: 'Pick an assignment',
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _selectedGb == null
                              ? 'Pick an assignment'
                              : _gradebookAssignmentLine(_selectedGb!),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w500,
                                fontSize: 14,
                                color: _selectedGb == null
                                    ? AppColors.textSecondary
                                        .withValues(alpha: 0.45)
                                    : Theme.of(context)
                                        .colorScheme
                                        .onSurface
                                        .withValues(alpha: 0.9),
                              ),
                        ),
                      ),
                      Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: AppColors.textSecondary.withValues(alpha: 0.55),
                        size: 22,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        if (_selectedGb != null && !_loading && _students.isNotEmpty)
          _marksSummaryCard(context),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: TeacherUiTokens.horizontalPadding,
            ),
            child: Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _selectedGb == null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'Create or select an assignment.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: AppColors.textSecondary,
                                height: 1.4,
                              ),
                        ),
                      ),
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_students.isNotEmpty) ...[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(
                              TeacherUiTokens.horizontalPadding,
                              2,
                              TeacherUiTokens.horizontalPadding,
                              0,
                            ),
                            child: TextField(
                              controller: _studentSearchController,
                              textInputAction: TextInputAction.search,
                              style: Theme.of(context).textTheme.bodyMedium,
                              scrollPadding:
                                  EdgeInsets.only(bottom: searchScrollPad),
                              decoration: InputDecoration(
                                hintText: 'Find student',
                                hintStyle: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      fontSize: 13,
                                      color: AppColors.textSecondary
                                          .withValues(alpha: 0.48),
                                      fontWeight: FontWeight.w500,
                                    ),
                                isDense: true,
                                filled: true,
                                fillColor:
                                    Theme.of(context).colorScheme.surface,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 11,
                                ),
                                prefixIcon: Icon(
                                  Icons.search_rounded,
                                  color: AppColors.textSecondary
                                      .withValues(alpha: 0.48),
                                  size: 21,
                                ),
                                suffixIcon: searchActive
                                    ? IconButton(
                                        tooltip: 'Clear',
                                        icon: Icon(
                                          Icons.close_rounded,
                                          color: AppColors.textSecondary
                                              .withValues(alpha: 0.58),
                                        ),
                                        onPressed: () {
                                          _studentSearchController.clear();
                                        },
                                      )
                                    : null,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: BorderSide(
                                    color: const Color(0xFFCBD5E1)
                                        .withValues(alpha: 0.55),
                                    width: 1,
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: BorderSide(
                                    color: const Color(0xFFCBD5E1)
                                        .withValues(alpha: 0.55),
                                    width: 1,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: BorderSide(
                                    color: AppColors.primary
                                        .withValues(alpha: 0.38),
                                    width: 1,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          if (searchActive)
                            Padding(
                              padding: const EdgeInsets.only(
                                top: 5,
                                right: TeacherUiTokens.horizontalPadding,
                              ),
                              child: Align(
                                alignment: Alignment.centerRight,
                                child: Text(
                                  '${visibleStudents.length} ${_matchesWord(visibleStudents.length)}',
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelSmall
                                      ?.copyWith(
                                        fontSize: 11,
                                        color: AppColors.textSecondary
                                            .withValues(alpha: 0.62),
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: 0.1,
                                      ),
                                ),
                              ),
                            ),
                        ],
                        Expanded(
                          child: _students.isEmpty
                              ? const SizedBox.shrink()
                              : AnimatedSwitcher(
                                  duration: _marksSoftAnim,
                                  switchInCurve: _marksAnimCurve,
                                  switchOutCurve: Curves.easeIn,
                                  transitionBuilder: (child, anim) {
                                    return FadeTransition(
                                      opacity: anim,
                                      child: SlideTransition(
                                        position: Tween<Offset>(
                                          begin: const Offset(0, 0.018),
                                          end: Offset.zero,
                                        ).animate(
                                          CurvedAnimation(
                                            parent: anim,
                                            curve: Curves.easeOutCubic,
                                          ),
                                        ),
                                        child: child,
                                      ),
                                    );
                                  },
                                  child: searchActive &&
                                          visibleStudents.isEmpty
                                      ? Center(
                                          key: const ValueKey(
                                            'marks-search-empty',
                                          ),
                                          child: Padding(
                                            padding: const EdgeInsets.all(28),
                                            child: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Text(
                                                  'No matching student',
                                                  textAlign: TextAlign.center,
                                                  style: Theme.of(context)
                                                      .textTheme
                                                      .titleSmall
                                                      ?.copyWith(
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        color: AppColors
                                                            .textSecondary
                                                            .withValues(
                                                                alpha: 0.72),
                                                      ),
                                                ),
                                                const SizedBox(height: 8),
                                                Text(
                                                  'Try another name',
                                                  textAlign: TextAlign.center,
                                                  style: Theme.of(context)
                                                      .textTheme
                                                      .bodySmall
                                                      ?.copyWith(
                                                        color: AppColors
                                                            .textSecondary
                                                            .withValues(
                                                                alpha: 0.52),
                                                        fontWeight:
                                                            FontWeight.w500,
                                                        height: 1.35,
                                                      ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        )
                                      : ListView.separated(
                                          key: const ValueKey(
                                            'marks-student-list',
                                          ),
                                          keyboardDismissBehavior:
                                              ScrollViewKeyboardDismissBehavior
                                                  .onDrag,
                                          padding: EdgeInsets.fromLTRB(
                                            TeacherUiTokens.horizontalPadding,
                                            3,
                                            TeacherUiTokens.horizontalPadding,
                                            listBottomPad,
                                          ),
                                          itemBuilder: (_, i) {
                                            final s = visibleStudents[i];
                                            final sid = s['id']!;
                                            final maxScore =
                                                _selectedGb!.maxScore;
                                            final ctrl = _scoreCtrls[sid]!;
                                            final isRowFocused =
                                                _focusedScoreStudentId == sid;
                                            final rowColor =
                                                _marksGradeRowTint(
                                              context,
                                              ctrl.text,
                                              maxScore,
                                            );
                                            final letter =
                                                _letterGradeForScoreText(
                                              ctrl.text,
                                              maxScore,
                                            );
                                            return AnimatedContainer(
                                              duration: _marksSoftAnim,
                                              curve: _marksAnimCurve,
                                              decoration: BoxDecoration(
                                                color: rowColor,
                                                borderRadius:
                                                    BorderRadius.circular(14),
                                                border: Border.all(
                                                  color: isRowFocused
                                                      ? AppColors.primary
                                                          .withValues(
                                                              alpha: 0.42,
                                                          )
                                                      : AppColors.cardBorder
                                                          .withValues(
                                                              alpha: 0.88,
                                                          ),
                                                  width: isRowFocused
                                                      ? 1.22
                                                      : 1,
                                                ),
                                                boxShadow: [
                                                  if (isRowFocused) ...[
                                                    BoxShadow(
                                                      color: AppColors.primary
                                                          .withValues(
                                                              alpha: 0.13,
                                                          ),
                                                      blurRadius: 18,
                                                      offset:
                                                          const Offset(0, 3),
                                                    ),
                                                    BoxShadow(
                                                      color: Colors.black
                                                          .withValues(
                                                              alpha: 0.04,
                                                          ),
                                                      blurRadius: 8,
                                                      offset:
                                                          const Offset(0, 4),
                                                    ),
                                                  ] else
                                                    BoxShadow(
                                                      color: Colors.black
                                                          .withValues(
                                                              alpha: 0.024,
                                                          ),
                                                      blurRadius: 4,
                                                      offset:
                                                          const Offset(0, 1),
                                                    ),
                                                ],
                                              ),
                                              clipBehavior: Clip.antiAlias,
                                              child: Padding(
                                                padding:
                                                    const EdgeInsets.fromLTRB(
                                                  16,
                                                  9,
                                                  11,
                                                  9,
                                                ),
                                                child: Row(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment
                                                          .center,
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        s['full_name'] ??
                                                            'Student',
                                                        maxLines: 2,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                        softWrap: true,
                                                        style: const TextStyle(
                                                          fontWeight:
                                                              FontWeight.w700,
                                                          fontSize: 15,
                                                          height: 1.25,
                                                        ),
                                                      ),
                                                    ),
                                                    const SizedBox(width: 8),
                                                    Row(
                                                      mainAxisSize:
                                                          MainAxisSize.min,
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .center,
                                                      children: [
                                                        SizedBox(
                                                          width: 76,
                                                          child:
                                                              _PremiumMarkScoreField(
                                                            controller: ctrl,
                                                            maxScore: maxScore,
                                                            baselineCompareKey:
                                                                _baselineMarksByStudent[sid] ??
                                                                    '',
                                                            scrollPaddingBottom:
                                                                scoreScrollPad,
                                                            onFocusChanged:
                                                                (has) =>
                                                                    _onScoreFieldFocusChanged(
                                                              sid,
                                                              has,
                                                            ),
                                                            emphasizeFocus:
                                                                isRowFocused,
                                                          ),
                                                        ),
                                                        _MarksGradePillSlot(
                                                          letter: letter,
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            );
                                          },
                                          separatorBuilder: (_, __) => Padding(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 6),
                                            child: Column(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                const SizedBox(height: 1),
                                                Divider(
                                                  height: 1,
                                                  thickness: 0.5,
                                                  color: AppColors.cardBorder
                                                      .withValues(alpha: 0.22),
                                                ),
                                                const SizedBox(height: 3),
                                              ],
                                            ),
                                          ),
                                          itemCount: visibleStudents.length,
                                        ),
                                ),
                        ),
                      ],
                    ),
        ),
        if (_showMarksSaveFooter)
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                TeacherUiTokens.horizontalPadding,
                8,
                TeacherUiTokens.horizontalPadding,
                10,
              ),
              child: FilledButton.icon(
                onPressed: (_saving || !_dirty) ? null : _saveMarks,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: _saving
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Theme.of(context).colorScheme.onPrimary,
                        ),
                      )
                    : const Icon(Icons.save_rounded),
                label: Text(_saving ? 'Saving…' : 'Save marks'),
              ),
            ),
          ),
      ],
    );
  }
}

/// Shows grade pill only for valid scores; animates width and letter changes.
class _MarksGradePillSlot extends StatelessWidget {
  const _MarksGradePillSlot({required this.letter});

  final String letter;

  bool get _show {
    final t = letter.trim();
    return t.isNotEmpty && t != '—';
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      alignment: Alignment.centerLeft,
      child: _show
          ? Padding(
              padding: const EdgeInsets.only(left: 5),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, anim) {
                  return FadeTransition(
                    opacity: anim,
                    child: ScaleTransition(
                      scale: Tween<double>(begin: 0.92, end: 1).animate(
                        CurvedAnimation(
                          parent: anim,
                          curve: Curves.easeOutCubic,
                        ),
                      ),
                      child: child,
                    ),
                  );
                },
                child: SizedBox(
                  width: 29,
                  key: ValueKey<String>(letter.trim()),
                  child: _MarksLetterBadge(letter: letter),
                ),
              ),
            )
          : const SizedBox(width: 0, height: 0),
    );
  }
}

/// Letter grade from [tanzaniaLetterGrade]; muted em dash when no valid score.
class _MarksLetterBadge extends StatelessWidget {
  const _MarksLetterBadge({required this.letter});

  final String letter;

  static ({Color bg, Color fg, Color border}) _paletteFor(String g, bool dark) {
    Color softenBg(Color base) => Color.lerp(
          base,
          dark ? const Color(0xFF0F172A) : Colors.white,
          dark ? 0.22 : 0.38,
        )!;
    if (g == '—' || g.isEmpty) {
      return (
        bg: softenBg(
          dark
              ? const Color(0xFF334155).withValues(alpha: 0.35)
              : const Color(0xFFEEF2F6),
        ),
        fg: AppColors.textSecondary.withValues(alpha: dark ? 0.65 : 0.54),
        border: AppColors.cardBorder.withValues(alpha: dark ? 0.48 : 0.72),
      );
    }
    switch (g) {
      case 'A':
        return (
          bg: softenBg(const Color(0xFFD1FAE5).withValues(alpha: dark ? 0.4 : 0.55)),
          fg: const Color(0xFF047857).withValues(alpha: dark ? 0.88 : 0.92),
          border: const Color(0xFF6EE7B7).withValues(alpha: dark ? 0.42 : 0.58),
        );
      case 'B':
        return (
          bg: softenBg(const Color(0xFFDBEAFE).withValues(alpha: dark ? 0.38 : 0.52)),
          fg: const Color(0xFF1D4ED8).withValues(alpha: dark ? 0.86 : 0.9),
          border: const Color(0xFF93C5FD).withValues(alpha: dark ? 0.42 : 0.58),
        );
      case 'C':
        return (
          bg: softenBg(const Color(0xFFFEF3C7).withValues(alpha: dark ? 0.36 : 0.5)),
          fg: const Color(0xFFB45309).withValues(alpha: dark ? 0.86 : 0.9),
          border: const Color(0xFFFBBF24).withValues(alpha: dark ? 0.4 : 0.55),
        );
      case 'D':
        return (
          bg: softenBg(const Color(0xFFFFEDD5).withValues(alpha: dark ? 0.36 : 0.5)),
          fg: const Color(0xFFC2410C).withValues(alpha: dark ? 0.86 : 0.9),
          border: const Color(0xFFFDBA74).withValues(alpha: dark ? 0.42 : 0.58),
        );
      case 'E':
      case 'F':
        return (
          bg: softenBg(const Color(0xFFFEE2E2).withValues(alpha: dark ? 0.38 : 0.52)),
          fg: const Color(0xFFB91C1C).withValues(alpha: dark ? 0.86 : 0.9),
          border: const Color(0xFFF87171).withValues(alpha: dark ? 0.4 : 0.56),
        );
      default:
        return (
          bg: softenBg(
            dark
                ? const Color(0xFF334155).withValues(alpha: 0.35)
                : const Color(0xFFEEF2F6),
          ),
          fg: AppColors.textSecondary.withValues(alpha: dark ? 0.65 : 0.54),
          border: AppColors.cardBorder.withValues(alpha: dark ? 0.48 : 0.72),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final display = letter.trim().isEmpty ? '—' : letter.trim();
    final p = _paletteFor(display, dark);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 5),
      decoration: BoxDecoration(
        color: p.bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: p.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.white.withValues(alpha: dark ? 0.04 : 0.48),
            blurRadius: 0,
            offset: const Offset(0, -0.5),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        display,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          height: 1,
          color: p.fg,
          letterSpacing: -0.1,
        ),
      ),
    );
  }
}

/// Premium score box with calm invalid styling (does not alter save parsing).
class _PremiumMarkScoreField extends StatefulWidget {
  const _PremiumMarkScoreField({
    required this.controller,
    required this.maxScore,
    required this.baselineCompareKey,
    required this.scrollPaddingBottom,
    this.onFocusChanged,
    this.emphasizeFocus = false,
  });

  final TextEditingController controller;
  final double maxScore;
  final String baselineCompareKey;
  final double scrollPaddingBottom;
  final ValueChanged<bool>? onFocusChanged;
  /// Row is the active editing row (stronger focus ring on the input).
  final bool emphasizeFocus;

  @override
  State<_PremiumMarkScoreField> createState() => _PremiumMarkScoreFieldState();
}

class _PremiumMarkScoreFieldState extends State<_PremiumMarkScoreField> {
  late final FocusNode _focusNode;

  void _onText() {
    if (mounted) setState(() {});
  }

  void _onFocus() {
    widget.onFocusChanged?.call(_focusNode.hasFocus);
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    _focusNode = FocusNode()..addListener(_onFocus);
    widget.controller.addListener(_onText);
  }

  @override
  void didUpdateWidget(covariant _PremiumMarkScoreField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onText);
      widget.controller.addListener(_onText);
    }
    if (oldWidget.baselineCompareKey != widget.baselineCompareKey) {
      // Saved baseline updated — refresh border tint.
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onText);
    _focusNode.removeListener(_onFocus);
    _focusNode.dispose();
    super.dispose();
  }

  bool _scoreHasError(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return false;
    final v = double.tryParse(t.replaceAll(',', '.'));
    if (v == null) return true;
    if (v < 0 || v > widget.maxScore) return true;
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final hasError = _scoreHasError(widget.controller.text);
    final fieldDirty = _marksFieldCompareKey(widget.controller.text) !=
        widget.baselineCompareKey;
    final radius = BorderRadius.circular(12);
    final soft = const Color(0xFFCBD5E1).withValues(alpha: dark ? 0.4 : 0.52);
    final calmError = const Color(0xFFDC2626).withValues(alpha: 0.38);
    final purpleSoft = AppColors.primary.withValues(alpha: 0.26);
    final purpleFocus = AppColors.primary.withValues(alpha: 0.5);
    final purpleGlowFocused = AppColors.primary.withValues(alpha: 0.52);
    final isFocused = _focusNode.hasFocus;

    final Color borderIdle;
    final Color borderFocused;
    if (hasError) {
      borderIdle = calmError;
      borderFocused = const Color(0xFFDC2626).withValues(alpha: 0.55);
    } else if (fieldDirty) {
      borderIdle = purpleSoft;
      borderFocused = isFocused ? purpleGlowFocused : purpleFocus;
    } else {
      borderIdle = soft;
      borderFocused = isFocused ? purpleGlowFocused : purpleFocus;
    }

    final fillLight = Color.lerp(
      const Color(0xFFFDFDFE),
      AppColors.indigoWash.withValues(alpha: 0.22),
      isFocused ? 0.26 : 0.12,
    )!;

    final shadows = <BoxShadow>[
      BoxShadow(
        color: Colors.black.withValues(alpha: dark ? 0.14 : 0.038),
        blurRadius: isFocused ? 2 : 2.5,
        offset: const Offset(0, 1.25),
      ),
    ];
    if (isFocused && !hasError) {
      final glow = widget.emphasizeFocus && isFocused;
      shadows.add(
        BoxShadow(
          color: AppColors.primary.withValues(
            alpha: glow
                ? (fieldDirty ? 0.13 : 0.1)
                : (fieldDirty ? 0.1 : 0.07),
          ),
          blurRadius: glow ? (fieldDirty ? 12 : 10) : (fieldDirty ? 9 : 7),
          spreadRadius: 0,
          offset: Offset.zero,
        ),
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: shadows,
      ),
      child: TextField(
        focusNode: _focusNode,
        controller: widget.controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        textAlign: TextAlign.center,
        textAlignVertical: TextAlignVertical.center,
        scrollPadding: EdgeInsets.only(bottom: widget.scrollPaddingBottom),
        style: theme.textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w700,
          height: 1.05,
        ),
        strutStyle: StrutStyle(
          fontSize: theme.textTheme.titleSmall?.fontSize ?? 16,
          height: 1.05,
          leadingDistribution: TextLeadingDistribution.even,
          forceStrutHeight: true,
        ),
        decoration: InputDecoration(
          hintText: '—',
          isDense: true,
          filled: true,
          fillColor: dark
              ? Color.lerp(
                  cs.surfaceContainerHighest.withValues(alpha: 0.38),
                  AppColors.primary.withValues(alpha: 0.08),
                  isFocused ? 0.36 : 0.2,
                )!
              : fillLight,
          contentPadding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
          border: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(
              color: borderIdle,
              width: fieldDirty && !hasError ? 1.05 : 1,
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(
              color: borderIdle,
              width: fieldDirty && !hasError ? 1.05 : 1,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(
              color: borderFocused,
              width: hasError ? 1.1 : (fieldDirty ? 1.22 : 1.14),
            ),
          ),
        ),
      ),
    );
  }
}

class _NewAssignmentPremiumDialog extends StatefulWidget {
  const _NewAssignmentPremiumDialog();

  @override
  State<_NewAssignmentPremiumDialog> createState() =>
      _NewAssignmentPremiumDialogState();
}

class _NewAssignmentPremiumDialogState extends State<_NewAssignmentPremiumDialog> {
  final _titleCtrl = TextEditingController();
  final _maxCtrl = TextEditingController(text: '100');
  String? _titleError;
  String? _maxError;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _maxCtrl.dispose();
    super.dispose();
  }

  InputDecoration _fieldDecoration(
    BuildContext context, {
    required String labelText,
    String? errorText,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final radius = BorderRadius.circular(14);
    final soft = const Color(0xFFCBD5E1).withValues(alpha: dark ? 0.4 : 0.55);
    final err = theme.colorScheme.error.withValues(alpha: 0.45);
    return InputDecoration(
      labelText: labelText,
      errorText: errorText,
      errorMaxLines: 2,
      filled: true,
      fillColor: dark
          ? cs.surfaceContainerHighest.withValues(alpha: 0.4)
          : const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      border: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(color: soft, width: 1),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(
          color: errorText != null ? err : soft,
          width: 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(
          color: errorText != null
              ? theme.colorScheme.error.withValues(alpha: 0.55)
              : AppColors.primary.withValues(alpha: 0.45),
          width: 1.2,
        ),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: radius,
        borderSide: BorderSide(
          color: theme.colorScheme.error.withValues(alpha: 0.55),
          width: 1.2,
        ),
      ),
    );
  }

  void _tryCreate() {
    setState(() {
      _titleError = null;
      _maxError = null;
    });
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      setState(() {
        _titleError = 'Assignment title is required.';
      });
      return;
    }
    final mxRaw = _maxCtrl.text.trim().replaceAll(',', '.');
    final mx = double.tryParse(mxRaw);
    if (mxRaw.isEmpty || mx == null || mx <= 0 || !mx.isFinite) {
      setState(() {
        _maxError = 'Enter a valid max score.';
      });
      return;
    }
    Navigator.of(context).pop((title: title, maxScore: mx));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final keyboardOpen = bottomInset > 0;

    const innerPad = EdgeInsets.fromLTRB(22, 22, 22, 20);
    const fieldScrollPad =
        EdgeInsets.only(left: 0, right: 0, top: 72, bottom: 120);

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Dialog(
        insetPadding: EdgeInsets.symmetric(
          horizontal: 22,
          vertical: keyboardOpen ? 12 : 28,
        ),
        alignment: keyboardOpen ? Alignment.topCenter : Alignment.center,
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Material(
          color: cs.surface,
          elevation: 10,
          shadowColor: Colors.black.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(24),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: innerPad,
            child: ListView(
              shrinkWrap: true,
              physics: const ClampingScrollPhysics(),
              padding: EdgeInsets.zero,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'New assignment',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Create a score column for this class.',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary
                                  .withValues(alpha: 0.88),
                              height: 1.4,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                        minWidth: 40,
                        minHeight: 40,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                      icon: Icon(
                        Icons.close_rounded,
                        color: AppColors.textSecondary.withValues(alpha: 0.75),
                      ),
                      tooltip: 'Close',
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: _titleCtrl,
                  textInputAction: TextInputAction.next,
                  scrollPadding: fieldScrollPad,
                  onSubmitted: (_) => _tryCreate(),
                  decoration: _fieldDecoration(
                    context,
                    labelText: 'Title',
                    errorText: _titleError,
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _maxCtrl,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  scrollPadding: fieldScrollPad,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                  ],
                  onSubmitted: (_) => _tryCreate(),
                  decoration: _fieldDecoration(
                    context,
                    labelText: 'Max score',
                    errorText: _maxError,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Example: 100',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: AppColors.textSecondary.withValues(alpha: 0.72),
                    fontWeight: FontWeight.w500,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _tryCreate,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Create assignment',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: BorderSide(
                      color: AppColors.cardBorder.withValues(alpha: 0.95),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Premium confirm before deleting a gradebook assignment from Teacher Marks.
class _DeleteGradebookAssignmentConfirmDialog extends StatelessWidget {
  const _DeleteGradebookAssignmentConfirmDialog();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final errSoft = cs.error.withValues(alpha: dark ? 0.88 : 0.92);
    final errBg = cs.error.withValues(alpha: dark ? 0.14 : 0.08);

    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 28),
      child: Material(
        color: cs.surface,
        elevation: 10,
        shadowColor: Colors.black.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(24),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Delete assignment?',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'This will remove this assignment and its saved scores. '
                'This cannot be undone.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary.withValues(alpha: 0.88),
                  height: 1.45,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textSecondary,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        side: BorderSide(
                          color: AppColors.cardBorder.withValues(alpha: 0.95),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      style: FilledButton.styleFrom(
                        backgroundColor: errBg,
                        foregroundColor: errSoft,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Delete assignment',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

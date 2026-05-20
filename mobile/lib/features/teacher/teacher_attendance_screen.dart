import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/attendance/teacher_attendance_status.dart';
import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_enrollment.dart';
import '../../data/teacher_repository.dart';
import 'teacher_attendance_local_store.dart';

typedef AttendanceLeaveHandler = Future<bool> Function();

enum _PremiumSnackVariant { success, info, error }

class TeacherAttendanceScreen extends StatefulWidget {
  const TeacherAttendanceScreen({
    super.key,
    required this.user,
    required this.data,
    this.onRegisterLeaveHandler,
  });

  final User user;
  final TeacherDeskData data;

  /// When non-null, parent may call to confirm leaving (tabs) while dirty.
  final void Function(AttendanceLeaveHandler? handler)? onRegisterLeaveHandler;

  @override
  State<TeacherAttendanceScreen> createState() =>
      _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState extends State<TeacherAttendanceScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);
  final _searchController = TextEditingController();

  int _assignmentIndex = 0;

  /// Selected calendar day for viewing or editing (device-local). Only today is editable.
  late DateTime _selectedAttendanceDay;

  /// YMD string last successfully loaded for [_selectedAttendanceDay].
  String? _loadedAttendanceDateYmd;

  List<Map<String, String>> _students = [];
  final Map<String, String> _status = {};
  final Map<String, String> _baseline = {};
  bool _dirty = false;
  /// After Reset (quick action), stay unsaved until teacher saves—even if rows were already Present.
  bool _resetAwaitingSave = false;
  bool _loading = false;
  bool _saving = false;
  /// Brief footer success state after save, before bar hides.
  bool _saveSuccessFlash = false;
  String? _error;
  DateTime? _lastSavedAt;
  Timer? _draftDebounce;
  Timer? _relativeSavedTimer;
  Timer? _saveFlashTimer;

  TeacherAssignmentDisplay? get _sel {
    final a = widget.data.assignments;
    if (a.isEmpty || _assignmentIndex < 0 || _assignmentIndex >= a.length) {
      return null;
    }
    return a[_assignmentIndex];
  }

  String _dateYmd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// Device-local calendar "today" (no UTC date-shift for attendance keys).
  DateTime _localCalendarToday() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  String _todayYmd() => _dateYmd(_localCalendarToday());

  bool get _isViewingToday =>
      _dateYmd(_selectedAttendanceDay) == _todayYmd();

  String? _sessionKeyOrNull() {
    if (!_isViewingToday) return null;
    final sel = _sel;
    if (sel == null) return null;
    return TeacherAttendanceLocalStore.sessionKey(
      teacherId: widget.user.id,
      classId: sel.classId,
      subjectId: sel.subjectId,
      dateYmd: _todayYmd(),
    );
  }

  /// Ultra-light row wash; P/A/L control stays the primary cue.
  static Color _statusRowTint(BuildContext context, String status) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    switch (status) {
      case 'absent':
        return dark
            ? const Color(0xFF3A2224).withValues(alpha: 0.45)
            : const Color(0xFFFFF5F5);
      case 'late':
        return dark
            ? const Color(0xFF3A3420).withValues(alpha: 0.45)
            : const Color(0xFFFFFBF0);
      case 'present':
      default:
        return dark
            ? const Color(0xFF1F2E24).withValues(alpha: 0.45)
            : const Color(0xFFF4FBF6);
    }
  }

  void _recomputeDirty() {
    if (_resetAwaitingSave) {
      _dirty = true;
      return;
    }
    var dirty = false;
    for (final s in _students) {
      final id = s['id']!;
      if (normalizeTeacherAttendanceStatus(_status[id]) !=
          normalizeTeacherAttendanceStatus(_baseline[id])) {
        dirty = true;
        break;
      }
    }
    _dirty = dirty;
  }

  void _scheduleDraftPersist() {
    _draftDebounce?.cancel();
    _draftDebounce = Timer(const Duration(milliseconds: 350), () {
      unawaited(_persistDraftNow());
    });
  }

  Future<void> _persistDraftNow() async {
    if (!_isViewingToday) return;
    final key = _sessionKeyOrNull();
    if (key == null || _students.isEmpty) return;
    if (!_dirty) {
      await TeacherAttendanceLocalStore.clearDraft(key);
      return;
    }
    final m = <String, String>{};
    for (final s in _students) {
      final id = s['id']!;
      m[id] = normalizeTeacherAttendanceStatus(_status[id]);
    }
    await TeacherAttendanceLocalStore.writeDraft(key, m);
  }

  Future<void> _discardUnsaved() async {
    final key = _sessionKeyOrNull();
    _resetAwaitingSave = false;
    _status
      ..clear()
      ..addAll(_baseline);
    _dirty = false;
    if (key != null) {
      await TeacherAttendanceLocalStore.clearDraft(key);
    }
    if (mounted) setState(() {});
  }

  Future<bool> _confirmLeaveIfUnsaved() async {
    if (!_dirty) return true;
    final r = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unsaved class list changes'),
        content: const Text(
          'You have changes that are not saved yet. What would you like to do?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, 'stay'),
            child: const Text('Stay here'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, 'leave'),
            child: const Text('Leave without saving'),
          ),
        ],
      ),
    );
    if (r != 'leave') return false;
    await _discardUnsaved();
    return true;
  }

  /// Whitespace-normalized query words; each must appear as a substring of the
  /// lowercased name (e.g. "juma mw" → "Jumaa Mwachuo").
  List<String> _searchWords() {
    final collapsed = _searchController.text
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'\s+'), ' ');
    if (collapsed.isEmpty) return const [];
    return collapsed.split(' ').where((w) => w.isNotEmpty).toList();
  }

  String _searchQueryDisplay() {
    return _searchController.text.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  bool _nameMatchesSearch(String? fullName) {
    final words = _searchWords();
    if (words.isEmpty) return true;
    final name = (fullName ?? '').toLowerCase();
    for (final w in words) {
      if (!name.contains(w)) return false;
    }
    return true;
  }

  List<Map<String, String>> _visibleStudents() {
    if (_searchWords().isEmpty) {
      return List<Map<String, String>>.from(_students);
    }
    return _students.where((s) => _nameMatchesSearch(s['full_name'])).toList();
  }

  String _studentCountLabel() {
    final total = _students.length;
    final visible = _visibleStudents().length;
    final filtered = _searchWords().isNotEmpty;
    if (total == 0) return 'No students in roster';
    if (!filtered) return 'Showing $total student${total == 1 ? '' : 's'}';
    return 'Showing $visible of $total student${total == 1 ? '' : 's'}';
  }

  ({int p, int a, int l}) _rosterPalCounts() {
    var p = 0;
    var a = 0;
    var l = 0;
    for (final s in _students) {
      final id = s['id']!;
      switch (normalizeTeacherAttendanceStatus(_status[id])) {
        case 'absent':
          a++;
          break;
        case 'late':
          l++;
          break;
        case 'present':
        default:
          p++;
          break;
      }
    }
    return (p: p, a: a, l: l);
  }

  @override
  void initState() {
    super.initState();
    _selectedAttendanceDay = _localCalendarToday();
    _searchController.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onRegisterLeaveHandler?.call(_confirmLeaveIfUnsaved);
      _load();
    });
  }

  @override
  void dispose() {
    _draftDebounce?.cancel();
    _relativeSavedTimer?.cancel();
    _saveFlashTimer?.cancel();
    widget.onRegisterLeaveHandler?.call(null);
    _searchController.dispose();
    super.dispose();
  }

  void _restartRelativeSavedTimer() {
    _relativeSavedTimer?.cancel();
    if (_lastSavedAt == null) return;
    _relativeSavedTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  bool get _showSaveFooter =>
      _isViewingToday && (_saving || _dirty || _saveSuccessFlash);

  static String _humanSavedPhrase(DateTime? at) {
    if (at == null) return '';
    final now = DateTime.now();
    final d = now.difference(at);
    if (d.inMinutes < 1) return 'Saved just now';
    if (d.inHours < 1) {
      final m = d.inMinutes;
      return 'Last saved $m min ago';
    }
    return 'Last saved at ${DateFormat.jm().format(at)}';
  }

  double _premiumSnackBottomMargin(BuildContext context) {
    final m = MediaQuery.of(context);
    final keyboardH = m.viewInsets.bottom;
    final safeBottom = m.padding.bottom;
    if (keyboardH > 0) return keyboardH + 12;
    final savePad = _showSaveFooter ? 76.0 : 0.0;
    return safeBottom + 88 + savePad;
  }

  void _showPremiumSnack(
    BuildContext context, {
    required _PremiumSnackVariant variant,
    required String title,
    String? subtitle,
    IconData icon = Icons.info_outline_rounded,
    Duration duration = const Duration(seconds: 3),
  }) {
    if (!mounted) return;
    final bottom = _premiumSnackBottomMargin(context);
    Color bg;
    Color iconC;
    Color titleC;
    Color? subC;
    switch (variant) {
      case _PremiumSnackVariant.success:
        bg = AppColors.successBg;
        iconC = AppColors.success;
        titleC = const Color(0xFF065F46);
        subC = const Color(0xFF047857).withValues(alpha: 0.88);
        break;
      case _PremiumSnackVariant.info:
        bg = AppColors.indigoWash;
        iconC = AppColors.primary;
        titleC = const Color(0xFF312E81);
        subC = AppColors.textSecondary;
        break;
      case _PremiumSnackVariant.error:
        bg = const Color(0xFFFEF2F2);
        iconC = const Color(0xFFDC2626);
        titleC = const Color(0xFF991B1B);
        subC = const Color(0xFFB91C1C).withValues(alpha: 0.85);
        break;
    }

    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.transparent,
        elevation: 0,
        padding: EdgeInsets.zero,
        margin: EdgeInsets.fromLTRB(16, 0, 16, bottom),
        duration: duration,
        dismissDirection: DismissDirection.down,
        content: Material(
          color: bg,
          elevation: 6,
          shadowColor: Colors.black.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 24, color: iconC.withValues(alpha: 0.92)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: titleC,
                              letterSpacing: -0.2,
                            ),
                      ),
                      if (subtitle != null && subtitle.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: subC,
                                    height: 1.25,
                                    fontWeight: FontWeight.w500,
                                  ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _load() async {
    final sel = _sel;
    if (sel == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ymd = _dateYmd(_selectedAttendanceDay);
      final period = teacherCurrentEnrollmentPeriod();
      final ay = enrollmentYearFromAssignmentString(sel.academicYear);

      final roster = await teacherGetStudentsForSubject(
        Supabase.instance.client,
        classId: sel.classId,
        subjectId: sel.subjectId,
        academicYear: ay,
        term: period.term,
        enrollmentDateOnOrBefore: ymd,
      );

      final att = await _repo.loadAttendanceForDate(
        teacherId: widget.user.id,
        classId: sel.classId,
        dateYmd: ymd,
        subjectId: sel.subjectId,
      );

      Map<String, String>? draft;
      DateTime? lastSaved;
      if (_dateYmd(_selectedAttendanceDay) == _todayYmd()) {
        final key = TeacherAttendanceLocalStore.sessionKey(
          teacherId: widget.user.id,
          classId: sel.classId,
          subjectId: sel.subjectId,
          dateYmd: ymd,
        );
        draft = await TeacherAttendanceLocalStore.readDraft(key);
        lastSaved = await TeacherAttendanceLocalStore.readLastSaved(key);
      }

      if (!mounted) return;
      setState(() {
        _students = roster;
        _baseline
          ..clear()
          ..addAll(att);
        for (final s in roster) {
          _baseline.putIfAbsent(s['id']!, () => 'present');
        }
        _status
          ..clear()
          ..addAll(_baseline);
        if (draft != null) {
          for (final s in roster) {
            final id = s['id']!;
            if (draft.containsKey(id)) {
              _status[id] = normalizeTeacherAttendanceStatus(draft[id]);
            }
          }
        }
        _resetAwaitingSave = false;
        _recomputeDirty();
        _lastSavedAt = lastSaved;
        _loadedAttendanceDateYmd = ymd;
        _loading = false;
      });
      _restartRelativeSavedTimer();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyDataLoadError(e);
        _loadedAttendanceDateYmd = null;
        _loading = false;
      });
    }
  }

  Future<void> _handleRefresh() async {
    FocusScope.of(context).unfocus();
    if (_dirty) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Reload class list?'),
          content: const Text(
            'Reloading will fetch the latest records from the server. '
            'Unsaved changes on this screen will be discarded.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep editing'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Reload'),
            ),
          ],
        ),
      );
      if (ok != true || !mounted) return;
      await _discardUnsaved();
    }
    await _load();
    if (!mounted) return;
    if (_error == null) {
      _showPremiumSnack(
        context,
        variant: _PremiumSnackVariant.info,
        icon: Icons.cloud_done_rounded,
        title: 'Class list updated',
        subtitle: _isViewingToday
            ? "Today's roster and class list reloaded."
            : 'Class list reloaded for the selected date.',
        duration: const Duration(seconds: 2),
      );
    }
  }

  Future<void> _pickDate() async {
    final today = _localCalendarToday();
    final first = DateTime(2020);
    final initial = _selectedAttendanceDay.isAfter(today)
        ? today
        : _selectedAttendanceDay;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: first,
      lastDate: today,
    );
    if (picked == null || !mounted) return;
    final day = DateTime(picked.year, picked.month, picked.day);
    if (day.isAfter(today)) return;
    if (!await _confirmLeaveIfUnsaved() || !mounted) return;
    setState(() => _selectedAttendanceDay = day);
    await _load();
  }

  void _setStudentStatus(String studentId, String status) {
    if (!_isViewingToday) return;
    setState(() {
      _status[studentId] = normalizeTeacherAttendanceStatus(status);
      _recomputeDirty();
    });
    _scheduleDraftPersist();
  }

  void _setStatusForVisible(String status) {
    if (!_isViewingToday) return;
    final n = normalizeTeacherAttendanceStatus(status);
    setState(() {
      for (final s in _visibleStudents()) {
        final id = s['id'];
        if (id != null) _status[id] = n;
      }
      _recomputeDirty();
    });
    _scheduleDraftPersist();
  }

  Future<void> _confirmMarkAllAbsent() async {
    final ok = await showDialog<bool>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        title: const Text('Mark all students absent?'),
        content: const Text(
          'This will set every visible student to absent. You can still edit '
          'individual students before saving.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Mark absent'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) _setStatusForVisible('absent');
  }

  void _debugLogReset(String message) {
    if (kDebugMode) {
      debugPrint('[TeacherAttendance][reset] $message');
    }
  }

  void _showAttendanceResetSnackBar() {
    if (!mounted) return;
    _showPremiumSnack(
      context,
      variant: _PremiumSnackVariant.info,
      icon: Icons.restart_alt_rounded,
      title: 'Class list reset',
      subtitle: 'Save to confirm changes',
      duration: const Duration(milliseconds: 2800),
    );
  }

  Future<void> _confirmResetVisible() async {
    final ok = await showDialog<bool>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset class list?'),
        content: const Text(
          'This will reset the currently visible students back to Present. '
          'Save again to update today\'s class list.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) {
      _debugLogReset('confirmation dismissed or not mounted');
      return;
    }
    _debugLogReset('confirmation accepted');
    final visible = _visibleStudents();
    final visibleCount = visible.length;
    _debugLogReset('visible student count: $visibleCount');
    if (visible.isEmpty) {
      _debugLogReset('abort: no visible students');
      return;
    }

    var changed = 0;
    final before = <String, String>{};
    for (final s in visible) {
      final id = s['id'];
      if (id == null) continue;
      before[id] = normalizeTeacherAttendanceStatus(_status[id]);
    }

    setState(() {
      for (final s in visible) {
        final id = s['id'];
        if (id != null) _status[id] = 'present';
      }
      _resetAwaitingSave = true;
      _recomputeDirty();
    });

    for (final id in before.keys) {
      if (before[id] != normalizeTeacherAttendanceStatus(_status[id])) {
        changed++;
      }
    }
    _debugLogReset('changed student count: $changed (dirty=$_dirty)');
    _scheduleDraftPersist();

    _showAttendanceResetSnackBar();
  }

  void _openQuickActionsSheet() {
    if (!_isViewingToday) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Quick actions',
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Applies to students currently visible in the list.',
                  style: Theme.of(ctx).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 16),
                _BulkActionTile(
                  icon: Icons.check_circle_outline_rounded,
                  iconColor: const Color(0xFF059669),
                  title: 'Mark all present',
                  subtitle: 'Set every student to present',
                  onTap: () {
                    Navigator.pop(ctx);
                    _setStatusForVisible('present');
                  },
                ),
                const SizedBox(height: 8),
                _BulkActionTile(
                  icon: Icons.cancel_outlined,
                  iconColor: const Color(0xFFDC2626),
                  title: 'Mark all absent',
                  subtitle: 'Set every student to absent',
                  onTap: () {
                    Navigator.pop(ctx);
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) _confirmMarkAllAbsent();
                    });
                  },
                ),
                const SizedBox(height: 8),
                _BulkActionTile(
                  icon: Icons.restart_alt_rounded,
                  iconColor: AppColors.primary,
                  title: 'Reset class list',
                  subtitle: 'Visible students back to Present',
                  onTap: () {
                    _debugLogReset('reset tapped');
                    Navigator.pop(ctx);
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) _confirmResetVisible();
                    });
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _save() async {
    final sel = _sel;
    if (sel == null || !_dirty) return;

    if (!_isViewingToday) {
      if (mounted) {
        _showPremiumSnack(
          context,
          variant: _PremiumSnackVariant.error,
          icon: Icons.info_outline_rounded,
          title: 'Cannot save class list',
          subtitle:
              'Past class list is view-only. Class list can only be edited today.',
        );
      }
      return;
    }

    final todayYmd = _todayYmd();
    if (_loadedAttendanceDateYmd != todayYmd ||
        _dateYmd(_selectedAttendanceDay) != todayYmd) {
      if (mounted) {
        _showPremiumSnack(
          context,
          variant: _PremiumSnackVariant.error,
          icon: Icons.info_outline_rounded,
          title: 'Cannot save class list',
          subtitle:
              'Past class list is view-only. Class list can only be edited today.',
        );
      }
      return;
    }

    final schoolId = await _repo.schoolIdForClassInTeacherCluster(
      teacherId: widget.user.id,
      classId: sel.classId,
    );
    if (schoolId == null) {
      if (mounted) {
        _showPremiumSnack(
          context,
          variant: _PremiumSnackVariant.error,
          icon: Icons.error_outline_rounded,
          title: 'Could not save',
          subtitle: 'Could not resolve school for this class.',
        );
      }
      return;
    }

    final sessionKey = TeacherAttendanceLocalStore.sessionKey(
      teacherId: widget.user.id,
      classId: sel.classId,
      subjectId: sel.subjectId,
      dateYmd: todayYmd,
    );
    final updatedCount = _students.length;

    setState(() => _saving = true);
    try {
      for (final s in _students) {
        final sid = s['id']!;
        final st = normalizeTeacherAttendanceStatus(_status[sid]);
        await _repo.upsertAttendanceRow(
          teacherId: widget.user.id,
          schoolId: schoolId,
          classId: sel.classId,
          studentId: sid,
          dateYmd: todayYmd,
          status: st,
          subjectId: sel.subjectId,
        );
      }
      await TeacherAttendanceLocalStore.clearDraft(sessionKey);
      final now = DateTime.now();
      await TeacherAttendanceLocalStore.writeLastSaved(sessionKey, now);
      if (!mounted) return;
      setState(() {
        _baseline.clear();
        for (final s in _students) {
          final id = s['id']!;
          _baseline[id] = normalizeTeacherAttendanceStatus(_status[id]);
        }
        _resetAwaitingSave = false;
        _dirty = false;
        _lastSavedAt = now;
        _saveSuccessFlash = true;
      });
      _restartRelativeSavedTimer();
      _saveFlashTimer?.cancel();
      _saveFlashTimer = Timer(const Duration(milliseconds: 2000), () {
        if (mounted) setState(() => _saveSuccessFlash = false);
      });
      if (!mounted) return;
      _showPremiumSnack(
        context,
        variant: _PremiumSnackVariant.success,
        icon: Icons.check_circle_rounded,
        title: 'Class list saved successfully',
        subtitle:
            '$updatedCount student${updatedCount == 1 ? '' : 's'} updated',
        duration: const Duration(seconds: 3),
      );
    } catch (e) {
      if (!mounted) return;
      _showPremiumSnack(
        context,
        variant: _PremiumSnackVariant.error,
        icon: Icons.error_outline_rounded,
        title: 'Save failed',
        subtitle: friendlyDataLoadError(e),
        duration: const Duration(seconds: 4),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _buildEmptyState(BuildContext context) {
    final rosterEmpty = _students.isEmpty;
    final secondary = AppColors.textSecondary;
    if (rosterEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(
          TeacherUiTokens.horizontalPadding,
          10,
          TeacherUiTokens.horizontalPadding,
          8,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.groups_2_outlined,
              size: 20,
              color: secondary.withValues(alpha: 0.55),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'No students in this class for the selected date.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: secondary,
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                    ),
              ),
            ),
          ],
        ),
      );
    }
    final q = _searchQueryDisplay();
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        TeacherUiTokens.horizontalPadding,
        10,
        TeacherUiTokens.horizontalPadding,
        8,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.person_search_rounded,
            size: 20,
            color: secondary.withValues(alpha: 0.5),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'No student matches “$q”',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: secondary,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Try another spelling.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: secondary.withValues(alpha: 0.85),
                        height: 1.3,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static const double _comfortableBodyHeightForPinnedSave = 400;

  Widget _saveFooterInner(BuildContext context) {
    if (!_isViewingToday) {
      return const SizedBox.shrink();
    }
    if (_saving) {
      return FilledButton.icon(
        onPressed: null,
        icon: const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        label: const Text('Saving…'),
      );
    }
    if (_saveSuccessFlash) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.check_circle_rounded,
            color: AppColors.success.withValues(alpha: 0.95),
            size: 22,
          ),
          const SizedBox(width: 10),
          Text(
            'Saved successfully',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF065F46),
                ),
          ),
        ],
      );
    }
    return FilledButton.icon(
      onPressed: (_loading || _students.isEmpty || !_dirty) ? null : _save,
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      icon: const Icon(Icons.save_rounded),
      label: const Text('Save class list'),
    );
  }

  Widget _animatedSaveFooter(BuildContext context, {required double bottomInset}) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, anim) {
        return ClipRect(
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.2),
              end: Offset.zero,
            ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
            child: FadeTransition(opacity: anim, child: child),
          ),
        );
      },
      child: !_showSaveFooter
          ? const SizedBox(
              key: ValueKey<String>('save_off'),
              width: double.infinity,
              height: 0,
            )
          : KeyedSubtree(
              key: ValueKey<String>(
                _saving ? 'saving' : (_saveSuccessFlash ? 'flash' : 'dirty'),
              ),
              child: _floatingSaveChrome(
                context,
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    TeacherUiTokens.horizontalPadding,
                    8,
                    TeacherUiTokens.horizontalPadding,
                    8 + bottomInset,
                  ),
                  child: _saveFooterInner(context),
                ),
              ),
            ),
    );
  }

  Widget _floatingSaveChrome(BuildContext context, Widget child) {
    final surface = Theme.of(context).colorScheme.surface;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: child,
    );
  }


  String _attendanceDateButtonLabel() {
    if (_isViewingToday) {
      return 'Today · ${_dateYmd(_selectedAttendanceDay)}';
    }
    return DateFormat(
      'dd MMM yyyy',
      Localizations.localeOf(context).toString(),
    ).format(_selectedAttendanceDay);
  }

  Widget _attendanceDatePickerButton(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: _loading ? null : () => unawaited(_pickDate()),
      icon: Icon(
        Icons.calendar_today_rounded,
        size: 18,
        color: AppColors.textSecondary.withValues(alpha: 0.82),
      ),
      label: Text(
        _attendanceDateButtonLabel(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: 0.02,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.9),
            ),
      ),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        side: BorderSide(
          color: AppColors.cardBorder.withValues(alpha: 0.92),
        ),
      ),
    );
  }

  Widget _summaryHairline(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Divider(
        height: 1,
        thickness: 0.5,
        color: AppColors.cardBorder.withValues(alpha: dark ? 0.42 : 0.72),
      ),
    );
  }

  Widget _heroPresentMetric(
    BuildContext context, {
    required String label,
    required String value,
    required bool showDividerBelow,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final labelStyle = theme.textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w800,
          fontSize: 15,
          height: 1.2,
          letterSpacing: -0.15,
          color: cs.onSurface.withValues(alpha: 0.93),
        ) ??
        TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 15,
          height: 1.2,
          color: cs.onSurface.withValues(alpha: 0.93),
        );
    final valueStyle = theme.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w900,
          fontSize: 19,
          height: 1.05,
          letterSpacing: -0.45,
          color: cs.onSurface.withValues(alpha: 0.96),
        ) ??
        TextStyle(
          fontWeight: FontWeight.w900,
          fontSize: 19,
          height: 1.05,
          color: cs.onSurface.withValues(alpha: 0.96),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1, bottom: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: labelStyle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                value,
                style: valueStyle,
              ),
            ],
          ),
        ),
        if (showDividerBelow) _summaryHairline(context),
      ],
    );
  }

  Widget _secondaryMetricLine(
    BuildContext context, {
    required String label,
    required String value,
    required bool showDividerBelow,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final labelStyle = theme.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w500,
          fontSize: 13,
          height: 1.2,
          color: cs.onSurface.withValues(alpha: 0.58),
        ) ??
        TextStyle(
          fontWeight: FontWeight.w500,
          fontSize: 13,
          height: 1.2,
          color: cs.onSurface.withValues(alpha: 0.58),
        );
    final valueStyle = theme.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w700,
          fontSize: 14,
          height: 1.2,
          color: cs.onSurface.withValues(alpha: 0.72),
        ) ??
        TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 14,
          height: 1.2,
          color: cs.onSurface.withValues(alpha: 0.72),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: labelStyle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(value, style: valueStyle),
            ],
          ),
        ),
        if (showDividerBelow) _summaryHairline(context),
      ],
    );
  }

  Widget _syncStatusPill(BuildContext context) {
    final theme = Theme.of(context);
    final small = theme.textTheme.labelSmall;
    if (!_isViewingToday) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.indigoWash.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.14),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(
              Icons.lock_outline_rounded,
              size: 15,
              color: AppColors.primaryDark.withValues(alpha: 0.78),
            ),
            const SizedBox(width: 5),
            Text(
              'Read-only record',
              style: small?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.primaryDark.withValues(alpha: 0.82),
                height: 1.1,
              ),
            ),
          ],
        ),
      );
    }
    if (_dirty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7ED),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: const Color(0xFFFDBA74).withValues(alpha: 0.4),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(
              Icons.fiber_manual_record_rounded,
              size: 9,
              color: const Color(0xFFEA580C).withValues(alpha: 0.95),
            ),
            const SizedBox(width: 6),
            Text(
              'Unsaved changes',
              style: small?.copyWith(
                fontWeight: FontWeight.w700,
                color: const Color(0xFFC2410C).withValues(alpha: 0.9),
                height: 1.1,
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF5FBF7),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(0xFFD1FAE5).withValues(alpha: 0.52),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            Icons.check_circle_rounded,
            size: 15,
            color: const Color(0xFF059669).withValues(alpha: 0.74),
          ),
          const SizedBox(width: 5),
          Text(
            'All changes saved',
            style: small?.copyWith(
              fontWeight: FontWeight.w600,
              color: const Color(0xFF047857).withValues(alpha: 0.82),
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }

  String _lastSavedSummaryLine() {
    if (_isViewingToday) {
      if (_lastSavedAt != null) return _humanSavedPhrase(_lastSavedAt);
      return 'Not saved yet';
    }
    return 'Last saved: —';
  }

  Widget _attendanceSummaryCard(
    BuildContext context, {
    required ({int p, int a, int l}) counts,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final attended = counts.p + counts.l;
    final dark = theme.brightness == Brightness.dark;

    final rosterLineStyle = theme.textTheme.labelMedium?.copyWith(
      color: AppColors.textSecondary,
      fontWeight: FontWeight.w600,
      height: 1.25,
    );

    final onTimeHelperStyle = theme.textTheme.labelSmall?.copyWith(
      color: AppColors.textSecondary.withValues(alpha: 0.68),
      fontWeight: FontWeight.w500,
      height: 1.35,
      fontSize: 11,
    );

    final legendStyle = theme.textTheme.labelSmall?.copyWith(
      fontSize: 10,
      height: 1.35,
      color: AppColors.textSecondary.withValues(alpha: 0.48),
      fontWeight: FontWeight.w500,
    );

    final readOnlyTitleStyle = theme.textTheme.titleSmall?.copyWith(
      fontWeight: FontWeight.w800,
      color: AppColors.textSecondary.withValues(alpha: 0.88),
      height: 1.25,
    );
    final readOnlySubStyle = theme.textTheme.bodySmall?.copyWith(
      color: AppColors.textSecondary.withValues(alpha: 0.62),
      height: 1.35,
      fontWeight: FontWeight.w500,
    );

    final lastSavedStyle = theme.textTheme.labelSmall?.copyWith(
      color: AppColors.textSecondary.withValues(alpha: 0.82),
      fontWeight: FontWeight.w600,
      height: 1.25,
    );

    final cardBg = dark
        ? cs.surfaceContainerHighest.withValues(alpha: 0.4)
        : const Color(0xFFFBFBFD);
    final borderC = AppColors.cardBorder.withValues(alpha: dark ? 0.5 : 0.78);

    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderC),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: dark ? 0.22 : 0.032),
              blurRadius: dark ? 14 : 9,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 9),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      _lastSavedSummaryLine(),
                      key: ValueKey<String>(
                        'ls_${_lastSavedAt?.millisecondsSinceEpoch}_${_dirty}_$_isViewingToday',
                      ),
                      style: lastSavedStyle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _syncStatusPill(context),
                ],
              ),
              if (!_isViewingToday) ...[
                const SizedBox(height: 10),
                Text('Viewing past class list', style: readOnlyTitleStyle),
                const SizedBox(height: 4),
                Text('Past records are read-only', style: readOnlySubStyle),
              ],
              const SizedBox(height: 10),
              Text(
                _studentCountLabel(),
                style: rosterLineStyle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              if (_isViewingToday)
                _heroPresentMetric(
                  context,
                  label: 'Present today',
                  value: '$attended',
                  showDividerBelow: true,
                )
              else
                _heroPresentMetric(
                  context,
                  label: 'Attended',
                  value: '$attended',
                  showDividerBelow: true,
                ),
              _secondaryMetricLine(
                context,
                label: 'Late',
                value: '${counts.l}',
                showDividerBelow: true,
              ),
              const SizedBox(height: 5),
              _secondaryMetricLine(
                context,
                label: 'Absent',
                value: '${counts.a}',
                showDividerBelow: false,
              ),
              const SizedBox(height: 1),
              Text(
                'On time: ${counts.p} students',
                key: ValueKey<String>('ot_${counts.p}'),
                style: onTimeHelperStyle,
              ),
              const SizedBox(height: 8),
              Text(
                'P = on time · A = absent · L = late',
                style: legendStyle,
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _attendanceSlivers(
    BuildContext context, {
    required double searchScrollPaddingBottom,
  }) {
    final assignments = widget.data.assignments;
    final visible = _visibleStudents();
    final counts = _rosterPalCounts();

    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(
          TeacherUiTokens.horizontalPadding,
          8,
          TeacherUiTokens.horizontalPadding,
          4,
        ),
        sliver: SliverToBoxAdapter(
          child: Text(
            'Class List',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                ),
          ),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(
          TeacherUiTokens.horizontalPadding,
          0,
          TeacherUiTokens.horizontalPadding,
          4,
        ),
        sliver: SliverToBoxAdapter(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<int>(
                value: _assignmentIndex.clamp(0, assignments.length - 1),
                decoration: const InputDecoration(
                  labelText: 'Class & subject',
                  border: OutlineInputBorder(),
                  isDense: true,
                  contentPadding:
                      EdgeInsets.fromLTRB(12, 12, 12, 10),
                ),
                items: [
                  for (var i = 0; i < assignments.length; i++)
                    DropdownMenuItem(
                      value: i,
                      child: Text(
                        '${assignments[i].className} · ${assignments[i].subjectLabel}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: _loading
                    ? null
                    : (v) async {
                        if (v == null) return;
                        if (!await _confirmLeaveIfUnsaved() || !mounted) {
                          return;
                        }
                        setState(() => _assignmentIndex = v);
                        await _load();
                      },
              ),
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                child: _attendanceDatePickerButton(context),
              ),
              if (_students.isNotEmpty && !_loading) ...[
                _attendanceSummaryCard(context, counts: counts),
                const SizedBox(height: 8),
              ] else if (_loading)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Loading roster…',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    _studentCountLabel(),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
            ],
          ),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(
          TeacherUiTokens.horizontalPadding,
          14,
          TeacherUiTokens.horizontalPadding,
          4,
        ),
        sliver: SliverToBoxAdapter(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  textInputAction: TextInputAction.search,
                  scrollPadding:
                      EdgeInsets.only(bottom: searchScrollPaddingBottom),
                  decoration: InputDecoration(
                    hintText: 'Find student',
                    isDense: true,
                    filled: true,
                    fillColor: Theme.of(context).colorScheme.surface,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    prefixIcon: Icon(
                      Icons.search_rounded,
                      color:
                          AppColors.textSecondary.withValues(alpha: 0.65),
                      size: 22,
                    ),
                    suffixIcon: AnimatedOpacity(
                      opacity: _searchController.text.isNotEmpty ? 1 : 0,
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOut,
                      child: IgnorePointer(
                        ignoring: _searchController.text.isEmpty,
                        child: IconButton(
                          tooltip: 'Clear',
                          icon: Icon(
                            Icons.close_rounded,
                            color: AppColors.textSecondary
                                .withValues(alpha: 0.58),
                          ),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {});
                          },
                        ),
                      ),
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                        color: const Color(0xFFCBD5E1).withValues(alpha: 0.55),
                        width: 1,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                        color: const Color(0xFFCBD5E1).withValues(alpha: 0.55),
                        width: 1,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                        color: AppColors.primary.withValues(alpha: 0.38),
                        width: 1,
                      ),
                    ),
                  ),
                ),
              ),
              if (_isViewingToday) ...[
                const SizedBox(width: 10),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: OutlinedButton(
                    onPressed: _loading || _students.isEmpty
                        ? null
                        : _openQuickActionsSheet,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primaryDark,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      side: BorderSide(
                        color: AppColors.primary.withValues(alpha: 0.5),
                        width: 1.15,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Quick actions',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      if (_error != null)
        SliverPadding(
          padding: const EdgeInsets.symmetric(
            horizontal: TeacherUiTokens.horizontalPadding,
          ),
          sliver: SliverToBoxAdapter(
            child: Text(
              _error!,
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ),
        ),
      if (_loading)
        const SliverFillRemaining(
          hasScrollBody: false,
          child: Center(child: CircularProgressIndicator()),
        )
      else if (visible.isEmpty)
        SliverToBoxAdapter(child: _buildEmptyState(context))
      else
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            8,
            TeacherUiTokens.horizontalPadding,
            24,
          ),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                if (i.isOdd) {
                  return const SizedBox(height: 8);
                }
                final idx = i ~/ 2;
                final s = visible[idx];
                final sid = s['id']!;
                final name = s['full_name'] ?? 'Student';
                final cur = normalizeTeacherAttendanceStatus(_status[sid]);
                final card = Card(
                  elevation: 0,
                  color: _statusRowTint(context, cur),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(
                      color: AppColors.cardBorder.withValues(alpha: 0.9),
                    ),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            softWrap: true,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              height: 1.25,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        _AttendancePalBar(
                          value: cur,
                          interactive: _isViewingToday,
                          onChanged: (v) => _setStudentStatus(sid, v),
                        ),
                      ],
                    ),
                  ),
                );
                if (_isViewingToday) return card;
                return Opacity(
                  opacity: 0.93,
                  child: card,
                );
              },
              childCount: visible.length * 2 - 1,
            ),
          ),
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.data.hasTeachingAssignments ||
        widget.data.assignments.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Class list opens when your school assigns you to a class.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final viewInsets = MediaQuery.viewInsetsOf(context);
        final keyboardOpen = viewInsets.bottom > 0;
        final pinSaveFooter = !keyboardOpen ||
            constraints.maxHeight >= _comfortableBodyHeightForPinnedSave;
        final padBottom = MediaQuery.paddingOf(context).bottom;
        final searchPadBottom = pinSaveFooter
            ? (_showSaveFooter ? 108.0 : 28.0)
            : (viewInsets.bottom +
                padBottom +
                (_showSaveFooter ? 76.0 : 20.0));

        final slivers = _attendanceSlivers(
          context,
          searchScrollPaddingBottom: searchPadBottom,
        );

        if (!pinSaveFooter) {
          return RefreshIndicator(
            onRefresh: _handleRefresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              keyboardDismissBehavior:
                  ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                ...slivers,
                SliverToBoxAdapter(
                  child: _animatedSaveFooter(
                    context,
                    bottomInset: padBottom,
                  ),
                ),
              ],
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: _handleRefresh,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  slivers: slivers,
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: _animatedSaveFooter(context, bottomInset: 0),
            ),
          ],
        );
      },
    );
  }
}

class _AttendancePalBar extends StatefulWidget {
  const _AttendancePalBar({
    required this.value,
    required this.onChanged,
    this.interactive = true,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final bool interactive;

  @override
  State<_AttendancePalBar> createState() => _AttendancePalBarState();
}

class _AttendancePalBarState extends State<_AttendancePalBar> {
  static const _presentBg = Color(0xFFD1FAE5);
  static const _presentFg = Color(0xFF047857);
  static const _absentBg = Color(0xFFFEE2E2);
  static const _absentFg = Color(0xFFB91C1C);
  static const _lateBg = Color(0xFFFDE68A);
  static const _lateFg = Color(0xFFB45309);

  @override
  Widget build(BuildContext context) {
    final track = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF2A2A2E)
        : const Color(0xFFE8EAEF);
    final borderIdle = const Color(0xFF94A3B8).withValues(alpha: 0.45);

    Widget seg(String id, String label, Color selBg, Color selFg) {
      final on = widget.value == id;
      return Material(
        color: on ? selBg : Colors.transparent,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          onTap: !widget.interactive || widget.value == id
              ? null
              : () => widget.onChanged(id),
          borderRadius: BorderRadius.circular(11),
          splashColor: selFg.withValues(alpha: 0.14),
          highlightColor: selFg.withValues(alpha: 0.08),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 100),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              border: Border.all(
                color: on ? selFg.withValues(alpha: 0.35) : borderIdle,
                width: on ? 1.2 : 1,
              ),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontWeight: on ? FontWeight.w900 : FontWeight.w600,
                fontSize: 14,
                letterSpacing: 0.2,
                color: on
                    ? selFg
                    : AppColors.textSecondary.withValues(alpha: 0.82),
              ),
            ),
          ),
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: track,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.cardBorder.withValues(alpha: 0.95),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(3),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            seg('present', 'P', _presentBg, _presentFg),
            seg('absent', 'A', _absentBg, _absentFg),
            seg('late', 'L', _lateBg, _lateFg),
          ],
        ),
      ),
    );
  }
}

class _BulkActionTile extends StatelessWidget {
  const _BulkActionTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.3,
                          ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textSecondary.withValues(alpha: 0.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

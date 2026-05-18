import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/lesson_plan/lesson_plan_period.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';

/// Stage keys for `lesson_plans.teaching_learning_process` (JSONB), aligned with web.
const _tlStageDefs = <(String key, String label)>[
  ('introduction', 'Introduction'),
  ('competence_development', 'Competence Development'),
  ('design_and_realization', 'Design and Realization'),
  ('closure', 'Closure'),
];

/// Lesson plan workflow (UI today; persist when `lesson_plans` gains a status column).
enum LessonPlanWorkflowPhase {
  /// Incomplete or work in progress.
  draft,

  /// All recommended government sections filled on this form.
  ready,

  /// Taught / executed — set elsewhere when backend supports it.
  executed,
}

class TeacherNewLessonPlanScreen extends StatefulWidget {
  const TeacherNewLessonPlanScreen({
    super.key,
    required this.user,
    required this.data,
    this.editSeed,
  });

  final User user;
  final TeacherDeskData data;

  /// When non-null, form updates this lesson plan instead of inserting.
  final TeacherLessonPlanEditSeed? editSeed;

  @override
  State<TeacherNewLessonPlanScreen> createState() =>
      _TeacherNewLessonPlanScreenState();
}

enum _SectionFillStatus { notStarted, inProgress, ready }

/// First-save validation: message, scroll target, optional field highlight id.
class _SaveIssue {
  const _SaveIssue(this.snackbarMessage,
      {this.scrollKey, this.highlightFieldId});

  final String snackbarMessage;
  final GlobalKey? scrollKey;
  final String? highlightFieldId;
}

enum _LeaveChoice { discard, saveDraft }

class _TeacherNewLessonPlanScreenState
    extends State<TeacherNewLessonPlanScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);

  /// Scroll / highlight targets (save UX + optional layout keys).
  final GlobalKey _keyProgressCard = GlobalKey();
  final GlobalKey _keyBasicInfoCard = GlobalKey();
  final GlobalKey _keyDurationField = GlobalKey();
  final GlobalKey _keyMainActivities = GlobalKey();
  final GlobalKey _keySpecificActivities = GlobalKey();
  final GlobalKey _keyTeachingResources = GlobalKey();
  final GlobalKey _keyReferences = GlobalKey();

  late final List<TeacherAssignmentDisplay> _assigns;
  int _assignIx = 0;
  DateTime _lessonDate = DateTime.now();
  final Set<int> _periods = {1};
  int? _durationPreset = 40;
  final _durationCustom = TextEditingController();

  final _mainCompetence = TextEditingController();
  final _specificCompetence = TextEditingController();
  final _mainActivities = TextEditingController();
  final _specificActivities = TextEditingController();
  final _teachingResources = TextEditingController();
  final _references = TextEditingController();
  final _remarks = TextEditingController();

  final Map<String, TextEditingController> _stTime = {};
  final Map<String, TextEditingController> _stTeaching = {};
  final Map<String, TextEditingController> _stLearning = {};
  final Map<String, TextEditingController> _stAssessment = {};

  TeacherLessonPlanClassProfile _profile = TeacherLessonPlanClassProfile.zeros;
  bool _profileLoading = false;
  bool _saving = false;

  /// Temporary highlight after failed save (matches [fieldHighlightId] on inputs).
  String? _validationHighlightFieldId;
  Timer? _validationHighlightClearTimer;

  final ScrollController _scrollController = ScrollController();

  static const int _kRecommendedSectionTotal = 8;

  /// Baseline / last successful save — when different from [_formSignature], form is dirty.
  String? _lastPersistedFormSignature;

  bool _applyingSeed = false;

  void _onFormTextChanged() {
    if (_applyingSeed || !mounted) return;
    setState(() {});
  }

  String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    _assigns = widget.data.assignments
        .where((a) => a.subjectId != null && a.subjectId!.isNotEmpty)
        .toList();
    for (final (k, _) in _tlStageDefs) {
      _stTime[k] = TextEditingController();
      _stTeaching[k] = TextEditingController();
      _stLearning[k] = TextEditingController();
      _stAssessment[k] = TextEditingController();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (widget.editSeed != null) {
        _applyEditSeed(widget.editSeed!);
      } else {
        await _refreshProfile();
      }
      if (!mounted) return;
      setState(() => _lastPersistedFormSignature = _formSignature());
    });
    _durationCustom.addListener(_onFormTextChanged);
    _mainCompetence.addListener(_onFormTextChanged);
    _specificCompetence.addListener(_onFormTextChanged);
    _mainActivities.addListener(_onFormTextChanged);
    _specificActivities.addListener(_onFormTextChanged);
    _teachingResources.addListener(_onFormTextChanged);
    _references.addListener(_onFormTextChanged);
    _remarks.addListener(_onFormTextChanged);
    for (final (k, _) in _tlStageDefs) {
      _stTime[k]!.addListener(_onFormTextChanged);
      _stTeaching[k]!.addListener(_onFormTextChanged);
      _stLearning[k]!.addListener(_onFormTextChanged);
      _stAssessment[k]!.addListener(_onFormTextChanged);
    }
  }

  @override
  void dispose() {
    _validationHighlightClearTimer?.cancel();
    _durationCustom.removeListener(_onFormTextChanged);
    _mainCompetence.removeListener(_onFormTextChanged);
    _specificCompetence.removeListener(_onFormTextChanged);
    _mainActivities.removeListener(_onFormTextChanged);
    _specificActivities.removeListener(_onFormTextChanged);
    _teachingResources.removeListener(_onFormTextChanged);
    _references.removeListener(_onFormTextChanged);
    _remarks.removeListener(_onFormTextChanged);
    for (final (k, _) in _tlStageDefs) {
      _stTime[k]!.removeListener(_onFormTextChanged);
      _stTeaching[k]!.removeListener(_onFormTextChanged);
      _stLearning[k]!.removeListener(_onFormTextChanged);
      _stAssessment[k]!.removeListener(_onFormTextChanged);
    }
    _durationCustom.dispose();
    _mainCompetence.dispose();
    _specificCompetence.dispose();
    _mainActivities.dispose();
    _specificActivities.dispose();
    _teachingResources.dispose();
    _references.dispose();
    _remarks.dispose();
    for (final c in _stTime.values) {
      c.dispose();
    }
    for (final c in _stTeaching.values) {
      c.dispose();
    }
    for (final c in _stLearning.values) {
      c.dispose();
    }
    for (final c in _stAssessment.values) {
      c.dispose();
    }
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _refreshProfile() async {
    if (_assigns.isEmpty) return;
    final a = _assigns[_assignIx];
    final sid = a.subjectId;
    if (sid == null || sid.isEmpty) return;

    setState(() => _profileLoading = true);
    try {
      final p = await _repo.loadLessonPlanClassProfile(
        teacherId: widget.user.id,
        classId: a.classId,
        subjectId: sid,
        assignmentAcademicYear: a.academicYear,
        lessonDateYmd: _ymd(_lessonDate),
      );
      if (!mounted) return;
      setState(() {
        _profile = p;
        _profileLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _profile = TeacherLessonPlanClassProfile.zeros;
        _profileLoading = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _lessonDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (picked == null) return;
    setState(() => _lessonDate = picked);
    await _refreshProfile();
  }

  int _effectiveDurationMinutes() {
    if (_durationPreset != null) return _durationPreset!;
    final v = int.tryParse(_durationCustom.text.trim()) ?? 0;
    return v;
  }

  void _applyEditSeed(TeacherLessonPlanEditSeed seed) {
    _applyingSeed = true;
    try {
      final row = seed.row;
      final classId = '${row['class_id'] ?? ''}';
      final subjectId =
          row['subject_id'] != null ? '${row['subject_id']}' : '';

      var ix = 0;
      for (var i = 0; i < _assigns.length; i++) {
        if (_assigns[i].classId == classId &&
            _assigns[i].subjectId == subjectId) {
          ix = i;
          break;
        }
      }
      if (ix == 0 &&
          _assigns.isNotEmpty &&
          _assigns[0].classId != classId) {
        for (var i = 0; i < _assigns.length; i++) {
          if (_assigns[i].classId == classId) {
            ix = i;
            break;
          }
        }
      }
      _assignIx = ix;

      final ld = row['lesson_date'];
      if (ld != null) {
        final parsed =
            DateTime.tryParse(ld.toString().split('T').first.trim());
        if (parsed != null) _lessonDate = parsed;
      }

      _periods
        ..clear()
        ..addAll(parsePeriodsFromDb(row['period']).toSet());

      final dm = (row['duration_minutes'] is num)
          ? (row['duration_minutes'] as num).toInt()
          : int.tryParse('${row['duration_minutes']}') ?? 40;
      if (kDurationPresets.contains(dm)) {
        _durationPreset = dm;
        _durationCustom.clear();
      } else {
        _durationPreset = null;
        _durationCustom.text = '$dm';
      }

      _mainCompetence.text = '${row['main_competence'] ?? ''}';
      _specificCompetence.text = '${row['specific_competence'] ?? ''}';
      _mainActivities.text = '${row['main_activities'] ?? ''}';
      _specificActivities.text = '${row['specific_activities'] ?? ''}';
      _teachingResources.text = '${row['teaching_resources'] ?? ''}';
      final refRaw = row['references'];
      _references.text =
          refRaw == null ? '' : refRaw is String ? refRaw : '$refRaw';
      _remarks.text = '${row['remarks'] ?? ''}';

      final tlp = row['teaching_learning_process'];
      if (tlp is Map) {
        for (final (k, _) in _tlStageDefs) {
          final stage = tlp[k];
          if (stage is Map) {
            final time = stage['time'];
            _stTime[k]!.text = time == null
                ? ''
                : (time is num ? '$time' : '$time').trim();
            _stTeaching[k]!.text = '${stage['teaching_activities'] ?? ''}';
            _stLearning[k]!.text = '${stage['learning_activities'] ?? ''}';
            _stAssessment[k]!.text = '${stage['assessment_criteria'] ?? ''}';
          } else {
            _stTime[k]!.clear();
            _stTeaching[k]!.clear();
            _stLearning[k]!.clear();
            _stAssessment[k]!.clear();
          }
        }
      } else {
        for (final (k, _) in _tlStageDefs) {
          _stTime[k]!.clear();
          _stTeaching[k]!.clear();
          _stLearning[k]!.clear();
          _stAssessment[k]!.clear();
        }
      }

      final tg = (row['total_girls'] is num)
          ? (row['total_girls'] as num).toInt()
          : int.tryParse('${row['total_girls'] ?? ''}') ?? 0;
      final tb = (row['total_boys'] is num)
          ? (row['total_boys'] as num).toInt()
          : int.tryParse('${row['total_boys'] ?? ''}') ?? 0;
      var tt = (row['total_pupils'] is num)
          ? (row['total_pupils'] as num).toInt()
          : int.tryParse('${row['total_pupils'] ?? ''}') ?? 0;
      if (tt <= 0) tt = tg + tb;
      final pc = (row['present_count'] is num)
          ? (row['present_count'] as num).toInt()
          : int.tryParse('${row['present_count'] ?? ''}') ?? 0;
      final half = pc ~/ 2;
      _profile = TeacherLessonPlanClassProfile(
        registeredGirls: tg,
        registeredBoys: tb,
        registeredTotal: tt,
        presentGirls: pc - half,
        presentBoys: half,
        presentTotal: pc,
      );
      _profileLoading = false;
    } finally {
      _applyingSeed = false;
    }
  }

  void _applyValidationHighlight(String? fieldId) {
    _validationHighlightClearTimer?.cancel();
    setState(() => _validationHighlightFieldId = fieldId);
    if (fieldId == null) return;
    _validationHighlightClearTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _validationHighlightFieldId = null);
    });
  }

  void _scrollIssueIntoView(GlobalKey? key) {
    if (key?.currentContext == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(const Duration(milliseconds: 60), () {
        final ctx = key?.currentContext;
        if (ctx == null || !ctx.mounted) return;
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 340),
          curve: Curves.easeOutCubic,
          alignment: 0.12,
          alignmentPolicy: ScrollPositionAlignmentPolicy.explicit,
        );
      });
    });
  }

  bool _milestoneBasicOk() {
    if (_assigns.isEmpty) return false;
    if (_periods.isEmpty) return false;
    final sorted = _periods.toList()..sort();
    if (!isConsecutivePeriods(sorted)) return false;
    return _effectiveDurationMinutes() >= 1;
  }

  String _formSignature() {
    final p = _periods.toList()..sort();
    final tl = StringBuffer();
    for (final (k, _) in _tlStageDefs) {
      tl
        ..write('|')
        ..write(_stTime[k]!.text)
        ..write('|')
        ..write(_stTeaching[k]!.text)
        ..write('|')
        ..write(_stLearning[k]!.text)
        ..write('|')
        ..write(_stAssessment[k]!.text);
    }
    return [
      _assignIx,
      _ymd(_lessonDate),
      p.join(','),
      '$_durationPreset',
      _durationCustom.text,
      _mainCompetence.text,
      _specificCompetence.text,
      _mainActivities.text,
      _specificActivities.text,
      _teachingResources.text,
      _references.text,
      _remarks.text,
      tl.toString(),
      widget.editSeed?.id ?? 'new',
    ].join('~');
  }

  bool get _hasUnsavedChanges {
    final last = _lastPersistedFormSignature;
    if (last == null) return false;
    return _formSignature() != last;
  }

  /// All recommended government sections filled (informational — does not block save).
  bool get _isReadyForTeaching {
    if (!_milestoneBasicOk()) return false;
    if (widget.editSeed == null && _profileLoading) return false;
    if (_mainCompetence.text.trim().isEmpty ||
        _specificCompetence.text.trim().isEmpty) {
      return false;
    }
    if (_mainActivities.text.trim().isEmpty ||
        _specificActivities.text.trim().isEmpty ||
        _teachingResources.text.trim().isEmpty ||
        _references.text.trim().isEmpty) {
      return false;
    }
    return _tlAllStagesCoreFilled();
  }

  LessonPlanWorkflowPhase get _workflowPhase => _isReadyForTeaching
      ? LessonPlanWorkflowPhase.ready
      : LessonPlanWorkflowPhase.draft;

  int _completedRecommendedMilestones() {
    var n = 0;
    if (_milestoneBasicOk()) n++;
    if (!_profileLoading) n++;
    if (_mainCompetence.text.trim().isNotEmpty) n++;
    if (_specificCompetence.text.trim().isNotEmpty) n++;
    if (_mainActivities.text.trim().isNotEmpty) n++;
    if (_specificActivities.text.trim().isNotEmpty) n++;
    if (_teachingResources.text.trim().isNotEmpty) n++;
    if (_references.text.trim().isNotEmpty) n++;
    return n;
  }

  bool _tlStageCoreFilled(String stageKey) {
    return _stTeaching[stageKey]!.text.trim().isNotEmpty &&
        _stLearning[stageKey]!.text.trim().isNotEmpty &&
        _stAssessment[stageKey]!.text.trim().isNotEmpty;
  }

  bool _tlAnyContent() {
    for (final (k, _) in _tlStageDefs) {
      if (_stTime[k]!.text.trim().isNotEmpty ||
          _stTeaching[k]!.text.trim().isNotEmpty ||
          _stLearning[k]!.text.trim().isNotEmpty ||
          _stAssessment[k]!.text.trim().isNotEmpty) {
        return true;
      }
    }
    return false;
  }

  bool _tlAllStagesCoreFilled() {
    for (final (k, _) in _tlStageDefs) {
      if (!_tlStageCoreFilled(k)) return false;
    }
    return true;
  }

  _SectionFillStatus get _statusBasicSection {
    if (_milestoneBasicOk()) return _SectionFillStatus.ready;
    return _SectionFillStatus.inProgress;
  }

  _SectionFillStatus get _statusClassSection {
    if (_profileLoading) return _SectionFillStatus.inProgress;
    return _SectionFillStatus.ready;
  }

  _SectionFillStatus get _statusCompetencesSection {
    final mc = _mainCompetence.text.trim().isNotEmpty;
    final sc = _specificCompetence.text.trim().isNotEmpty;
    final mainA = _mainActivities.text.trim().isNotEmpty;
    final specA = _specificActivities.text.trim().isNotEmpty;
    final res = _teachingResources.text.trim().isNotEmpty;
    final ref = _references.text.trim().isNotEmpty;
    final allRecommended = mc && sc && mainA && specA && res && ref;
    if (allRecommended) return _SectionFillStatus.ready;
    final any = mc || sc || mainA || specA || res || ref;
    if (any) return _SectionFillStatus.inProgress;
    return _SectionFillStatus.notStarted;
  }

  _SectionFillStatus get _statusTlpSection {
    if (_tlAllStagesCoreFilled()) return _SectionFillStatus.ready;
    if (_tlAnyContent()) return _SectionFillStatus.inProgress;
    return _SectionFillStatus.notStarted;
  }

  _SectionFillStatus get _statusRemarksSection {
    if (_remarks.text.trim().isNotEmpty) return _SectionFillStatus.ready;
    return _SectionFillStatus.notStarted;
  }

  _SaveIssue? _minimumDraftIssue() {
    if (_assigns.isEmpty) {
      return const _SaveIssue(
        'Add a teaching assignment with a linked subject before creating a lesson plan.',
      );
    }
    if (_periods.isEmpty) {
      return _SaveIssue(
        'Please complete period selection.',
        scrollKey: _keyBasicInfoCard,
      );
    }
    final sortedPeriods = _periods.toList()..sort();
    if (!isConsecutivePeriods(sortedPeriods)) {
      return _SaveIssue(
        'Please select consecutive periods.',
        scrollKey: _keyBasicInfoCard,
      );
    }
    final dur = _effectiveDurationMinutes();
    if (dur < 1) {
      return _SaveIssue(
        'Please set a lesson duration of at least one minute.',
        scrollKey:
            _durationPreset == null ? _keyDurationField : _keyBasicInfoCard,
        highlightFieldId: _durationPreset == null ? 'duration' : null,
      );
    }
    return null;
  }

  Map<String, dynamic> _buildTeachingLearningProcess() {
    final out = <String, dynamic>{};
    for (final (k, _) in _tlStageDefs) {
      final tRaw = _stTime[k]!.text.trim();
      num? timeVal;
      if (tRaw.isNotEmpty) {
        final n = num.tryParse(tRaw);
        if (n != null && n.isFinite) {
          timeVal = n;
        }
      }
      out[k] = {
        'time': timeVal,
        'teaching_activities': _stTeaching[k]!.text.trim(),
        'learning_activities': _stLearning[k]!.text.trim(),
        'assessment_criteria': _stAssessment[k]!.text.trim(),
      };
    }
    return out;
  }

  Future<void> _handleLeaveAttempt(bool didPop, Object? result) async {
    if (didPop) return;
    if (!_hasUnsavedChanges) {
      if (mounted) Navigator.of(context).pop(result);
      return;
    }
    final choice = await _showLeaveDraftDialog();
    if (!mounted) return;
    if (choice == _LeaveChoice.saveDraft) {
      final ok = await _persistLessonPlan();
      if (ok && mounted) Navigator.of(context).pop(true);
    } else if (choice == _LeaveChoice.discard) {
      if (mounted) Navigator.of(context).pop(result ?? false);
    }
  }

  void _onPopInvoked(bool didPop, Object? result) {
    unawaited(_handleLeaveAttempt(didPop, result));
  }

  Future<_LeaveChoice?> _showLeaveDraftDialog() {
    return showDialog<_LeaveChoice>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save draft before leaving?'),
        content: const Text(
          'You have unsaved changes. Save a draft to keep your work, or discard to leave without saving.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, _LeaveChoice.discard),
            child: const Text('Discard'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, _LeaveChoice.saveDraft),
            child: const Text('Save draft'),
          ),
        ],
      ),
    );
  }

  /// Inserts a new lesson plan row. Same payload keys as web; empty fields store as ''.
  /// When backend adds workflow columns, extend here (no key renames).
  Future<bool> _persistLessonPlan() async {
    final issue = _minimumDraftIssue();
    if (issue != null) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(issue.snackbarMessage)),
      );
      _scrollIssueIntoView(issue.scrollKey);
      _applyValidationHighlight(issue.highlightFieldId);
      return false;
    }
    _applyValidationHighlight(null);
    if (_saving) return false;
    setState(() => _saving = true);
    try {
      final a = _assigns[_assignIx];
      final sid = a.subjectId!;
      final periodStr = periodsToStorageString(_periods.toList());
      final dur = _effectiveDurationMinutes();

      final payload = <String, dynamic>{
        'class_id': a.classId,
        'subject_id': sid,
        'lesson_date': _ymd(_lessonDate),
        'period': periodStr,
        'duration_minutes': dur,
        'total_boys': _profile.registeredBoys,
        'total_girls': _profile.registeredGirls,
        'total_pupils': _profile.registeredTotal,
        'present_count': _profile.presentTotal,
        'main_competence': _mainCompetence.text.trim(),
        'specific_competence': _specificCompetence.text.trim(),
        'main_activities': _mainActivities.text.trim(),
        'specific_activities': _specificActivities.text.trim(),
        'teaching_resources': _teachingResources.text.trim(),
        'references': _references.text.trim(),
        'remarks': _remarks.text.trim(),
        'teaching_learning_process': _buildTeachingLearningProcess(),
      };

      final edit = widget.editSeed;
      if (edit != null) {
        await _repo.updateLessonPlan(
          id: edit.id,
          teacherId: widget.user.id,
          patch: payload,
        );
      } else {
        await _repo.insertLessonPlan(
          teacherId: widget.user.id,
          payload: payload,
        );
      }
      if (!mounted) return false;
      if (edit != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lesson plan updated.')),
        );
      } else {
        final ready = _isReadyForTeaching;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              ready
                  ? 'Lesson plan saved.'
                  : 'Lesson plan saved as draft. You can complete remaining sections later.',
            ),
          ),
        );
      }
      setState(() => _lastPersistedFormSignature = _formSignature());
      return true;
    } catch (e) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyDataLoadError(e))),
      );
      return false;
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _save() async {
    final ok = await _persistLessonPlan();
    if (!mounted || !ok) return;
    Navigator.of(context).pop(true);
  }

  static const double _inputRadius = 12;

  /// Space so the last field clears the sticky save bar + keyboard.
  static const double _saveBarScrollReserve = 132;

  /// Extra space when scrolling a focused field above keyboard (+ save bar when visible).
  EdgeInsets _fieldScrollPadding(BuildContext context) {
    final mq = MediaQuery.of(context);
    final keyboardOpen = mq.viewInsets.bottom > 0;
    final saveReserve = keyboardOpen ? 0.0 : _saveBarScrollReserve;
    return EdgeInsets.fromLTRB(
      0,
      88,
      0,
      saveReserve + mq.viewInsets.bottom + mq.padding.bottom + 48,
    );
  }

  void _scrollFocusedIntoView(BuildContext fieldContext) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(const Duration(milliseconds: 90), () {
        if (!fieldContext.mounted) return;
        Scrollable.ensureVisible(
          fieldContext,
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOutCubic,
          alignment: 0.18,
          alignmentPolicy: ScrollPositionAlignmentPolicy.explicit,
        );
      });
    });
  }

  /// Keeps multiline fields visible above the keyboard (and save bar when shown).
  Widget _keyboardAwareTextField(
    BuildContext context, {
    required TextEditingController controller,
    required String label,
    String? hint,
    String? fieldHighlightId,
    int? maxLines,
    TextInputType? keyboardType,
  }) {
    return Builder(
      builder: (ctx) {
        return Focus(
          onFocusChange: (hasFocus) {
            if (hasFocus) {
              _scrollFocusedIntoView(ctx);
            }
          },
          child: TextField(
            controller: controller,
            decoration: _inputDec(
              context,
              label,
              hint: hint,
              fieldHighlightId: fieldHighlightId,
            ),
            maxLines: maxLines,
            keyboardType: keyboardType,
            scrollPadding: _fieldScrollPadding(context),
          ),
        );
      },
    );
  }

  Widget _progressHeaderCard(BuildContext context) {
    final done = _completedRecommendedMilestones();
    const total = _kRecommendedSectionTotal;
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final fill = dark
        ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.32)
        : AppColors.indigoWash;
    final borderColor =
        AppColors.cardBorder.withValues(alpha: dark ? 0.38 : 0.65);
    final frac = (done / total).clamp(0.0, 1.0);
    final workflowLine = switch (_workflowPhase) {
      LessonPlanWorkflowPhase.ready => 'Ready for teaching',
      LessonPlanWorkflowPhase.draft => 'Draft in progress',
      LessonPlanWorkflowPhase.executed => 'Completed',
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      color: fill,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: borderColor),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Lesson plan progress',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '$done of $total recommended sections completed',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              workflowLine,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.primary.withValues(alpha: dark ? 0.92 : 0.88),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'You can save and continue later. Lesson plans may be completed before, during, or after lesson delivery.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary.withValues(alpha: 0.88),
                height: 1.35,
                fontSize: 12.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Mark as completed after teaching (sync coming soon).',
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppColors.textSecondary.withValues(alpha: 0.72),
                letterSpacing: 0.1,
              ),
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: frac,
                minHeight: 6,
                backgroundColor:
                    AppColors.cardBorder.withValues(alpha: dark ? 0.35 : 0.5),
                color: AppColors.primary.withValues(alpha: dark ? 0.82 : 0.88),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionStatusPill(BuildContext context, _SectionFillStatus s) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final (String label, Color bg, Color fg) = switch (s) {
      _SectionFillStatus.notStarted => (
          'Not started',
          AppColors.cardBorder.withValues(alpha: dark ? 0.32 : 0.40),
          AppColors.textSecondary,
        ),
      _SectionFillStatus.inProgress => (
          'In progress',
          AppColors.primary.withValues(alpha: dark ? 0.22 : 0.12),
          AppColors.primary.withValues(alpha: dark ? 0.96 : 0.90),
        ),
      _SectionFillStatus.ready => (
          'Ready',
          AppColors.primary.withValues(alpha: dark ? 0.32 : 0.16),
          AppColors.primaryDark.withValues(alpha: dark ? 0.98 : 0.95),
        ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: AppColors.cardBorder.withValues(alpha: dark ? 0.45 : 0.58),
        ),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
          fontSize: 11,
          letterSpacing: 0.15,
        ),
      ),
    );
  }

  Widget _assistantSectionCard(
    BuildContext context, {
    required String title,
    String? helperText,
    required _SectionFillStatus status,
    required List<Widget> children,
  }) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: AppColors.cardBorder.withValues(
            alpha: dark ? 0.38 : 0.65,
          ),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                  ),
                ),
                const SizedBox(width: 8),
                _sectionStatusPill(context, status),
              ],
            ),
            if (helperText != null) ...[
              const SizedBox(height: 6),
              Text(
                helperText,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.35,
                    ),
              ),
            ],
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDec(
    BuildContext context,
    String label, {
    String? hint,
    String? fieldHighlightId,
  }) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final borderColor =
        AppColors.cardBorder.withValues(alpha: dark ? 0.42 : 0.72);
    final fill = dark
        ? cs.surfaceContainerHighest.withValues(alpha: 0.28)
        : const Color(0xFFF8FAFC);
    final radius = BorderRadius.circular(_inputRadius);
    OutlineInputBorder oBorder(Color color, {double width = 1}) =>
        OutlineInputBorder(
          borderRadius: radius,
          borderSide: BorderSide(color: color, width: width),
        );
    final showHighlight = fieldHighlightId != null &&
        fieldHighlightId == _validationHighlightFieldId;
    final edgeColor = showHighlight
        ? AppColors.primary.withValues(alpha: dark ? 0.85 : 0.78)
        : borderColor;
    final edgeWidth = showHighlight ? 2.0 : 1.0;
    return InputDecoration(
      labelText: label,
      hintText: hint,
      alignLabelWithHint: true,
      filled: true,
      fillColor: fill,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      floatingLabelBehavior: FloatingLabelBehavior.auto,
      labelStyle: theme.textTheme.labelLarge?.copyWith(
        color: AppColors.textSecondary.withValues(alpha: dark ? 0.72 : 0.88),
        fontWeight: FontWeight.w600,
        fontSize: 13,
      ),
      hintStyle: theme.textTheme.bodyMedium?.copyWith(
        color: AppColors.textSecondary.withValues(alpha: 0.45),
        fontSize: 14,
      ),
      enabledBorder: oBorder(edgeColor, width: edgeWidth),
      focusedBorder: oBorder(
        AppColors.primary.withValues(alpha: dark ? 0.88 : 0.82),
        width: showHighlight ? 2.0 : 1.5,
      ),
      errorBorder: oBorder(cs.error.withValues(alpha: 0.65)),
      focusedErrorBorder: oBorder(cs.error, width: 1.5),
      border: oBorder(edgeColor, width: edgeWidth),
    );
  }

  Widget _tlStageBlock(
    BuildContext context, {
    required String stageKey,
    required String label,
    required bool showTopDivider,
  }) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final accent = AppColors.primary.withValues(alpha: dark ? 0.45 : 0.35);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showTopDivider) ...[
          Divider(
            height: 20,
            thickness: 1,
            color: AppColors.cardBorder.withValues(alpha: dark ? 0.35 : 0.55),
          ),
        ],
        DecoratedBox(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(color: accent, width: 3),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.only(left: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.1,
                      ),
                ),
                const SizedBox(height: 6),
                _keyboardAwareTextField(
                  context,
                  controller: _stTime[stageKey]!,
                  label: 'Time (minutes)',
                  hint: 'Minutes for this stage.',
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 8),
                _keyboardAwareTextField(
                  context,
                  controller: _stTeaching[stageKey]!,
                  label: 'Teaching Activities',
                  hint: 'Describe teaching activities.',
                  maxLines: 3,
                ),
                const SizedBox(height: 8),
                _keyboardAwareTextField(
                  context,
                  controller: _stLearning[stageKey]!,
                  label: 'Learning Activities',
                  hint: 'Describe learning activities.',
                  maxLines: 3,
                ),
                const SizedBox(height: 8),
                _keyboardAwareTextField(
                  context,
                  controller: _stAssessment[stageKey]!,
                  label: 'Assessment Criteria',
                  hint: 'State assessment criteria.',
                  maxLines: 3,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_assigns.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('New lesson plan')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Lesson plans need a catalog subject link on at least one assignment.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final a = _assigns[_assignIx];
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    final keyboardOpen = keyboardInset > 0;
    final scrollBottomPad = keyboardOpen
        ? keyboardInset + bottomInset + 72
        : _saveBarScrollReserve + bottomInset + 28;

    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: _onPopInvoked,
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        appBar: AppBar(
          title: Text(
            widget.editSeed != null ? 'Edit lesson plan' : 'New lesson plan',
          ),
        ),
        body: ListView(
          controller: _scrollController,
          padding: EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            8,
            TeacherUiTokens.horizontalPadding,
            scrollBottomPad,
          ),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          children: [
            KeyedSubtree(
              key: _keyProgressCard,
              child: _progressHeaderCard(context),
            ),
            KeyedSubtree(
              key: _keyBasicInfoCard,
              child: _assistantSectionCard(
                context,
                title: 'Basic information',
                helperText:
                    'Choose the class, subject, date, period, and lesson duration.',
                status: _statusBasicSection,
                children: [
                  DropdownButtonFormField<int>(
                    value: _assignIx,
                    decoration: _inputDec(context, 'Class & subject'),
                    items: [
                      for (var i = 0; i < _assigns.length; i++)
                        DropdownMenuItem(
                          value: i,
                          child: Text(
                            '${_assigns[i].className} · ${_assigns[i].subjectLabel}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (v) async {
                      if (v == null) return;
                      setState(() => _assignIx = v);
                      await _refreshProfile();
                    },
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: const Text('Date'),
                    subtitle: Text(_ymd(_lessonDate)),
                    trailing: const Icon(Icons.event_rounded),
                    onTap: _pickDate,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Period (select one or more consecutive periods)',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final n in kLessonPlanPeriodCheckboxRange)
                        FilterChip(
                          label: Text('$n'),
                          selected: _periods.contains(n),
                          onSelected: (sel) {
                            setState(() {
                              if (sel) {
                                _periods.add(n);
                              } else {
                                _periods.remove(n);
                                if (_periods.isEmpty) {
                                  _periods.add(1);
                                }
                              }
                            });
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Stored as: ${periodsToStorageString(_periods.toList())}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Duration (minutes)',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final d in kDurationPresets)
                        ChoiceChip(
                          label: Text('$d'),
                          selected: _durationPreset == d,
                          onSelected: (_) {
                            setState(() {
                              _durationPreset = d;
                              _durationCustom.clear();
                            });
                          },
                        ),
                      ChoiceChip(
                        label: const Text('Other'),
                        selected: _durationPreset == null,
                        onSelected: (_) {
                          setState(() {
                            _durationPreset = null;
                            if (_durationCustom.text.trim().isEmpty) {
                              _durationCustom.text = '40';
                            }
                          });
                        },
                      ),
                    ],
                  ),
                  if (_durationPreset == null) ...[
                    const SizedBox(height: 8),
                    KeyedSubtree(
                      key: _keyDurationField,
                      child: _keyboardAwareTextField(
                        context,
                        controller: _durationCustom,
                        label: 'Custom duration (minutes)',
                        fieldHighlightId: 'duration',
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            _assistantSectionCard(
              context,
              title: 'Class profile',
              helperText: 'Auto-filled from enrollment and attendance.',
              status: _statusClassSection,
              children: [
                if (_profileLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  Text(
                    'Registered pupils',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text('Girls: ${_profile.registeredGirls}'),
                  Text('Boys: ${_profile.registeredBoys}'),
                  Text('Total: ${_profile.registeredTotal}'),
                  const SizedBox(height: 8),
                  Text(
                    'Present pupils',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text('Girls: ${_profile.presentGirls}'),
                  Text('Boys: ${_profile.presentBoys}'),
                  Text('Total: ${_profile.presentTotal}'),
                  const SizedBox(height: 6),
                  Text(
                    'Auto-filled from enrolment and attendance for ${a.className} on ${_ymd(_lessonDate)}.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
            _assistantSectionCard(
              context,
              title: 'Competences, activities & resources',
              helperText:
                  'Fill the official lesson objectives, activities, resources, and references.',
              status: _statusCompetencesSection,
              children: [
                _keyboardAwareTextField(
                  context,
                  controller: _mainCompetence,
                  label: 'Main competence',
                  hint: 'Enter the main competence.',
                  maxLines: 4,
                ),
                const SizedBox(height: 8),
                _keyboardAwareTextField(
                  context,
                  controller: _specificCompetence,
                  label: 'Specific competence',
                  hint: 'Enter the specific competence.',
                  maxLines: 4,
                ),
                const SizedBox(height: 8),
                KeyedSubtree(
                  key: _keyMainActivities,
                  child: _keyboardAwareTextField(
                    context,
                    controller: _mainActivities,
                    label: 'Main Activities',
                    hint: 'Describe the main activities.',
                    fieldHighlightId: 'mainActivities',
                    maxLines: 4,
                  ),
                ),
                const SizedBox(height: 8),
                KeyedSubtree(
                  key: _keySpecificActivities,
                  child: _keyboardAwareTextField(
                    context,
                    controller: _specificActivities,
                    label: 'Specific Activities',
                    hint: 'Describe the specific activities.',
                    fieldHighlightId: 'specificActivities',
                    maxLines: 4,
                  ),
                ),
                const SizedBox(height: 8),
                KeyedSubtree(
                  key: _keyTeachingResources,
                  child: _keyboardAwareTextField(
                    context,
                    controller: _teachingResources,
                    label: 'Teaching and Learning Resources',
                    hint: 'List teaching and learning resources.',
                    fieldHighlightId: 'teachingResources',
                    maxLines: 4,
                  ),
                ),
                const SizedBox(height: 8),
                KeyedSubtree(
                  key: _keyReferences,
                  child: _keyboardAwareTextField(
                    context,
                    controller: _references,
                    label: 'References',
                    hint: 'List references.',
                    fieldHighlightId: 'references',
                    maxLines: 4,
                  ),
                ),
              ],
            ),
            _assistantSectionCard(
              context,
              title: 'Teaching and Learning Process',
              helperText:
                  'Complete each lesson stage using the official format.',
              status: _statusTlpSection,
              children: [
                for (var i = 0; i < _tlStageDefs.length; i++)
                  _tlStageBlock(
                    context,
                    stageKey: _tlStageDefs[i].$1,
                    label: _tlStageDefs[i].$2,
                    showTopDivider: i > 0,
                  ),
              ],
            ),
            _assistantSectionCard(
              context,
              title: 'Remarks',
              helperText: 'Optional teacher reflection or evaluation.',
              status: _statusRemarksSection,
              children: [
                _keyboardAwareTextField(
                  context,
                  controller: _remarks,
                  label: 'Remarks / evaluation',
                  hint: 'Optional remarks or evaluation.',
                  maxLines: 4,
                ),
              ],
            ),
          ],
        ),
        bottomNavigationBar: keyboardOpen
            ? null
            : Material(
                elevation: 6,
                shadowColor: Colors.black.withValues(alpha: 0.12),
                color: Theme.of(context).colorScheme.surface,
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color:
                                        Theme.of(context).colorScheme.onPrimary,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'Saving lesson plan...',
                                  style: TextStyle(
                                    color:
                                        Theme.of(context).colorScheme.onPrimary,
                                  ),
                                ),
                              ],
                            )
                          : const Text('Save lesson plan'),
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

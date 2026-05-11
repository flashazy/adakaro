import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/parent_ui_tokens.dart';
import '../../../data/models/parent_overview.dart';
import '../../../data/models/student_profile_extra_data.dart';
import '../../../data/models/student_summary.dart';
import '../../../data/parent_data_repository.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/student_avatar.dart';
import '../parent_child_picker_sheet.dart';
import '../student_profile_hub_tabs.dart';

/// Bottom-nav Messages: same child + teacher messaging as Home → Messages.
class ParentMessagesTab extends StatefulWidget {
  const ParentMessagesTab({
    super.key,
    required this.overview,
    required this.parentUserId,
    required this.reloadGeneration,
    required this.isVisible,
  });

  final ParentOverview overview;
  final String parentUserId;

  /// Bumps whenever [ParentMainScaffold] finishes a successful overview refresh.
  final int reloadGeneration;

  /// True when this tab is the selected bottom-nav destination.
  final bool isVisible;

  @override
  State<ParentMessagesTab> createState() => _ParentMessagesTabState();
}

class _ParentMessagesTabState extends State<ParentMessagesTab> {
  StudentSummary? _student;
  StudentProfileExtraData? _extra;
  bool _loadingExtra = false;
  bool _pickerInFlight = false;
  bool _openingPickerScheduled = false;

  List<StudentSummary> get _students => widget.overview.students;

  @override
  void initState() {
    super.initState();
    _syncStudentFromOverview();
  }

  @override
  void didUpdateWidget(covariant ParentMessagesTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    final becameVisible = !oldWidget.isVisible && widget.isVisible;

    if (becameVisible) {
      _syncStudentFromOverview();
      if (_students.length > 1 && _student == null) {
        _openingPickerScheduled = true;
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _bootstrapPickerIfNeeded());
      }
    }

    if (oldWidget.reloadGeneration != widget.reloadGeneration &&
        _student != null) {
      _loadExtra();
    }

    final oldIdSet = oldWidget.overview.students.map((s) => s.id).toSet();
    final newIdSet = _students.map((s) => s.id).toSet();
    final rosterDifferent = oldIdSet != newIdSet;

    if (!rosterDifferent) return;

    if (_student != null && !newIdSet.contains(_student!.id)) {
      setState(() {
        _student = null;
        _extra = null;
      });
    }
    _syncStudentFromOverview();
    if (_students.length > 1 && _student == null && widget.isVisible) {
      _openingPickerScheduled = true;
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _bootstrapPickerIfNeeded());
    }
  }

  void _syncStudentFromOverview() {
    final list = _students;
    if (list.length != 1) return;
    if (_student?.id != list.single.id) {
      setState(() => _student = list.single);
      _loadExtra();
    }
  }

  Future<void> _bootstrapPickerIfNeeded() async {
    if (!mounted || !widget.isVisible) return;
    if (_students.length <= 1 || _student != null) {
      if (_openingPickerScheduled) {
        setState(() => _openingPickerScheduled = false);
      }
      return;
    }
    await _runChildPicker();
  }

  Future<void> _runChildPicker() async {
    if (_students.isEmpty || !mounted || _pickerInFlight || !widget.isVisible) {
      return;
    }
    _openingPickerScheduled = false;
    _pickerInFlight = true;
    setState(() {});
    StudentSummary? picked;
    try {
      picked = await showParentChildPicker(
        context,
        students: _students,
        subtitle: 'Messages',
      );
    } finally {
      _pickerInFlight = false;
    }
    if (!mounted) return;
    setState(() {
      if (picked != null) {
        _student = picked;
      }
    });
    if (picked != null) {
      _loadExtra();
    } else {
      setState(() {});
    }
  }

  Future<void> _loadExtra() async {
    final student = _student;
    if (student == null) return;
    setState(() => _loadingExtra = true);
    try {
      final repo = ParentDataRepository(Supabase.instance.client);
      final data = await repo.loadStudentProfileExtra(
        parentId: widget.parentUserId,
        studentId: student.id,
        classId: student.classId,
      );
      if (!mounted) return;
      setState(() {
        _extra = data;
        _loadingExtra = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _extra = const StudentProfileExtraData(
          attendance: [],
          reportCards: [],
          reportComments: [],
          messages: [],
        );
        _loadingExtra = false;
      });
    }
  }

  Widget _childBanner(BuildContext context, StudentSummary student) {
    final school = student.schoolName?.trim();
    final cls = student.className?.trim();
    return Material(
      color: Colors.white,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 10, 12, 12),
        decoration: BoxDecoration(
          border: Border(
            bottom:
                BorderSide(color: AppColors.cardBorder.withValues(alpha: 0.35)),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StudentAvatar(
              radius: 22,
              imageUrl: student.avatarUrl,
              fallbackName: student.fullName,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    student.fullName,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                  ),
                  if (school != null && school.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      school,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                  if (cls != null && cls.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      cls,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color:
                                AppColors.textSecondary.withValues(alpha: 0.85),
                          ),
                    ),
                  ],
                ],
              ),
            ),
            if (_students.length > 1)
              TextButton(
                onPressed: _runChildPicker,
                style: TextButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Switch'),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isVisible) {
      return const SizedBox.shrink();
    }

    if (_students.isEmpty) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: ParentUiTokens.horizontalPadding,
            ).copyWith(top: 48),
            child: EmptyState(
              icon: Icons.family_restroom_rounded,
              title: 'No students linked yet',
              message:
                  'When your school links a student to your account, you can message their teacher here.',
            ),
          ),
        ],
      );
    }

    if (_students.length > 1 &&
        _student == null &&
        (_openingPickerScheduled || _pickerInFlight)) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_students.length > 1 && _student == null) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: ParentUiTokens.horizontalPadding,
            ).copyWith(top: 48),
            child: EmptyState(
              icon: Icons.people_outline_rounded,
              title: 'Choose a student',
              message:
                  'Pick which child to open teacher messages for. You can switch anytime.',
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: FilledButton.icon(
              onPressed: _runChildPicker,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: const Text('Select child'),
            ),
          ),
        ],
      );
    }

    final student = _student;
    final extra = _extra ??
        const StudentProfileExtraData(
          attendance: [],
          reportCards: [],
          reportComments: [],
          messages: [],
        );

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _childBanner(context, student),
        Expanded(
          child: ProfileMessagesTab(
            parentUserId: widget.parentUserId,
            extra: extra,
            loadingExtra: _loadingExtra,
            onSent: _loadExtra,
          ),
        ),
      ],
    );
  }
}

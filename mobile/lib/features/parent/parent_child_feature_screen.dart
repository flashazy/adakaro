import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models/fee_balance_row.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/student_profile_extra_data.dart';
import '../../data/models/student_summary.dart';
import '../../data/parent_data_repository.dart';
import '../../widgets/student_avatar.dart';
import 'parent_quick_action.dart';
import 'student_profile_hub_tabs.dart';
import 'student_profile_screen.dart';

/// Single-feature view for one child (opened from the home icon grid).
/// Reuses the same tab bodies as [StudentProfileScreen] without horizontal tabs.
class ParentChildFeatureScreen extends StatefulWidget {
  const ParentChildFeatureScreen({
    super.key,
    required this.parentUserId,
    required this.student,
    required this.balances,
    required this.recentPayments,
    required this.feature,
  });

  final String parentUserId;
  final StudentSummary student;
  final List<FeeBalanceRow> balances;
  final List<PaymentRow> recentPayments;
  final ParentQuickAction feature;

  @override
  State<ParentChildFeatureScreen> createState() =>
      _ParentChildFeatureScreenState();
}

class _ParentChildFeatureScreenState extends State<ParentChildFeatureScreen> {
  StudentProfileExtraData? _extra;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final repo = ParentDataRepository(Supabase.instance.client);
      final data = await repo.loadStudentProfileExtra(
        parentId: widget.parentUserId,
        studentId: widget.student.id,
        classId: widget.student.classId,
      );
      if (!mounted) return;
      setState(() {
        _extra = data;
        _loading = false;
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
        _loading = false;
      });
    }
  }

  Widget _featureBody(StudentProfileExtraData? extra) {
    switch (widget.feature) {
      case ParentQuickAction.attendance:
        return ProfileAttendanceTab(
          records: extra?.attendance ?? const [],
          loading: _loading,
        );
      case ParentQuickAction.subjectResults:
        return ProfileSubjectResultsTab(
          reportCards: extra?.reportCards ?? const [],
          comments: extra?.reportComments ?? const [],
          loading: _loading,
        );
      case ParentQuickAction.examResults:
        return ProfileExamResultsTab(
          student: widget.student,
          balances: widget.balances,
          cards: extra?.reportCards ?? const [],
          comments: extra?.reportComments ?? const [],
          loading: _loading,
        );
      case ParentQuickAction.reportCards:
        return ProfileReportCardsTab(
          student: widget.student,
          balances: widget.balances,
          cards: extra?.reportCards ?? const [],
          comments: extra?.reportComments ?? const [],
          loading: _loading,
        );
      case ParentQuickAction.fees:
        return ProfileFeesTab(
          student: widget.student,
          balances: widget.balances,
          payments: widget.recentPayments,
        );
      case ParentQuickAction.messages:
        return ProfileMessagesTab(
          parentUserId: widget.parentUserId,
          extra: extra ??
              const StudentProfileExtraData(
                attendance: [],
                reportCards: [],
                reportComments: [],
                messages: [],
              ),
          loadingExtra: _loading,
          onSent: _load,
        );
      case ParentQuickAction.paymentsReceipts:
      case ParentQuickAction.profile:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.feature.title;
    final extra = _extra;
    final isMessages = widget.feature == ParentQuickAction.messages;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Text(title),
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ChildContextBanner(student: widget.student),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => StudentProfileScreen(
                      parentUserId: widget.parentUserId,
                      student: widget.student,
                      balances: widget.balances,
                      recentPayments: widget.recentPayments,
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.dashboard_customize_outlined),
              label: const Text('Open full student profile'),
            ),
          ),
          Expanded(
            child: isMessages
                ? _featureBody(extra)
                : RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: _load,
                    child: _featureBody(extra),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ChildContextBanner extends StatelessWidget {
  const _ChildContextBanner({required this.student});

  final StudentSummary student;

  @override
  Widget build(BuildContext context) {
    final school = student.schoolName?.trim();
    final cls = student.className?.trim();
    return Material(
      color: Colors.white,
      elevation: 0,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Color(0xFFE2E8F0)),
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
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  const SizedBox(height: 4),
                  if (school != null && school.isNotEmpty)
                    Text(
                      school,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  if (cls != null && cls.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      cls,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/fee_balance_row.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/student_profile_extra_data.dart';
import '../../data/models/student_summary.dart';
import '../../data/parent_data_repository.dart';
import '../../widgets/status_chip.dart';
import '../../widgets/student_avatar.dart';
import '../../core/currency_format.dart';
import 'student_profile_hub_tabs.dart';

/// Full student hub: tabs for overview, attendance, results, report cards, fees, messages.
class StudentProfileScreen extends StatefulWidget {
  const StudentProfileScreen({
    super.key,
    required this.parentUserId,
    required this.student,
    required this.balances,
    required this.recentPayments,
  });

  final String parentUserId;
  final StudentSummary student;
  final List<FeeBalanceRow> balances;
  final List<PaymentRow> recentPayments;

  @override
  State<StudentProfileScreen> createState() => _StudentProfileScreenState();
}

class _StudentProfileScreenState extends State<StudentProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  StudentProfileExtraData? _extra;
  bool _loadingExtra = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
    _loadExtra();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadExtra() async {
    setState(() => _loadingExtra = true);
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

  @override
  Widget build(BuildContext context) {
    final totalDue =
        widget.balances.fold<double>(0, (a, b) => a + b.balance);
    final extra = _extra;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Student'),
        surfaceTintColor: Colors.transparent,
      ),
      body: Column(
        children: [
          _ProfileHero(student: widget.student, totalDue: totalDue),
          Material(
            color: Colors.white,
            child: TabBar(
              controller: _tabController,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textSecondary,
              indicatorColor: AppColors.primary,
              indicatorWeight: 3,
              labelStyle: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
              tabs: const [
                Tab(text: 'Overview'),
                Tab(text: 'Attendance'),
                Tab(text: 'Results'),
                Tab(text: 'Reports'),
                Tab(text: 'Fees'),
                Tab(text: 'Messages'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                ProfileOverviewTab(
                  student: widget.student,
                  balances: widget.balances,
                  extra: extra,
                  loadingExtra: _loadingExtra,
                ),
                ProfileAttendanceTab(
                  records: extra?.attendance ?? const [],
                  loading: _loadingExtra,
                ),
                ProfileResultsTab(
                  comments: extra?.reportComments ?? const [],
                  loading: _loadingExtra,
                ),
                ProfileReportCardsTab(
                  cards: extra?.reportCards ?? const [],
                  comments: extra?.reportComments ?? const [],
                  loading: _loadingExtra,
                ),
                ProfileFeesTab(
                  student: widget.student,
                  balances: widget.balances,
                  payments: widget.recentPayments,
                ),
                ProfileMessagesTab(
                  parentUserId: widget.parentUserId,
                  extra: extra ??
                      const StudentProfileExtraData(
                        attendance: [],
                        reportCards: [],
                        reportComments: [],
                        messages: [],
                      ),
                  loadingExtra: _loadingExtra,
                  onSent: _loadExtra,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.student,
    required this.totalDue,
  });

  final StudentSummary student;
  final double totalDue;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
      decoration: BoxDecoration(
        gradient: ParentUiTokens.profileHeaderGradient,
        borderRadius: BorderRadius.circular(ParentUiTokens.radiusLg),
        boxShadow: ParentUiTokens.cardShadow,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.22),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: StudentAvatar(
              radius: 40,
              imageUrl: student.avatarUrl,
              fallbackName: student.fullName,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            student.fullName,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.4,
                ),
          ),
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              _HeroChip(
                icon: Icons.school_rounded,
                label: student.schoolName?.trim().isNotEmpty == true
                    ? student.schoolName!.trim()
                    : 'School',
              ),
              if (student.className?.trim().isNotEmpty == true)
                _HeroChip(
                  icon: Icons.class_rounded,
                  label: student.className!.trim(),
                ),
              if (student.admissionNumber?.trim().isNotEmpty == true)
                _HeroChip(
                  icon: Icons.badge_outlined,
                  label: 'Adm. ${student.admissionNumber}',
                  mono: true,
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (totalDue > 0)
            StatusChip.balanceDue(
              '${formatCurrency(totalDue, student.currencyCode)} balance',
            )
          else
            StatusChip.paidUp(),
        ],
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({
    required this.icon,
    required this.label,
    this.mono = false,
  });

  final IconData icon;
  final String label;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Colors.white.withValues(alpha: 0.95)),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 220),
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.95),
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                    fontFamily: mono ? 'monospace' : null,
                    fontSize: mono ? 12 : null,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

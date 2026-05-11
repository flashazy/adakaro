import 'package:flutter/material.dart';

import '../../../data/models/parent_overview.dart';
import '../../../data/models/student_summary.dart';
import '../parent_home_dashboard.dart';
import '../parent_quick_action.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({
    super.key,
    required this.overview,
    required this.onOpenStudent,
    required this.onNavigateToTab,
    required this.onRefresh,
    required this.onQuickAction,
    required this.effectiveSeenAt,
    this.refreshError,
  });

  final ParentOverview overview;
  final void Function(StudentSummary) onOpenStudent;
  final void Function(int tabIndex) onNavigateToTab;
  final Future<void> Function() onRefresh;
  final void Function(ParentQuickAction action) onQuickAction;
  final Map<ParentQuickAction, DateTime?> effectiveSeenAt;
  final String? refreshError;

  @override
  Widget build(BuildContext context) {
    return ParentHomeDashboard(
      overview: overview,
      refreshError: refreshError,
      onRefresh: onRefresh,
      onOpenStudentProfile: onOpenStudent,
      onQuickAction: onQuickAction,
      effectiveSeenAt: effectiveSeenAt,
    );
  }
}

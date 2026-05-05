import 'package:flutter/material.dart';

import '../../../core/currency_format.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/parent_ui_tokens.dart';
import '../../../data/models/parent_overview.dart';
import '../../../data/models/student_summary.dart';
import '../../../widgets/data_error_banner.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/status_chip.dart';
import '../../../widgets/student_avatar.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({
    super.key,
    required this.overview,
    required this.onOpenStudent,
    required this.onNavigateToTab,
    required this.onRefresh,
    this.refreshError,
  });

  final ParentOverview overview;
  final void Function(StudentSummary) onOpenStudent;
  final void Function(int tabIndex) onNavigateToTab;
  final Future<void> Function() onRefresh;
  final String? refreshError;

  @override
  Widget build(BuildContext context) {
    final students = overview.students;
    final stById = {for (final s in students) s.id: s};

    final byCode = <String, _Totals>{};
    for (final b in overview.balances) {
      final st = stById[b.studentId];
      if (st == null) continue;
      final c = normalizeSchoolCurrency(st.currencyCode);
      byCode.putIfAbsent(c, _Totals.new);
      final t = byCode[c]!;
      t.fees += b.totalFee;
      t.paid += b.totalPaid;
      t.balance += b.balance;
    }

    final codes = byCode.keys.toList()..sort();
    final single = codes.length == 1 ? codes.first : null;
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          ParentUiTokens.horizontalPadding,
          12,
          ParentUiTokens.horizontalPadding,
          108,
        ),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (refreshError != null) ...[
            DataErrorBanner(
              message: refreshError!,
              onRetry: onRefresh,
            ),
            const SizedBox(height: 16),
          ],
          _WelcomeHeaderCard(
            profileName: overview.profileName,
            childCount: students.length,
          ),
          const SizedBox(height: 20),
          if (students.isEmpty)
            EmptyState(
              icon: Icons.family_restroom_rounded,
              title: 'No students linked yet',
              message:
                  'Ask your school to link your account to your children, or use the Adakaro website to submit a link request with your child\'s admission number.',
            )
          else ...[
            if (single != null)
              _SummaryHero(
                childCount: students.length,
                currency: single,
                totals: byCode[single]!,
              )
            else
              _MultiCurrencyHint(childCount: students.length),
            const SizedBox(height: 24),
            Row(
              children: [
                Icon(Icons.groups_rounded, color: AppColors.primary, size: 22),
                const SizedBox(width: 8),
                Text(
                  'Your children',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Tap a name for the full profile. Quick links go to fees or payments.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.35,
                  ),
            ),
            const SizedBox(height: 14),
            ...students.map((s) {
              final rows =
                  overview.balances.where((b) => b.studentId == s.id).toList();
              final due = rows.fold<double>(0, (a, b) => a + b.balance);
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _StudentCard(
                  student: s,
                  balanceDue: due,
                  onOpenProfile: () => onOpenStudent(s),
                  onViewFees: () => onNavigateToTab(1),
                  onViewPayments: () => onNavigateToTab(2),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _Totals {
  double fees = 0;
  double paid = 0;
  double balance = 0;
}

class _WelcomeHeaderCard extends StatelessWidget {
  const _WelcomeHeaderCard({
    required this.profileName,
    required this.childCount,
  });

  final String? profileName;
  final int childCount;

  @override
  Widget build(BuildContext context) {
    final name = profileName?.trim();
    final greet = (name != null && name.isNotEmpty)
        ? 'Welcome back, $name'
        : 'Welcome back';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
      decoration: BoxDecoration(
        gradient: ParentUiTokens.heroHeaderGradient,
        borderRadius: BorderRadius.circular(ParentUiTokens.radiusLg),
        border: Border.all(
          color: AppColors.cardBorder.withValues(alpha: 0.6),
        ),
        boxShadow: ParentUiTokens.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.waving_hand_rounded,
                  color: AppColors.primary,
                  size: 26,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      greet,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                            color: const Color(0xFF0F172A),
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      childCount == 0
                          ? 'When your school links a student, balances and payments show up here.'
                          : childCount == 1
                              ? 'Here is an overview for your child — fees, balance, and payments in one place.'
                              : 'Here is an overview for your $childCount children — fees, balance, and payments in one place.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.4,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryHero extends StatelessWidget {
  const _SummaryHero({
    required this.childCount,
    required this.currency,
    required this.totals,
  });

  final int childCount;
  final String currency;
  final _Totals totals;

  @override
  Widget build(BuildContext context) {
    final pct = totals.fees > 0 ? ((totals.paid / totals.fees) * 100).clamp(0, 100).round() : 0;
    final hasFees = totals.fees > 0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: ParentUiTokens.softCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.insights_rounded, color: AppColors.primary, size: 22),
              const SizedBox(width: 8),
              Text(
                'Fee overview',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Totals across linked students (${normalizeSchoolCurrency(currency)}).',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.35,
                ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _StatTile(
                icon: Icons.child_care_rounded,
                label: 'Children',
                value: '$childCount',
              ),
              const SizedBox(width: 10),
              _StatTile(
                icon: Icons.payments_rounded,
                label: 'Total fees',
                value: formatCurrency(totals.fees, currency),
                emphasize: true,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _StatTile(
                icon: Icons.check_circle_outline_rounded,
                label: 'Paid',
                value: formatCurrency(totals.paid, currency),
                valueColor: AppColors.success,
              ),
              const SizedBox(width: 10),
              _StatTile(
                icon: Icons.account_balance_wallet_rounded,
                label: 'Balance',
                value: formatCurrency(totals.balance, currency),
                valueColor:
                    totals.balance > 0 ? AppColors.warning : AppColors.success,
              ),
            ],
          ),
          if (hasFees) ...[
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Collected',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                Text(
                  '$pct%',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Stack(
                children: [
                  Container(
                    height: 10,
                    color: AppColors.indigoWash,
                  ),
                  FractionallySizedBox(
                    widthFactor: pct / 100,
                    child: Container(
                      height: 10,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primaryDark,
                            AppColors.primary,
                            Color(0xFF8B5CF6),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
    this.emphasize = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: ParentUiTokens.insetWell(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: AppColors.primary.withValues(alpha: 0.85)),
            const SizedBox(height: 8),
            Text(
              label.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: (emphasize
                      ? Theme.of(context).textTheme.titleMedium
                      : Theme.of(context).textTheme.titleSmall)
                  ?.copyWith(
                fontWeight: FontWeight.w800,
                color: valueColor ?? const Color(0xFF0F172A),
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MultiCurrencyHint extends StatelessWidget {
  const _MultiCurrencyHint({required this.childCount});

  final int childCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: ParentUiTokens.softCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.currency_exchange_rounded,
                  color: AppColors.primary, size: 22),
              const SizedBox(width: 8),
              Text(
                'Multiple currencies',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '$childCount linked ${childCount == 1 ? 'child' : 'children'} use more than one currency. Open each child below to see balances in their school\'s currency.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.45,
                ),
          ),
        ],
      ),
    );
  }
}

class _StudentCard extends StatelessWidget {
  const _StudentCard({
    required this.student,
    required this.balanceDue,
    required this.onOpenProfile,
    required this.onViewFees,
    required this.onViewPayments,
  });

  final StudentSummary student;
  final double balanceDue;
  final VoidCallback onOpenProfile;
  final VoidCallback onViewFees;
  final VoidCallback onViewPayments;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Ink(
        decoration: ParentUiTokens.softCard(),
        child: InkWell(
          borderRadius: BorderRadius.circular(ParentUiTokens.radiusLg),
          onTap: onOpenProfile,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.2),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: StudentAvatar(
                        radius: 28,
                        imageUrl: student.avatarUrl,
                        fallbackName: student.fullName,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            student.fullName,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.3,
                                ),
                          ),
                          if (student.schoolName?.trim().isNotEmpty == true) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.school_rounded,
                                  size: 16,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    student.schoolName!.trim(),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: AppColors.textSecondary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          if (student.className?.trim().isNotEmpty == true) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.class_rounded,
                                  size: 16,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    student.className!.trim(),
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(
                                          color: AppColors.textSecondary,
                                          fontWeight: FontWeight.w500,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          if (student.admissionNumber?.trim().isNotEmpty ==
                              true) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.badge_outlined,
                                  size: 16,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    'Adm. ${student.admissionNumber}',
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelSmall
                                        ?.copyWith(
                                          fontFamily: 'monospace',
                                          color: AppColors.textSecondary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (balanceDue > 0)
                      StatusChip.balanceDue(
                        formatCurrency(balanceDue, student.currencyCode),
                      )
                    else
                      StatusChip.paidUp(),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _QuickLink(
                        icon: Icons.account_balance_wallet_rounded,
                        label: 'Fees',
                        onTap: onViewFees,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _QuickLink(
                        icon: Icons.receipt_long_rounded,
                        label: 'Payments',
                        onTap: onViewPayments,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _QuickLink(
                        icon: Icons.person_rounded,
                        label: 'Profile',
                        filled: true,
                        onTap: onOpenProfile,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({
    required this.icon,
    required this.label,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          height: ParentUiTokens.actionMinHeight,
          decoration: BoxDecoration(
            color: filled ? AppColors.primary : AppColors.indigoWash,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: filled
                  ? AppColors.primary
                  : AppColors.primary.withValues(alpha: 0.2),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 20,
                color: filled ? Colors.white : AppColors.primary,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: filled ? Colors.white : AppColors.primaryDark,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

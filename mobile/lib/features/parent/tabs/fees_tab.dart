import 'package:flutter/material.dart';

import '../../../core/currency_format.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/parent_ui_tokens.dart';
import '../../../data/models/fee_balance_row.dart';
import '../../../data/models/parent_overview.dart';
import '../../../data/models/student_summary.dart';
import '../../../widgets/data_error_banner.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/status_chip.dart';
import '../../../widgets/student_avatar.dart';

class FeesTab extends StatelessWidget {
  const FeesTab({
    super.key,
    required this.overview,
    required this.onOpenStudent,
    required this.onRefresh,
    this.loadError,
  });

  final ParentOverview overview;
  final void Function(StudentSummary) onOpenStudent;
  final Future<void> Function() onRefresh;
  final String? loadError;

  @override
  Widget build(BuildContext context) {
    final students = overview.students;

    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  ParentUiTokens.horizontalPadding,
                  12,
                  ParentUiTokens.horizontalPadding,
                  108,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (loadError != null) ...[
                      DataErrorBanner(
                        message: loadError!,
                        onRetry: onRefresh,
                      ),
                      const SizedBox(height: 16),
                    ],
                    Row(
                      children: [
                        Icon(Icons.account_balance_wallet_rounded,
                            color: AppColors.primary, size: 26),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Fee balances',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.5,
                                ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'See what is owed by fee type. Pull down to refresh. Tap a student to open their profile.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.45,
                          ),
                    ),
                    const SizedBox(height: 22),
                    if (students.isEmpty)
                      EmptyState(
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'No fee data yet',
                        message:
                            'When your school links a student to your account, fee balances and due amounts will appear here.',
                      )
                    else
                      ...students.map((s) {
                        final rows = overview.balances
                            .where((b) => b.studentId == s.id)
                            .toList();
                        final totalDue =
                            rows.fold<double>(0, (a, b) => a + b.balance);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: _StudentFeesCard(
                            student: s,
                            rows: rows,
                            totalDue: totalDue,
                            onOpenProfile: () => onOpenStudent(s),
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _StudentFeesCard extends StatefulWidget {
  const _StudentFeesCard({
    required this.student,
    required this.rows,
    required this.totalDue,
    required this.onOpenProfile,
  });

  final StudentSummary student;
  final List<FeeBalanceRow> rows;
  final double totalDue;
  final VoidCallback onOpenProfile;

  @override
  State<_StudentFeesCard> createState() => _StudentFeesCardState();
}

class _StudentFeesCardState extends State<_StudentFeesCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.student;
    final rows = widget.rows;
    final totalDue = widget.totalDue;
    final summaryChip = totalDue > 0
        ? StatusChip.lineBalance(
            '${formatCurrency(totalDue, s.currencyCode)} due',
          )
        : StatusChip.paidUp();

    return Container(
      decoration: ParentUiTokens.softCard(),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
                child: Row(
                  children: [
                    StudentAvatar(
                      radius: 24,
                      imageUrl: s.avatarUrl,
                      fallbackName: s.fullName,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.fullName,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.2,
                                ),
                          ),
                          if (s.className?.trim().isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                s.className!.trim(),
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                        ],
                      ),
                    ),
                    summaryChip,
                    const SizedBox(width: 4),
                    AnimatedRotation(
                      turns: _expanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        Icons.expand_more_rounded,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_expanded) ...[
            Divider(
              height: 1,
              color: AppColors.cardBorder.withValues(alpha: 0.8),
            ),
            if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                child: Text(
                  'No fee lines yet for this student.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
              )
            else
              ...rows.map((b) => _FeeLineTile(student: s, row: b)),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
              child: Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: widget.onOpenProfile,
                  icon: const Icon(Icons.person_rounded, size: 20),
                  label: const Text('Student profile'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    textStyle: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FeeLineTile extends StatelessWidget {
  const _FeeLineTile({
    required this.student,
    required this.row,
  });

  final StudentSummary student;
  final FeeBalanceRow row;

  @override
  Widget build(BuildContext context) {
    final cur = student.currencyCode;
    final balance = row.balance;
    final chip = balance <= 0
        ? StatusChip.paidUp()
        : StatusChip.lineBalance(formatCurrency(balance, cur));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: ParentUiTokens.insetWell(),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row.feeName,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  if (row.dueDate != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.event_rounded,
                          size: 15,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Due ${row.dueDate!.split('T').first}',
                          style:
                              Theme.of(context).textTheme.labelMedium?.copyWith(
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        'Total ${formatCurrency(row.totalFee, cur)}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      Text(
                        '· Paid ${formatCurrency(row.totalPaid, cur)}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatCurrency(balance, cur),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: balance > 0
                            ? AppColors.warning
                            : AppColors.success,
                      ),
                ),
                const SizedBox(height: 6),
                chip,
              ],
            ),
          ],
        ),
      ),
    );
  }
}

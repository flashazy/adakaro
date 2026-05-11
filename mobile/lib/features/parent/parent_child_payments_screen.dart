import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/parent_overview.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/student_summary.dart';
import '../../widgets/data_error_banner.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/parent_payment_tile.dart';
import '../../widgets/student_avatar.dart';

/// Child-scoped payments and receipts (official receipt flow preserved).
class ParentChildPaymentsScreen extends StatelessWidget {
  const ParentChildPaymentsScreen({
    super.key,
    required this.student,
    required this.payments,
    required this.onRefresh,
    this.loadError,
  });

  final StudentSummary student;
  final List<PaymentRow> payments;
  final Future<void> Function() onRefresh;
  final String? loadError;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Payments / Receipts'),
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => onRefresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ChildContextBanner(student: student),
          if (loadError != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: DataErrorBanner(
                message: loadError!,
                onRetry: onRefresh,
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: onRefresh,
              child: payments.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(24),
                      children: [
                        EmptyState(
                          icon: Icons.payments_outlined,
                          title: 'No payments yet',
                          message:
                              'When the school records a payment for ${student.fullName}, '
                              'you will see it here. Tap “View receipt” when a receipt is available.',
                          action: OutlinedButton.icon(
                            onPressed: () => onRefresh(),
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Refresh'),
                          ),
                        ),
                      ],
                    )
                  : ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(
                        ParentUiTokens.horizontalPadding,
                        16,
                        ParentUiTokens.horizontalPadding,
                        108,
                      ),
                      children: [
                        Text(
                          'Recent payments',
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                        ),
                        const SizedBox(height: 12),
                        ...payments.map(
                          (p) => ParentPaymentTile(
                            payment: p,
                            student: student,
                          ),
                        ),
                      ],
                    ),
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
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: AppColors.cardBorder.withValues(alpha: 0.65),
            ),
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

/// Filters [ParentOverview.payments] for one student, newest first.
List<PaymentRow> paymentsForStudent(ParentOverview overview, String studentId) {
  final list =
      overview.payments.where((p) => p.studentId == studentId).toList();
  list.sort((a, b) => b.paymentDate.compareTo(a.paymentDate));
  return list;
}

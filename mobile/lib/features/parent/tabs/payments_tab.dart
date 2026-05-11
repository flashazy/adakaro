import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/parent_ui_tokens.dart';
import '../../../data/models/parent_overview.dart';
import '../../../data/models/student_summary.dart';
import '../../../widgets/data_error_banner.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/parent_payment_tile.dart';

class PaymentsTab extends StatelessWidget {
  const PaymentsTab({
    super.key,
    required this.overview,
    required this.studentLookup,
    required this.onRefresh,
    this.loadError,
  });

  final ParentOverview overview;
  final Map<String, StudentSummary> studentLookup;
  final Future<void> Function() onRefresh;
  final String? loadError;

  @override
  Widget build(BuildContext context) {
    final payments = overview.payments;
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
                        Icon(Icons.receipt_long_rounded,
                            color: AppColors.primary, size: 26),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Payment history',
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
                      'Recent school payments for your linked children. Pull down to refresh.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.45,
                          ),
                    ),
                    const SizedBox(height: 22),
                    if (students.isEmpty)
                      EmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: 'No payments to show',
                        message:
                            'Link a student to your account to see their payment and receipt history here.',
                      )
                    else if (payments.isEmpty)
                      EmptyState(
                        icon: Icons.payments_outlined,
                        title: 'No payments yet',
                        message:
                            'When the school records a payment, you will see the date, amount, method, and receipt number here. Tap “View receipt” when available.',
                        action: OutlinedButton.icon(
                          onPressed: () => onRefresh(),
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Refresh'),
                        ),
                      )
                    else
                      ...payments.map(
                        (p) => ParentPaymentTile(
                          payment: p,
                          student: studentLookup[p.studentId],
                        ),
                      ),
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

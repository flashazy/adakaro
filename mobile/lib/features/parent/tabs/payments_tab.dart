import 'package:flutter/material.dart';

import '../../../core/currency_format.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/parent_ui_tokens.dart';
import '../../../data/models/parent_overview.dart';
import '../../../data/models/payment_row.dart';
import '../../../data/models/student_summary.dart';
import '../../../widgets/data_error_banner.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/student_avatar.dart';
import '../receipt_detail_screen.dart';

String _paymentMethodLabel(String? raw) {
  if (raw == null || raw.isEmpty) return 'Payment';
  return raw.replaceAll('_', ' ');
}

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
                        (p) => _PaymentTile(
                          p: p,
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

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({
    required this.p,
    required this.student,
  });

  final PaymentRow p;
  final StudentSummary? student;

  @override
  Widget build(BuildContext context) {
    final st = student;
    final currency = st?.currencyCode;
    final date = p.paymentDate.split('T').first;
    final method = _paymentMethodLabel(p.paymentMethod);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: ParentUiTokens.softCard(),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StudentAvatar(
                    radius: 22,
                    imageUrl: st?.avatarUrl,
                    fallbackName: st?.fullName ?? 'S',
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          st?.fullName ?? 'Student',
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.2,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(
                              Icons.calendar_today_rounded,
                              size: 14,
                              color: AppColors.textSecondary,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              date,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelMedium
                                  ?.copyWith(
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Text(
                    formatCurrency(p.amount, currency),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: AppColors.success,
                          letterSpacing: -0.3,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: ParentUiTokens.insetWell(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.payments_rounded,
                          size: 16,
                          color: AppColors.primary.withValues(alpha: 0.85),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            method,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      p.feeStructureName ?? 'School fees',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                    if (p.referenceNumber != null &&
                        p.referenceNumber!.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Ref ${p.referenceNumber}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              fontFamily: 'monospace',
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                    if (p.receiptNumber != null &&
                        p.receiptNumber!.trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(
                            Icons.tag_rounded,
                            size: 16,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Receipt ${p.receiptNumber}',
                            style: Theme.of(context)
                                .textTheme
                                .labelLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primaryDark,
                                ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (p.hasReceiptForView) ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: ParentUiTokens.actionMinHeight,
                  child: FilledButton.tonalIcon(
                    onPressed: () {
                      Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) => ReceiptDetailScreen(
                            payment: p,
                            student: st,
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.receipt_long_rounded, size: 22),
                    label: const Text('View receipt'),
                    style: FilledButton.styleFrom(
                      foregroundColor: AppColors.primaryDark,
                      backgroundColor: AppColors.indigoWash,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(
                          color: AppColors.primary.withValues(alpha: 0.25),
                        ),
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

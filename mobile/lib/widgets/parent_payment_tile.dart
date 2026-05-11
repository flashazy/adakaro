import 'package:flutter/material.dart';

import '../core/currency_format.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/parent_ui_tokens.dart';
import '../data/models/payment_row.dart';
import '../data/models/student_summary.dart';
import '../features/parent/receipt_detail_screen.dart';
import 'student_avatar.dart';

String parentPaymentMethodLabel(String? raw) {
  if (raw == null || raw.isEmpty) return 'Payment';
  return raw.replaceAll('_', ' ');
}

class ParentPaymentTile extends StatelessWidget {
  const ParentPaymentTile({
    super.key,
    required this.payment,
    required this.student,
  });

  final PaymentRow payment;
  final StudentSummary? student;

  @override
  Widget build(BuildContext context) {
    final st = student;
    final currency = st?.currencyCode;
    final date = payment.paymentDate.split('T').first;
    final method = parentPaymentMethodLabel(payment.paymentMethod);

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
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
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
                    formatCurrency(payment.amount, currency),
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                      payment.feeStructureName ?? 'School fees',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                    if (payment.referenceNumber != null &&
                        payment.referenceNumber!.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Ref ${payment.referenceNumber}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              fontFamily: 'monospace',
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                    if (payment.receiptNumber != null &&
                        payment.receiptNumber!.trim().isNotEmpty) ...[
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
                            'Receipt ${payment.receiptNumber}',
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
              if (payment.hasReceiptForView) ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: ParentUiTokens.actionMinHeight,
                  child: FilledButton.tonalIcon(
                    onPressed: () {
                      Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) => ReceiptDetailScreen(
                            payment: payment,
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

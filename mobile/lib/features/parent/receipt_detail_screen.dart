import 'package:flutter/material.dart';

import '../../core/currency_format.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/student_summary.dart';

String _paymentMethodLabel(String? raw) {
  if (raw == null || raw.isEmpty) return 'Not specified';
  return raw.replaceAll('_', ' ');
}

/// Simple on-device receipt view (no PDF). Data comes from the parent payments query (RLS).
class ReceiptDetailScreen extends StatelessWidget {
  const ReceiptDetailScreen({
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
    final school = st?.schoolName?.trim();
    final studentName = st?.fullName ?? 'Student';

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Receipt'),
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          ParentUiTokens.horizontalPadding,
          12,
          ParentUiTokens.horizontalPadding,
          36,
        ),
        children: [
          Container(
            decoration: ParentUiTokens.softCard(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.indigoWash,
                        Colors.white,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(ParentUiTokens.radiusLg),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.12),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Icon(
                          Icons.receipt_long_rounded,
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
                              'PAYMENT RECEIPT',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.primaryDark,
                                    letterSpacing: 1.2,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Official summary for your records',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: AppColors.textSecondary,
                                    height: 1.3,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      Transform.rotate(
                        angle: -0.08,
                        child: Text(
                          'PAID',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: AppColors.success.withValues(alpha: 0.35),
                                letterSpacing: 3,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ReceiptLine(
                        label: 'School',
                        value: (school != null && school.isNotEmpty)
                            ? school
                            : '—',
                      ),
                      _ReceiptLine(label: 'Student', value: studentName),
                      if (st != null &&
                          (st.admissionNumber?.trim().isNotEmpty ?? false))
                        _ReceiptLine(
                          label: 'Admission',
                          value: st.admissionNumber!.trim(),
                        ),
                      if (st != null &&
                          (st.className?.trim().isNotEmpty ?? false))
                        _ReceiptLine(
                          label: 'Class',
                          value: st.className!.trim(),
                        ),
                      const Divider(height: 28),
                      Text(
                        formatCurrency(payment.amount, currency),
                        textAlign: TextAlign.center,
                        style:
                            Theme.of(context).textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.success,
                                  letterSpacing: -0.5,
                                ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Amount received',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      const Divider(height: 28),
                      _ReceiptLine(label: 'Payment date', value: date),
                      _ReceiptLine(
                        label: 'Method',
                        value: _paymentMethodLabel(payment.paymentMethod),
                      ),
                      if (payment.feeStructureName != null &&
                          payment.feeStructureName!.trim().isNotEmpty)
                        _ReceiptLine(
                          label: 'Fee',
                          value: payment.feeStructureName!,
                        ),
                      if (payment.referenceNumber != null &&
                          payment.referenceNumber!.trim().isNotEmpty)
                        _ReceiptLine(
                          label: 'Reference',
                          value: payment.referenceNumber!,
                        ),
                      if (payment.receiptNumber != null &&
                          payment.receiptNumber!.trim().isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.indigoWash,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: AppColors.primary.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.tag_rounded,
                                color: AppColors.primary,
                                size: 26,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Receipt number',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            color: AppColors.textSecondary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      payment.receiptNumber!,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleLarge
                                          ?.copyWith(
                                            fontWeight: FontWeight.w900,
                                            fontFamily: 'monospace',
                                            letterSpacing: -0.5,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'Receipt number not assigned yet.',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'This is an informational copy for parents. For questions, contact your school.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.45,
                ),
          ),
        ],
      ),
    );
  }
}

class _ReceiptLine extends StatelessWidget {
  const _ReceiptLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    height: 1.35,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

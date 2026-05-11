import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/student_summary.dart';
import '../receipts/official_payment_receipt.dart';

/// On-device receipt (no PDF). Data comes from the parent payments query (RLS).
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
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Payment Receipt'),
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
          OfficialPaymentReceipt(payment: payment, student: student),
        ],
      ),
    );
  }
}

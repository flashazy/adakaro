import 'fee_balance_row.dart';
import 'payment_row.dart';
import 'student_summary.dart';

class ParentOverview {
  ParentOverview({
    required this.profileName,
    required this.students,
    required this.balances,
    required this.payments,
  });

  final String? profileName;
  final List<StudentSummary> students;
  final List<FeeBalanceRow> balances;
  final List<PaymentRow> payments;
}

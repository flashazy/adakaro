import 'fee_balance_row.dart';
import 'payment_row.dart';
import 'parent_seen_state.dart';
import 'student_summary.dart';

class ParentAttentionSignals {
  const ParentAttentionSignals({
    this.messagesUnreadCount = 0,
    this.messagesLatestAt,
    this.subjectResultsLatestAt,
    this.reportCardsLatestApprovedAt,
    this.feesHasOverdue = false,
    this.feesLatestAt,
    this.paymentsLatestAt,
    this.attendanceConcernLatestAt,
  });

  static const empty = ParentAttentionSignals();

  final int messagesUnreadCount;
  final String? messagesLatestAt;

  /// Latest timestamp when academic marks/comments changed (best-effort).
  final String? subjectResultsLatestAt;

  /// Latest `report_cards.approved_at` (new report published).
  final String? reportCardsLatestApprovedAt;

  final bool feesHasOverdue;

  /// Latest Fees-related activity timestamp (ISO), e.g. `fee_structures.updated_at`.
  final String? feesLatestAt;

  /// Latest payment/receipt event time (best-effort).
  final String? paymentsLatestAt;

  /// Latest time a serious attendance concern was detected (best-effort).
  final String? attendanceConcernLatestAt;
}

class ParentOverview {
  ParentOverview({
    required this.profileName,
    required this.students,
    required this.balances,
    required this.payments,
    this.attention = ParentAttentionSignals.empty,
    this.seen = ParentSeenState.empty,
  });

  final String? profileName;
  final List<StudentSummary> students;
  final List<FeeBalanceRow> balances;
  final List<PaymentRow> payments;
  final ParentAttentionSignals attention;
  final ParentSeenState seen;
}

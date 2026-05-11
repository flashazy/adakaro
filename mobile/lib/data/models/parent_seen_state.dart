class ParentSeenState {
  const ParentSeenState({
    this.lastSeenMessagesAt,
    this.lastSeenSubjectResultsAt,
    this.lastSeenReportCardsAt,
    this.lastSeenReceiptsAt,
    this.lastSeenFeesAt,
  });

  static const empty = ParentSeenState();

  final String? lastSeenMessagesAt;
  final String? lastSeenSubjectResultsAt;
  final String? lastSeenReportCardsAt;
  final String? lastSeenReceiptsAt;
  final String? lastSeenFeesAt;

  factory ParentSeenState.fromJson(Map<String, dynamic> j) {
    String? s(dynamic v) => v?.toString();
    return ParentSeenState(
      lastSeenMessagesAt: s(j['last_seen_messages_at']),
      lastSeenSubjectResultsAt: s(j['last_seen_subject_results_at']),
      lastSeenReportCardsAt: s(j['last_seen_report_cards_at']),
      lastSeenReceiptsAt: s(j['last_seen_receipts_at']),
      lastSeenFeesAt: s(j['last_seen_fees_at']),
    );
  }
}


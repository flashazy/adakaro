import '../../data/models/report_card_comment_row.dart';
import '../../data/models/report_card_summary.dart';

/// Subject / exam tabs should reflect published report cards when envelopes load.
///
/// If we cannot resolve approved report IDs (missing `report_cards` rows), falls back to
/// the raw comment list so a partial failure never clears the UI.
List<ReportCardCommentRow> commentsForParentSubjectResults(
  List<ReportCardSummary> reportCards,
  List<ReportCardCommentRow> comments,
) {
  final approvedIds = reportCards
      .where((c) => c.status.toLowerCase() == 'approved')
      .map((c) => c.id)
      .toSet();
  if (approvedIds.isEmpty) {
    return List<ReportCardCommentRow>.from(comments);
  }
  final filtered =
      comments.where((c) => approvedIds.contains(c.reportCardId)).toList();
  if (filtered.isEmpty && comments.isNotEmpty) {
    return List<ReportCardCommentRow>.from(comments);
  }
  return filtered;
}

List<ReportCardSummary> approvedReportCards(List<ReportCardSummary> cards) {
  final list =
      cards.where((c) => c.status.toLowerCase() == 'approved').toList();
  list.sort((a, b) {
    final y = b.academicYear.compareTo(a.academicYear);
    if (y != 0) return y;
    return b.term.compareTo(a.term);
  });
  return list;
}

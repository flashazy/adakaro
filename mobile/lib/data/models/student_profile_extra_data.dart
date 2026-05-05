import 'attendance_record.dart';
import 'chat_message_row.dart';
import 'report_card_comment_row.dart';
import 'report_card_summary.dart';

/// Aggregated optional reads for the student profile hub.
class StudentProfileExtraData {
  const StudentProfileExtraData({
    required this.attendance,
    required this.reportCards,
    required this.reportComments,
    required this.messages,
    this.primaryConversationId,
  });

  final List<AttendanceRecord> attendance;
  final List<ReportCardSummary> reportCards;
  final List<ReportCardCommentRow> reportComments;
  final List<ChatMessageRow> messages;
  final String? primaryConversationId;
}

/// Row from `chat_messages` (participant RLS).
class ChatMessageRow {
  const ChatMessageRow({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.message,
    required this.createdAt,
    this.isRead = false,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String message;
  final String createdAt;
  final bool isRead;

  factory ChatMessageRow.fromJson(Map<String, dynamic> j) {
    return ChatMessageRow(
      id: j['id'] as String,
      conversationId: j['conversation_id'] as String,
      senderId: j['sender_id'] as String,
      message: (j['message'] as String?) ?? '',
      createdAt: j['created_at'] as String? ?? '',
      isRead: j['is_read'] as bool? ?? false,
    );
  }
}

import 'package:flutter/material.dart';

import '../../widgets/empty_state.dart';

/// Placeholder inbox for school messages. Use home quick actions for class chat;
/// system-wide messages can share this tab later.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({
    super.key,
    this.embedded = false,
  });

  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final content = EmptyState(
      icon: Icons.chat_bubble_outline_rounded,
      title: embedded ? 'No messages here yet' : 'Messages',
      message: embedded
          ? 'Use Home → Messages to chat with your child\'s teacher. School-wide '
              'announcements will show here when available.'
          : 'School announcements and fee reminders will show here when enabled. '
              'Until then, your school may reach you by email or SMS.',
    );

    if (embedded) {
      return content;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Messages')),
      body: content,
    );
  }
}

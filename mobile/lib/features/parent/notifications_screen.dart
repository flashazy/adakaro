import 'package:flutter/material.dart';

import '../../widgets/empty_state.dart';

/// Placeholder for in-app / push notifications. The web app uses broadcasts and
/// other channels; wiring those here can follow the same Supabase RLS rules.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({
    super.key,
    this.embedded = false,
  });

  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final content = EmptyState(
      icon: Icons.notifications_active_outlined,
      title: embedded ? 'No alerts yet' : 'Notifications',
      message:
          'School announcements and fee reminders will show here when that feature is enabled. '
          'Until then, your school may reach you by email or SMS.',
    );

    if (embedded) {
      return content;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: content,
    );
  }
}

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/auth/app_role.dart';
import '../core/auth/role_service.dart';
import '../features/auth/login_screen.dart';
import '../features/parent/parent_main_scaffold.dart';
import '../features/teacher/teacher_home_screen.dart';
import '../features/web_only/web_only_home_screen.dart';

/// Shared navigation after Supabase session is established (splash + login).
Future<void> navigateAfterAuth(BuildContext context, User user) async {
  final client = Supabase.instance.client;
  final roles = RoleService(client);

  if (await roles.isBlockedBySchoolSuspension()) {
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Account paused'),
        content: const Text(
          'Your school account is suspended. Please use the Adakaro website or contact your school.',
        ),
        actions: [
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await client.auth.signOut();
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      (route) => false,
    );
    return;
  }

  final role = await roles.resolveForSession(user);
  if (!context.mounted) return;

  final Widget next = switch (role) {
    AppRole.parentMobile => ParentMainScaffold(user: user),
    AppRole.teacherMobile => TeacherHomeScreen(user: user),
    AppRole.adminWeb => const WebOnlyHomeScreen(kind: WebOnlyKind.admin),
    AppRole.superAdminWeb =>
      const WebOnlyHomeScreen(kind: WebOnlyKind.superAdmin),
  };

  Navigator.of(context).pushAndRemoveUntil(
    MaterialPageRoute<void>(builder: (_) => next),
    (route) => false,
  );
}

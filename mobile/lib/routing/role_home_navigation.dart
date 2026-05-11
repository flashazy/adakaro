import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/auth/app_role.dart';
import '../core/auth/role_service.dart';
import '../features/parent/parent_main_scaffold.dart';
import '../features/teacher/teacher_home_screen.dart';
import '../features/web_only/web_only_home_screen.dart';

/// Role-based home after session is valid (used by [navigateAfterAuth] and password gates).
Future<void> routeToRoleHome(BuildContext context, User user) async {
  final client = Supabase.instance.client;
  final roles = RoleService(client);
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

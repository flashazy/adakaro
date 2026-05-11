import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/auth/role_service.dart';
import '../core/auth/teacher_temp_password_constants.dart';
import '../features/auth/forced_password_gate_screen.dart';
import '../features/auth/login_screen.dart';
import 'role_home_navigation.dart';

const String _kSessionRecoveryNetworkMessage =
    'Could not reach Adakaro (check Wi‑Fi or emulator DNS). Please sign in again.';

/// Shared navigation after Supabase session is established (splash + login).
///
/// When [skipPasswordGates] is true, only suspension + role routing run (after
/// the user finished a forced password step).
Future<void> navigateAfterAuth(
  BuildContext context,
  User user, {
  bool skipPasswordGates = false,
}) async {
  final client = Supabase.instance.client;

  try {
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

    if (!skipPasswordGates) {
      var isSuper = false;
      try {
        final superRes = await client.rpc<dynamic>('is_super_admin');
        isSuper = superRes == true;
      } catch (_) {}

      if (!isSuper) {
        final prof = await client
            .from('profiles')
            .select(
              'role, password_changed, password_forced_reset, recovery_reset_required, must_change_password, teacher_temp_password_expires_at',
            )
            .eq('id', user.id)
            .maybeSingle();

        final pr = prof;
        final roleStr = (pr?['role'] as String?)?.toLowerCase().trim() ?? '';
        final passwordForced = pr?['password_forced_reset'] == true;
        final passwordChanged = pr?['password_changed'];
        final recoveryRequired = pr?['recovery_reset_required'] == true;
        final mustChange = pr?['must_change_password'] == true;
        final expiresRaw = pr?['teacher_temp_password_expires_at'] as String?;

        if (roleStr == 'teacher' &&
            passwordForced &&
            expiresRaw != null &&
            expiresRaw.isNotEmpty) {
          final exp = DateTime.tryParse(expiresRaw);
          if (exp != null && !exp.isAfter(DateTime.now())) {
            await client.auth.signOut();
            if (!context.mounted) return;
            await showDialog<void>(
              context: context,
              barrierDismissible: false,
              builder: (ctx) => AlertDialog(
                title: const Text('Password expired'),
                content: const Text(teacherTempPasswordExpiredMessage),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
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
        }

        if (roleStr == 'teacher' &&
            (passwordChanged == false || passwordForced)) {
          if (!context.mounted) return;
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => ForcedPasswordGateScreen(
                user: user,
                kind: PasswordGateKind.teacherFirstLogin,
              ),
            ),
            (route) => false,
          );
          return;
        }

        if (roleStr == 'parent' && mustChange) {
          if (!context.mounted) return;
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => ForcedPasswordGateScreen(
                user: user,
                kind: PasswordGateKind.parentMustChangePassword,
              ),
            ),
            (route) => false,
          );
          return;
        }

        if (roleStr == 'parent' &&
            (recoveryRequired || passwordForced)) {
          if (!context.mounted) return;
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => ForcedPasswordGateScreen(
                user: user,
                kind: PasswordGateKind.parentSecurityReset,
              ),
            ),
            (route) => false,
          );
          return;
        }
      }
    }

    if (!context.mounted) return;
    await routeToRoleHome(context, user);
  } catch (e, st) {
    debugPrint('navigateAfterAuth failed: $e\n$st');
    try {
      await client.auth.signOut();
    } catch (_) {}
    if (!context.mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) => const LoginScreen(
          sessionRecoveryMessage: _kSessionRecoveryNetworkMessage,
        ),
      ),
      (route) => false,
    );
  }
}

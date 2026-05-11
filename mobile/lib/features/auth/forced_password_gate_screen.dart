import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/theme/app_colors.dart';
import '../../routing/role_home_navigation.dart';
import 'login_screen.dart';

/// Matches web `/change-password` (teacher + parent must-change) and
/// `/reset-password` (parent recovery / forced reset).
enum PasswordGateKind {
  teacherFirstLogin,
  parentMustChangePassword,
  parentSecurityReset,
}

class ForcedPasswordGateScreen extends StatefulWidget {
  const ForcedPasswordGateScreen({
    super.key,
    required this.user,
    required this.kind,
  });

  final User user;
  final PasswordGateKind kind;

  @override
  State<ForcedPasswordGateScreen> createState() => _ForcedPasswordGateScreenState();
}

class _ForcedPasswordGateScreenState extends State<ForcedPasswordGateScreen> {
  final _p1 = TextEditingController();
  final _p2 = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  String? _error;

  int get _minLength => widget.kind == PasswordGateKind.parentSecurityReset ? 6 : 8;

  String get _title => 'Choose a new password';

  String get _subtitle {
    switch (widget.kind) {
      case PasswordGateKind.teacherFirstLogin:
        return 'Your school administrator created your account with a temporary '
            'password. Set a new password you will remember before continuing.';
      case PasswordGateKind.parentMustChangePassword:
        return 'You need to set a new password before continuing.';
      case PasswordGateKind.parentSecurityReset:
        return 'Create a new password to secure your account. You can keep using '
            'the same sign-in options your school has enabled.';
    }
  }

  @override
  void dispose() {
    _p1.dispose();
    _p2.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final client = Supabase.instance.client;
    try {
      await client.auth.updateUser(UserAttributes(password: _p1.text));

      final Map<String, dynamic> patch;
      switch (widget.kind) {
        case PasswordGateKind.teacherFirstLogin:
          patch = {
            'password_changed': true,
            'password_forced_reset': false,
            'teacher_temp_password_expires_at': null,
          };
          break;
        case PasswordGateKind.parentMustChangePassword:
          patch = {
            'password_changed': true,
            'must_change_password': false,
            'password_forced_reset': false,
          };
          break;
        case PasswordGateKind.parentSecurityReset:
          patch = {
            'recovery_reset_required': false,
            'password_forced_reset': false,
            'password_changed': true,
          };
          break;
      }

      await client.from('profiles').update(patch).eq('id', widget.user.id);

      if (!mounted) return;
      await routeToRoleHome(context, widget.user);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signOut() async {
    await Supabase.instance.client.auth.signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Account security'),
        actions: [
          TextButton(onPressed: _loading ? null : _signOut, child: const Text('Sign out')),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _title,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  _subtitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 28),
                TextFormField(
                  controller: _p1,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: InputDecoration(
                    labelText: 'New password',
                    hintText: 'At least $_minLength characters',
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Enter a new password';
                    }
                    if (v.length < _minLength) {
                      return 'Password must be at least $_minLength characters.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _p2,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(
                    labelText: 'Confirm password',
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Confirm your password';
                    }
                    if (v != _p1.text) return 'Passwords do not match.';
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                const SizedBox(height: 28),
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save new password'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

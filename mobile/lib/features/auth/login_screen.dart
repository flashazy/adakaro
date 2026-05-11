import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/auth/auth_login_diagnostics.dart';
import '../../core/auth/resolve_sign_in_email_client.dart';
import '../../core/theme/app_colors.dart';
import '../../routing/post_login_router.dart';
import '../debug/supabase_network_diagnostics_screen.dart';
import 'forgot_password_sheet.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.sessionRecoveryMessage});

  /// Shown once when opened after splash/bootstrap could not restore the session
  /// (e.g. offline, DNS failure on emulator).
  final String? sessionRecoveryMessage;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  String? _error;
  String? _recoveryBanner;
  LoginAttemptDiagnostics? _lastDebugDiag;

  @override
  void initState() {
    super.initState();
    _recoveryBanner = widget.sessionRecoveryMessage?.trim().isNotEmpty == true
        ? widget.sessionRecoveryMessage!.trim()
        : null;
  }

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _loading = true;
      _error = null;
      _lastDebugDiag = kDebugMode ? LoginAttemptDiagnostics() : null;
    });
    final diag = _lastDebugDiag;
    diag?.begin();

    final client = Supabase.instance.client;
    final id = _identifier.text.trim();
    final password = _password.text;

    AuthLoginDiagnostics.logLine(
      'login.submit start identifierType=${id.contains('@') ? 'email' : 'non_email'} '
      'host=${diag?.supabaseHost ?? '(no diag)'}',
    );

    try {
      diag?.authAttemptStarted = true;
      User? user;

      if (id.contains('@')) {
        diag?.signInStage = 'signInWithPassword_direct_email';
        try {
          final res = await client.auth.signInWithPassword(
            email: id,
            password: password,
          );
          user = res.user;
          AuthLoginDiagnostics.logLine(
            'signInWithPassword(direct) user=${user?.id ?? 'null'}',
          );
        } on AuthException catch (e) {
          AuthLoginDiagnostics.logAuthException('signInWithPassword(direct)', e);
          diag?.directEmailAuthError =
              'AuthException message=${e.message} statusCode=${e.statusCode} code=${e.code}';
          user = null;
        }
      }

      if (user == null) {
        diag?.signInStage = 'resolve_then_password';
        final email = await resolveSignInEmail(client, id, diagnostics: diag);
        diag?.signInStage = 'signInWithPassword_after_resolve';
        try {
          final res2 = await client.auth.signInWithPassword(
            email: email,
            password: password,
          );
          user = res2.user;
          AuthLoginDiagnostics.logLine(
            'signInWithPassword(resolved) user=${user?.id ?? 'null'}',
          );
        } on AuthException catch (e) {
          AuthLoginDiagnostics.logAuthException(
            'signInWithPassword(after_resolve)',
            e,
          );
          diag?.passwordAuthErrorFull = e.toString();
          diag?.passwordAuthStatusCode = e.statusCode;
          diag?.passwordAuthCode = e.code;
          rethrow;
        }
      }

      if (user == null || !mounted) {
        setState(() => _error = 'Sign-in failed.');
        return;
      }

      await navigateAfterAuth(context, user);
    } on ResolveSignInEmailException catch (e) {
      diag?.thrownType = 'ResolveSignInEmailException';
      diag?.thrownSummary = e.message;
      AuthLoginDiagnostics.logLine('login failed: ${e.message}');
      if (kDebugMode && diag != null) {
        await AuthLoginDiagnostics.probeSupabaseRest(diag);
      }
      if (mounted) setState(() => _error = e.message);
    } on AuthException catch (e, st) {
      diag?.thrownType = e.runtimeType.toString();
      diag?.thrownSummary = e.toString();
      AuthLoginDiagnostics.logAuthException('login', e);
      AuthLoginDiagnostics.logLine('login AuthException stack', error: e, stackTrace: st);
      if (kDebugMode && diag != null) {
        await AuthLoginDiagnostics.probeSupabaseRest(diag);
      }
      if (mounted) {
        setState(() => _error = userMessageForAuthFailure(e));
      }
    } on PostgrestException catch (e, st) {
      diag?.thrownType = 'PostgrestException';
      diag?.thrownSummary = e.toString();
      AuthLoginDiagnostics.logPostgrestRpc('login(unexpected_postgrest)', e);
      AuthLoginDiagnostics.logLine('unexpected Postgrest', error: e, stackTrace: st);
      if (kDebugMode && diag != null) {
        diag.rpcAttempted = true;
        diag.rpcSucceeded = false;
        diag.rpcErrorFull = e.toString();
        await AuthLoginDiagnostics.probeSupabaseRest(diag);
      }
      if (mounted) {
        setState(() => _error = userMessageForPostgrest(e));
      }
    } catch (e, st) {
      diag?.thrownType = e.runtimeType.toString();
      diag?.thrownSummary = e.toString();
      final kind = classifyTransportFailure(e);
      AuthLoginDiagnostics.logTransport('login', e, st);
      if (kDebugMode && diag != null) {
        await AuthLoginDiagnostics.probeSupabaseRest(diag);
      }
      if (mounted) {
        setState(() {
          _error = userMessageForTransportFailure(
            kind,
            supabaseHostIsLoopback: diag?.supabaseUrlIsLoopback ??
                envSupabaseHostIsLoopback(),
            warnAndroidEmulatorLoopback: diag?.warnAndroidEmulatorLoopback ??
                (!kIsWeb &&
                    defaultTargetPlatform == TargetPlatform.android &&
                    envSupabaseHostIsLoopback()),
          );
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                if (_recoveryBanner != null) ...[
                  Material(
                    color: Theme.of(context).colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.wifi_off_rounded,
                            color: Theme.of(context).colorScheme.onErrorContainer,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _recoveryBanner!,
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onErrorContainer,
                                height: 1.35,
                              ),
                            ),
                          ),
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            icon: Icon(
                              Icons.close_rounded,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onErrorContainer,
                            ),
                            onPressed: () =>
                                setState(() => _recoveryBanner = null),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                Text(
                  'Sign in',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Use the same account details you use on the Adakaro web app.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 40),
                TextFormField(
                  controller: _identifier,
                  keyboardType: TextInputType.text,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.username],
                  decoration: const InputDecoration(
                    labelText: 'Email, username, or admission number',
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return 'Enter your email, username, or admission number.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _password,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) {
                    if (!_loading) _submit();
                  },
                  autofillHints: const [AutofillHints.password],
                  decoration: const InputDecoration(
                    labelText: 'Password',
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Enter your password';
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                if (kDebugMode && _lastDebugDiag != null && _error != null) ...[
                  const SizedBox(height: 16),
                  _LoginAuthDebugPanel(diagnostics: _lastDebugDiag!),
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
                      : const Text('Sign in'),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: _loading
                        ? null
                        : () => showForgotPasswordSheet(
                              context,
                              initialEmail: _identifier.text.contains('@')
                                  ? _identifier.text.trim()
                                  : null,
                            ),
                    child: const Text('Forgot password?'),
                  ),
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: _loading
                        ? null
                        : () {
                            Navigator.of(context).push<void>(
                              MaterialPageRoute<void>(
                                builder: (_) =>
                                    const SupabaseNetworkDiagnosticsScreen(),
                              ),
                            );
                          },
                    child: const Text('Connection diagnostics'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginAuthDebugPanel extends StatelessWidget {
  const _LoginAuthDebugPanel({required this.diagnostics});

  final LoginAttemptDiagnostics diagnostics;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: ExpansionTile(
        title: Text(
          'Auth diagnostics (debug only)',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SelectableText(
              diagnostics.toDebugLines().join('\n'),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                    fontSize: 11,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

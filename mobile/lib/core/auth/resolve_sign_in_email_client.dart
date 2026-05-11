import 'package:supabase_flutter/supabase_flutter.dart';

import 'auth_login_diagnostics.dart';

/// Thrown when [resolveSignInEmail] cannot map the identifier to an auth email.
class ResolveSignInEmailException implements Exception {
  ResolveSignInEmailException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Mirrors web `resolveLoginEmailForSignIn` via RPC [resolve_sign_in_email].
Future<String> resolveSignInEmail(
  SupabaseClient client,
  String raw, {
  LoginAttemptDiagnostics? diagnostics,
}) async {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) {
    throw ResolveSignInEmailException(
      'Enter your email, username, or admission number.',
    );
  }
  if (trimmed.contains('@')) {
    return trimmed;
  }

  diagnostics?.rpcAttempted = true;

  try {
    AuthLoginDiagnostics.logLine('RPC resolve_sign_in_email start p_raw="$trimmed"');
    final dynamic row =
        await client.rpc<dynamic>('resolve_sign_in_email', params: {
      'p_raw': trimmed,
    });
    if (row is! Map) {
      diagnostics?.rpcSucceeded = false;
      diagnostics?.rpcErrorFull =
          'Unexpected RPC payload type: ${row.runtimeType}';
      AuthLoginDiagnostics.logLine(
        'RPC resolve_sign_in_email bad payload: ${row.runtimeType}',
      );
      throw ResolveSignInEmailException(
        'Could not resolve that account. Try your email address.',
      );
    }
    final map = Map<String, dynamic>.from(row);
    final ok = map['ok'] == true;
    if (!ok) {
      final err = map['error'] as String? ??
          'Could not resolve that account. Try your email address.';
      diagnostics?.rpcSucceeded = false;
      diagnostics?.rpcErrorFull = 'ok=false: $err';
      AuthLoginDiagnostics.logLine('RPC resolve_sign_in_email ok=false: $err');
      throw ResolveSignInEmailException(err);
    }
    final email = (map['email'] as String?)?.trim() ?? '';
    if (email.isEmpty) {
      diagnostics?.rpcSucceeded = false;
      diagnostics?.rpcErrorFull = 'ok=true but empty email';
      throw ResolveSignInEmailException(
        'Could not resolve that account. Try your email address.',
      );
    }
    diagnostics?.recordRpcSuccess(email);
    AuthLoginDiagnostics.logLine(
      'RPC resolve_sign_in_email ok email=${maskEmail(email)}',
    );
    return email;
  } on ResolveSignInEmailException {
    rethrow;
  } on PostgrestException catch (e) {
    diagnostics?.recordRpcPostgrestFailure(e);
    AuthLoginDiagnostics.logPostgrestRpc('resolve_sign_in_email', e);
    throw ResolveSignInEmailException(userMessageForPostgrest(e));
  } catch (e, st) {
    diagnostics?.recordRpcTransportFailure(e, st);
    AuthLoginDiagnostics.logTransport('resolve_sign_in_email', e, st);
    final kind = classifyTransportFailure(e);
    throw ResolveSignInEmailException(
      userMessageForTransportFailure(
        kind,
        supabaseHostIsLoopback: diagnostics?.supabaseUrlIsLoopback ?? false,
        warnAndroidEmulatorLoopback: diagnostics?.warnAndroidEmulatorLoopback ?? false,
      ),
    );
  }
}

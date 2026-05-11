import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/env.dart';

/// Per-submit snapshot for logs and the debug-only login panel.
class LoginAttemptDiagnostics {
  DateTime? startedAt;
  String supabaseHost = '';
  bool supabaseUrlIsLoopback = false;
  bool warnAndroidEmulatorLoopback = false;

  bool authAttemptStarted = false;
  String? signInStage;

  bool rpcAttempted = false;
  bool? rpcSucceeded;
  String? rpcErrorFull;

  String? resolvedEmailMasked;

  String? directEmailAuthError;
  String? passwordAuthErrorFull;
  String? passwordAuthStatusCode;
  String? passwordAuthCode;

  bool? supabaseRestReachable;
  String? supabaseRestProbeDetail;

  String? thrownType;
  String? thrownSummary;

  void begin() {
    startedAt = DateTime.now();
    final uri = Uri.tryParse(Env.supabaseUrl.trim());
    supabaseHost = uri?.host ?? '(parse error)';
    supabaseUrlIsLoopback = _hostIsLoopback(supabaseHost);
    warnAndroidEmulatorLoopback = !kIsWeb &&
        supabaseUrlIsLoopback &&
        defaultTargetPlatform == TargetPlatform.android;
  }

  void recordRpcSuccess(String resolvedEmail) {
    rpcSucceeded = true;
    resolvedEmailMasked = maskEmail(resolvedEmail);
  }

  void recordRpcPostgrestFailure(PostgrestException e) {
    rpcSucceeded = false;
    rpcErrorFull = e.toString();
  }

  void recordRpcTransportFailure(Object e, StackTrace? st) {
    rpcSucceeded = false;
    rpcErrorFull = '$e\n${st ?? ''}';
  }

  String _rpcReachableHint() {
    if (!rpcAttempted) return '—';
    if (rpcSucceeded == true) return 'yes (RPC returned JSON)';
    final err = rpcErrorFull ?? '';
    if (err.contains('SocketException') ||
        err.contains('ClientException') ||
        err.contains('TimeoutException') ||
        err.contains('Failed host lookup')) {
      return 'no (device transport/DNS)';
    }
    if (err.contains('PostgrestException') || err.startsWith('ok=false:')) {
      return 'yes (PostgREST responded; see rpcError)';
    }
    return 'see rpcError';
  }

  List<String> toDebugLines() {
    return [
      'startedAt: $startedAt',
      'supabaseHost: $supabaseHost',
      'urlIsLoopback: $supabaseUrlIsLoopback',
      'warnAndroidEmulatorLoopback: $warnAndroidEmulatorLoopback',
      'authAttemptStarted: $authAttemptStarted',
      'signInStage: $signInStage',
      'supabaseRestReachable: $supabaseRestReachable',
      'supabaseRestProbe: $supabaseRestProbeDetail',
      'rpcAttempted: $rpcAttempted',
      'rpcReachable: ${_rpcReachableHint()}',
      'rpcSucceeded: $rpcSucceeded',
      'rpcError: ${rpcErrorFull ?? '—'}',
      'resolvedEmail: ${resolvedEmailMasked ?? '—'}',
      'directEmailAuthError: ${directEmailAuthError ?? '—'}',
      'passwordAuth: ${passwordAuthErrorFull ?? '—'}',
      'passwordAuth statusCode: ${passwordAuthStatusCode ?? '—'} code: ${passwordAuthCode ?? '—'}',
      'lastThrownType: ${thrownType ?? '—'}',
      'lastThrown: ${thrownSummary ?? '—'}',
    ];
  }
}

/// Structured logging and user-facing classification for login / RPC / transport.
abstract final class AuthLoginDiagnostics {
  static const _logName = 'adakaro.auth';

  static void logStartupEnv() {
    if (!kDebugMode) return;
    final url = Env.supabaseUrl.trim();
    final uri = Uri.tryParse(url);
    final host = uri?.host ?? '';
    final loopback = _hostIsLoopback(host);
    final keyLen = Env.supabaseAnonKey.trim().length;
    developer.log(
      'Supabase init: url=$url host=$host loopback=$loopback anonKeyLength=$keyLen '
      '(precedence: dart-define > .env > SupabaseConfig defaults)',
      name: _logName,
    );
    if (loopback && !kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      developer.log(
        'WARNING: SUPABASE_URL uses a loopback host. Android emulator cannot reach '
        'your Mac at 127.0.0.1/localhost; use https://YOUR_PROJECT.supabase.co or 10.0.2.2 for local APIs.',
        name: _logName,
      );
    }
  }

  static void logLine(String message, {Object? error, StackTrace? stackTrace}) {
    developer.log(message, name: _logName, error: error, stackTrace: stackTrace);
  }

  static void logAuthException(
    String context,
    AuthException e,
  ) {
    developer.log(
      '$context AuthException message=${e.message} statusCode=${e.statusCode} code=${e.code}',
      name: _logName,
    );
  }

  static void logPostgrestRpc(String rpcName, PostgrestException e) {
    developer.log(
      'RPC $rpcName failed: ${e.toString()}',
      name: _logName,
    );
  }

  static void logTransport(String context, Object e, StackTrace? st) {
    final kind = classifyTransportFailure(e);
    developer.log(
      '$context transport failure kind=$kind error=$e',
      name: _logName,
      error: e,
      stackTrace: st,
    );
  }

  /// Lightweight reachability check (HTTP layer to PostgREST root).
  static Future<void> probeSupabaseRest(LoginAttemptDiagnostics d) async {
    if (!Env.isConfigured) {
      d.supabaseRestReachable = false;
      d.supabaseRestProbeDetail = 'Env not configured';
      return;
    }
    final base = Env.supabaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final uri = Uri.parse('$base/rest/v1/');
    final sw = Stopwatch()..start();
    try {
      final r = await http
          .get(
            uri,
            headers: {
              'apikey': Env.supabaseAnonKey,
              'Authorization': 'Bearer ${Env.supabaseAnonKey}',
              'Accept': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 12));
      sw.stop();
      d.supabaseRestReachable = true;
      d.supabaseRestProbeDetail =
          'GET $uri -> HTTP ${r.statusCode} in ${sw.elapsedMilliseconds}ms';
      logLine(d.supabaseRestProbeDetail!);
    } on TimeoutException catch (e, st) {
      sw.stop();
      d.supabaseRestReachable = false;
      d.supabaseRestProbeDetail = 'Timeout after 12s at GET $uri: $e';
      logTransport('probeSupabaseRest', e, st);
    } catch (e, st) {
      sw.stop();
      d.supabaseRestReachable = false;
      d.supabaseRestProbeDetail = 'Probe failed GET $uri: $e';
      logTransport('probeSupabaseRest', e, st);
    }
  }
}

bool _hostIsLoopback(String host) {
  final h = host.toLowerCase();
  return h == 'localhost' ||
      h == '127.0.0.1' ||
      h == '::1' ||
      h == '0.0.0.0';
}

/// True when [Env.supabaseUrl] host is loopback (localhost emulator pitfall).
bool envSupabaseHostIsLoopback() {
  final uri = Uri.tryParse(Env.supabaseUrl.trim());
  return _hostIsLoopback(uri?.host ?? '');
}

String maskEmail(String email) {
  final t = email.trim();
  if (t.isEmpty) return '(empty)';
  final at = t.indexOf('@');
  if (at <= 0) return '***';
  final local = t.substring(0, at);
  final domain = t.substring(at + 1);
  final keep = local.length <= 2 ? 1 : 2;
  return '${local.substring(0, keep)}***@$domain';
}

enum TransportFailureKind {
  timeout,
  socket,
  clientHttp,
  handshake,
  unknown,
}

TransportFailureKind classifyTransportFailure(Object error) {
  if (error is TimeoutException) return TransportFailureKind.timeout;
  final name = error.runtimeType.toString();
  if (name.contains('SocketException')) return TransportFailureKind.socket;
  if (name.contains('ClientException')) return TransportFailureKind.clientHttp;
  if (name.contains('HandshakeException') || name.contains('TlsException')) {
    return TransportFailureKind.handshake;
  }
  final s = error.toString().toLowerCase();
  if (s.contains('timed out') || s.contains('timeout')) {
    return TransportFailureKind.timeout;
  }
  if (s.contains('failed host lookup') ||
      s.contains('network is unreachable') ||
      s.contains('connection refused')) {
    return TransportFailureKind.socket;
  }
  return TransportFailureKind.unknown;
}

String userMessageForTransportFailure(
  TransportFailureKind kind, {
  required bool supabaseHostIsLoopback,
  required bool warnAndroidEmulatorLoopback,
}) {
  if (supabaseHostIsLoopback && warnAndroidEmulatorLoopback) {
    return 'This build points at localhost on your computer, which the Android '
        'emulator cannot reach. Use your production Supabase URL (*.supabase.co), '
        'or use 10.0.2.2 instead of localhost for a dev server on your Mac.';
  }
  if (supabaseHostIsLoopback && !kIsWeb) {
    return 'This build points at a loopback URL (localhost / 127.0.0.1). '
        'Use your production Supabase URL unless you intentionally run a local stack.';
  }
  switch (kind) {
    case TransportFailureKind.timeout:
      return 'The login request timed out. Try again in a moment.';
    case TransportFailureKind.socket:
    case TransportFailureKind.clientHttp:
      return 'Unable to connect to Adakaro servers. If the rest of the device '
          'browser works, check VPN/DNS, confirm SUPABASE_URL, or try another network.';
    case TransportFailureKind.handshake:
      return 'Secure connection to Adakaro servers failed (TLS). Check date/time, '
          'corporate proxy, or try another network.';
    case TransportFailureKind.unknown:
      return 'Unable to reach Adakaro login services. Try again or sign in with '
          'email after confirming the app configuration.';
  }
}

/// Maps PostgREST errors to actionable copy. Avoid blaming "Wi‑Fi" for API/body errors.
String userMessageForPostgrest(PostgrestException e) {
  final m = e.message;
  final low = m.toLowerCase();
  final code = e.code ?? '';
  final httpCode = int.tryParse(code);

  if (code == 'PGRST202' ||
      (low.contains('could not find') && low.contains('resolve_sign_in_email'))) {
    return 'Teacher login setup is incomplete on the server. Sign in with your '
        'email, or ask your admin to apply migration resolve_sign_in_email (00131+).';
  }
  if (code == '42501' || low.contains('permission denied')) {
    return 'Name-based sign-in is not allowed for this project. Sign in with the '
        'email address on your account.';
  }
  if (httpCode == 401 ||
      (low.contains('jwt') && (low.contains('invalid') || low.contains('expired')))) {
    return 'App configuration problem: Supabase rejected the anon key. Rebuild '
        'with the correct SUPABASE_ANON_KEY for this project.';
  }
  if (httpCode == 404) {
    return 'Login service path was not found. Check that SUPABASE_URL is the full '
        'https://…supabase.co URL for your project.';
  }
  if (httpCode != null && httpCode >= 500) {
    return 'Login service is temporarily unavailable. Try again shortly.';
  }
  return 'Could not resolve that account or complete lookup. Try your email address.';
}

String userMessageForAuthFailure(AuthException e) {
  final m = e.message.toLowerCase();
  final code = e.code?.toLowerCase() ?? '';
  if (code.contains('invalid_credentials') ||
      (m.contains('invalid') && m.contains('credential')) ||
      (m.contains('invalid') && m.contains('password')) ||
      m.contains('invalid login')) {
    return 'That identifier and password do not match. Check your details, or use '
        'Forgot password if you sign in with email.';
  }
  if (e is AuthRetryableFetchException) {
    return 'Unable to reach Adakaro authentication. Try again in a moment.';
  }
  return e.message;
}

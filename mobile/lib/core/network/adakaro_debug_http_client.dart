import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../auth/auth_login_diagnostics.dart';

/// Wraps [http.Client] to log Supabase-bound requests (URL, status; bodies redacted).
///
/// Sign-in uses `POST …/auth/v1/token?grant_type=password` — passwords and tokens are
/// never logged in full.
class AdakaroDebugHttpClient extends http.BaseClient {
  AdakaroDebugHttpClient(this._inner);

  final http.Client _inner;

  static bool _isLikelySupabaseRequest(Uri uri) {
    final h = uri.host.toLowerCase();
    return h.contains('supabase.co') ||
        h.contains('supabase.io') ||
        h.contains('supabase.net');
  }

  static String _redactRequestBody(String raw) {
    if (raw.isEmpty) return '(empty)';
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        final m = Map<String, dynamic>.from(decoded);
        for (final k in List<String>.from(m.keys)) {
          final lk = k.toLowerCase();
          if (lk == 'password' ||
              lk.contains('token') ||
              lk == 'refresh_token' ||
              lk == 'access_token') {
            m[k] = '***';
          }
        }
        return jsonEncode(m);
      }
    } catch (_) {}
    return '(non-JSON, ${raw.length} bytes)';
  }

  static String _redactAndClipResponse(String body, {int max = 900}) {
    var s = body.replaceAllMapped(
      RegExp(r'"(access_token|refresh_token)"\s*:\s*"[^"]*"'),
      (m) => '"${m.group(1)}":"***"',
    );
    if (s.length > max) {
      s = '${s.substring(0, max)}…';
    }
    return s;
  }

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final uri = request.url;
    final supa = _isLikelySupabaseRequest(uri);

    if (supa) {
      AuthLoginDiagnostics.logLine('Supabase HTTP → ${request.method} $uri');
      if (kDebugMode &&
          request is http.Request &&
          request.bodyBytes.isNotEmpty) {
        AuthLoginDiagnostics.logLine(
          'Supabase HTTP request body: ${_redactRequestBody(request.body)}',
        );
      }
    }

    final streamed = await _inner.send(request);
    if (!supa) return streamed;

    final response = await http.Response.fromStream(streamed);
    AuthLoginDiagnostics.logLine(
      'Supabase HTTP ← ${response.statusCode} $uri (${response.bodyBytes.length} bytes)',
    );
    if (kDebugMode && response.body.isNotEmpty) {
      AuthLoginDiagnostics.logLine(
        'Supabase HTTP response: ${_redactAndClipResponse(response.body)}',
      );
    }

    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      contentLength: response.contentLength,
      request: request,
      headers: response.headers,
      isRedirect: response.isRedirect,
      persistentConnection: response.persistentConnection,
      reasonPhrase: response.reasonPhrase,
    );
  }
}

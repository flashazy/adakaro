import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/env.dart';
import 'dns_lookup.dart';

/// Outcome of a direct HTTP check (bypasses some Supabase client layers).
class SupabasePingOutcome {
  SupabasePingOutcome({
    required this.label,
    required this.ok,
    required this.detail,
  });

  final String label;
  final bool ok;
  final String detail;
}

String get expectedAuthTokenUrl {
  final base = Env.supabaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
  return '$base/auth/v1/token?grant_type=password';
}

Future<SupabasePingOutcome> pingSupabaseRestRoot({
  Duration timeout = const Duration(seconds: 15),
}) async {
  final base = Env.supabaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.parse('$base/rest/v1/');
  final key = Env.supabaseAnonKey.trim();
  if (key.isEmpty) {
    return SupabasePingOutcome(
      label: 'REST GET /rest/v1/',
      ok: false,
      detail: 'SUPABASE_ANON_KEY is empty',
    );
  }
  final sw = Stopwatch()..start();
  try {
    final r = await http
        .get(
          uri,
          headers: {
            'apikey': key,
            'Authorization': 'Bearer $key',
            'Accept': 'application/json',
          },
        )
        .timeout(timeout);
    sw.stop();
    final ok = r.statusCode < 500;
    return SupabasePingOutcome(
      label: 'REST GET /rest/v1/',
      ok: ok,
      detail:
          'HTTP ${r.statusCode} in ${sw.elapsedMilliseconds}ms\nGET $uri\nBody (first 200 chars): ${_clip(r.body, 200)}',
    );
  } on TimeoutException catch (e) {
    sw.stop();
    return SupabasePingOutcome(
      label: 'REST GET /rest/v1/',
      ok: false,
      detail: 'Timeout after ${timeout.inSeconds}s\nGET $uri\n$e',
    );
  } catch (e) {
    sw.stop();
    return SupabasePingOutcome(
      label: 'REST GET /rest/v1/',
      ok: false,
      detail: 'GET $uri\nError: $e',
    );
  }
}

/// Public auth metadata endpoint (no user credentials in body).
Future<SupabasePingOutcome> pingSupabaseAuthSettings({
  Duration timeout = const Duration(seconds: 15),
}) async {
  final base = Env.supabaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.parse('$base/auth/v1/settings');
  final key = Env.supabaseAnonKey.trim();
  if (key.isEmpty) {
    return SupabasePingOutcome(
      label: 'Auth GET /auth/v1/settings',
      ok: false,
      detail: 'SUPABASE_ANON_KEY is empty',
    );
  }
  final sw = Stopwatch()..start();
  try {
    final r = await http
        .get(
          uri,
          headers: {
            'apikey': key,
            'Authorization': 'Bearer $key',
          },
        )
        .timeout(timeout);
    sw.stop();
    final ok = r.statusCode >= 200 && r.statusCode < 500;
    return SupabasePingOutcome(
      label: 'Auth GET /auth/v1/settings',
      ok: ok,
      detail:
          'HTTP ${r.statusCode} in ${sw.elapsedMilliseconds}ms\nGET $uri\nBody (first 300 chars): ${_clip(r.body, 300)}',
    );
  } on TimeoutException catch (e) {
    sw.stop();
    return SupabasePingOutcome(
      label: 'Auth GET /auth/v1/settings',
      ok: false,
      detail: 'Timeout after ${timeout.inSeconds}s\nGET $uri\n$e',
    );
  } catch (e) {
    sw.stop();
    return SupabasePingOutcome(
      label: 'Auth GET /auth/v1/settings',
      ok: false,
      detail: 'GET $uri\nError: $e',
    );
  }
}

Future<String> dnsLookupSupabaseHost() async {
  if (kIsWeb) return 'DNS lookup skipped on web.';
  final host = Uri.tryParse(Env.supabaseUrl.trim())?.host ?? '';
  if (host.isEmpty) return 'Invalid SUPABASE_URL';
  return dnsLookupHost(host);
}

String _clip(String s, int max) {
  if (s.length <= max) return s;
  return '${s.substring(0, max)}…';
}

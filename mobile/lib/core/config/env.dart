import 'package:flutter_dotenv/flutter_dotenv.dart';

import '../../config/supabase_config.dart';

/// Supabase and auth configuration.
///
/// Precedence for each key:
/// 1. `--dart-define=KEY=value` (compile-time; wins when non-empty)
/// 2. Bundled `.env` asset (optional — add `- .env` under `flutter: assets:`)
/// 3. [SupabaseConfig] production defaults (URL is always set; anon key must come from 1 or 2)
///
/// Same public values as the web app's `NEXT_PUBLIC_SUPABASE_*`. Never pass the service role key here.
abstract final class Env {
  static String get supabaseUrl => _normalizeSupabaseUrl(
        _pickWithFallback(
          const String.fromEnvironment('SUPABASE_URL', defaultValue: ''),
          'SUPABASE_URL',
          SupabaseConfig.supabaseUrl,
        ),
      );

  static String get supabaseAnonKey => _pickWithFallback(
        const String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: ''),
        'SUPABASE_ANON_KEY',
        SupabaseConfig.supabaseAnonKey,
      );

  /// Optional. Used by [resetPasswordForEmail] so the reset link can return to
  /// this app (custom scheme). Must be listed under Supabase Dashboard →
  /// Authentication → URL configuration → Redirect URLs.
  ///
  /// Example: `adakaro://auth-callback`
  static String get authRedirectUrl => _pickWithFallback(
        const String.fromEnvironment('AUTH_REDIRECT_URL', defaultValue: ''),
        'AUTH_REDIRECT_URL',
        '',
      );

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  static String _pickWithFallback(
    String fromDefine,
    String dotenvKey,
    String fallback,
  ) {
    final d = fromDefine.trim();
    if (d.isNotEmpty) return d;
    if (dotenv.isInitialized) {
      final v = dotenv.env[dotenvKey]?.trim() ?? '';
      if (v.isNotEmpty) return v;
    }
    return fallback.trim();
  }

  static String _normalizeSupabaseUrl(String u) {
    final s = u.trim();
    if (s.isEmpty) return s;
    return s.replaceAll(RegExp(r'/+$'), '');
  }
}

import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Supabase and auth configuration.
///
/// Precedence for each key:
/// 1. `--dart-define=KEY=value` (compile-time; wins when non-empty)
/// 2. Bundled `.env` asset (optional — add `- .env` under `flutter: assets:` and copy from `.env.example`)
/// 3. Bundled `.env.example` (tracked template with empty placeholders)
///
/// Same public values as the web app's `NEXT_PUBLIC_SUPABASE_*`. Never pass the service role key here.
abstract final class Env {
  static String get supabaseUrl => _pick(
        const String.fromEnvironment('SUPABASE_URL', defaultValue: ''),
        'SUPABASE_URL',
      );

  static String get supabaseAnonKey => _pick(
        const String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: ''),
        'SUPABASE_ANON_KEY',
      );

  /// Optional. Used by [resetPasswordForEmail] so the reset link can return to
  /// this app (custom scheme). Must be listed under Supabase Dashboard →
  /// Authentication → URL configuration → Redirect URLs.
  ///
  /// Example: `adakaro://auth-callback`
  static String get authRedirectUrl => _pick(
        const String.fromEnvironment('AUTH_REDIRECT_URL', defaultValue: ''),
        'AUTH_REDIRECT_URL',
      );

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  static String _pick(String fromDefine, String dotenvKey) {
    final d = fromDefine.trim();
    if (d.isNotEmpty) return d;
    if (!dotenv.isInitialized) return '';
    return dotenv.env[dotenvKey]?.trim() ?? '';
  }
}

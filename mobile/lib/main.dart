import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/auth/auth_login_diagnostics.dart';
import 'core/config/clear_local_supabase_cache.dart';
import 'core/config/env.dart';
import 'core/network/adakaro_debug_http_client.dart';

/// Values passed with `--dart-define` (non-empty entries win over dotenv files).
Map<String, String> _dartDefineEnv() {
  final m = <String, String>{};
  const u = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  const k = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');
  const r = String.fromEnvironment('AUTH_REDIRECT_URL', defaultValue: '');
  if (u.trim().isNotEmpty) m['SUPABASE_URL'] = u.trim();
  if (k.trim().isNotEmpty) m['SUPABASE_ANON_KEY'] = k.trim();
  if (r.trim().isNotEmpty) m['AUTH_REDIRECT_URL'] = r.trim();
  return m;
}

/// Loads dotenv before Supabase init.
///
/// 1. `await dotenv.load(fileName: ".env")` — optional bundled `.env` (add `- .env` to pubspec).
/// 2. Merge `.env.example`, then `--dart-define` values so defines always win.
Future<void> _loadDotenv() async {
  await dotenv.load(fileName: '.env', isOptional: true);
  final fromDot = Map<String, String>.from(dotenv.env);
  dotenv.loadFromString(
    envString: await rootBundle.loadString('.env.example'),
    mergeWith: {...fromDot, ..._dartDefineEnv()},
    isOptional: true,
  );
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await _loadDotenv();

  const clearAuthCache =
      bool.fromEnvironment('CLEAR_AUTH_CACHE', defaultValue: false);
  if (clearAuthCache) {
    await clearLocalSupabaseAuthCache(supabaseUrl: Env.supabaseUrl);
    if (kDebugMode) {
      debugPrint(
        'Adakaro: cleared local Supabase auth cache (CLEAR_AUTH_CACHE=true)',
      );
    }
  }

  if (kDebugMode) {
    debugPrint('Adakaro: effective SUPABASE_URL=${Env.supabaseUrl}');
    debugPrint(
      'Adakaro: SUPABASE_ANON_KEY set=${Env.supabaseAnonKey.isNotEmpty} '
      'length=${Env.supabaseAnonKey.length}',
    );
  }

  if (kDebugMode && !Env.isConfigured) {
    debugPrint(
      'Adakaro: Supabase anon key missing. URL may use [SupabaseConfig] default; '
      'set SUPABASE_ANON_KEY in mobile/.env (same as web NEXT_PUBLIC_SUPABASE_ANON_KEY) '
      'or --dart-define.',
    );
  }

  if (!Env.isConfigured) {
    runApp(const _MissingConfigApp());
    return;
  }

  if (kDebugMode) {
    debugPrint('Adakaro: Supabase.initialize → ${Env.supabaseUrl}');
  }

  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    httpClient: AdakaroDebugHttpClient(http.Client()),
    authOptions: const FlutterAuthClientOptions(
      /// Opens recovery / OAuth sessions when the app is launched from an email
      /// link or custom URL scheme (see README).
      detectSessionInUri: true,
    ),
  );

  if (kDebugMode) {
    AuthLoginDiagnostics.logStartupEnv();
  }

  runApp(const AdakaroApp());
}

/// Shown when the app is run without Supabase configuration.
class _MissingConfigApp extends StatelessWidget {
  const _MissingConfigApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Configuration required',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 16),
                const Text(
                  'The production Supabase URL is baked into `lib/config/supabase_config.dart` '
                  'and bundled `.env.example` as a fallback. You still need the **anon public key** '
                  '(same as web `NEXT_PUBLIC_SUPABASE_ANON_KEY`):\n\n'
                  '• Add `SUPABASE_ANON_KEY=...` to `mobile/.env` (copy from web `.env.local`), or\n'
                  '• `flutter run --dart-define=SUPABASE_ANON_KEY=...`\n\n'
                  'Precedence: `--dart-define` > `.env` > `supabase_config.dart` (URL only).\n\n'
                  'Clear cached auth session: '
                  '`flutter run --dart-define=CLEAR_AUTH_CACHE=true` (then remove the flag).\n\n'
                  'Optional: `--dart-define=AUTH_REDIRECT_URL=adakaro://auth-callback` '
                  'for in-app password reset.',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/config/env.dart';

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

  if (kDebugMode && !Env.isConfigured) {
    debugPrint(
      'Adakaro: Supabase keys missing. Use .env / .env.example assets or --dart-define.',
    );
  }

  if (!Env.isConfigured) {
    runApp(const _MissingConfigApp());
    return;
  }

  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      /// Opens recovery / OAuth sessions when the app is launched from an email
      /// link or custom URL scheme (see README).
      detectSessionInUri: true,
    ),
  );

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
                  'Add your public Supabase URL and anon key using either:\n\n'
                  '• Files: `flutter_dotenv` loads `.env.example` from assets, then an optional '
                  'bundled `.env` (list `- .env` under `flutter: assets:` in pubspec.yaml after '
                  '`cp .env.example .env`). Precedence: `--dart-define` > `.env` > `.env.example`.\n\n'
                  '• CLI: flutter run '
                  '--dart-define=SUPABASE_URL=... '
                  '--dart-define=SUPABASE_ANON_KEY=...\n\n'
                  '`--dart-define` always wins when set.\n\n'
                  'Optional: --dart-define=AUTH_REDIRECT_URL=adakaro://auth-callback\n'
                  'for in-app password reset (see mobile/README.md).',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

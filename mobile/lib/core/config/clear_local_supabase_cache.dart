import 'package:shared_preferences/shared_preferences.dart';

/// Removes persisted Supabase Auth / GoTrue keys from [SharedPreferences].
///
/// Use when switching `SUPABASE_URL` / anon key or if a corrupted session causes
/// strange network or refresh behaviour.
///
/// Run once with:
/// `flutter run --dart-define=CLEAR_AUTH_CACHE=true`
Future<void> clearLocalSupabaseAuthCache({required String supabaseUrl}) async {
  final prefs = await SharedPreferences.getInstance();
  final host = Uri.tryParse(supabaseUrl.trim())?.host ?? '';
  if (host.isNotEmpty) {
    final projectRef = host.split('.').first;
    await prefs.remove('sb-$projectRef-auth-token');
  }
  for (final k in prefs.getKeys().toList()) {
    if (k.startsWith('sb-') ||
        k.startsWith('supabase.auth') ||
        k.toLowerCase().contains('gotrue')) {
      await prefs.remove(k);
    }
  }
}

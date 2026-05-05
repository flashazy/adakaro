import 'package:supabase_flutter/supabase_flutter.dart';

/// User-facing copy for dashboard data load failures (network, RLS, etc.).
String friendlyDataLoadError(Object error) {
  if (error is AuthException) {
    return error.message;
  }
  final text = error.toString();
  if (text.contains('SocketException') ||
      text.contains('ClientException') ||
      text.contains('Failed host lookup')) {
    return 'Network error. Check your connection and try again.';
  }
  if (text.contains('PostgrestException')) {
    return 'Could not load data from the server. If this continues, contact your school.';
  }
  return 'Could not load your data. Try again in a moment.';
}

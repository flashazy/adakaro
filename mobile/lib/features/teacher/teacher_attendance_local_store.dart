import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Local draft + last-saved metadata for teacher attendance (per roster key).
class TeacherAttendanceLocalStore {
  TeacherAttendanceLocalStore._();

  static String sessionKey({
    required String teacherId,
    required String classId,
    required String? subjectId,
    required String dateYmd,
  }) {
    final sub = subjectId ?? '';
    return 'v1|$teacherId|$classId|$sub|$dateYmd';
  }

  static String _draftPrefsKey(String sessionKey) =>
      'teacher_attendance_draft_$sessionKey';

  static String _lastSavedPrefsKey(String sessionKey) =>
      'teacher_attendance_last_saved_$sessionKey';

  static Future<Map<String, String>?> readDraft(String sessionKey) async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_draftPrefsKey(sessionKey));
    if (raw == null || raw.isEmpty) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return map.map((k, v) => MapEntry(k, '$v'));
    } catch (_) {
      return null;
    }
  }

  static Future<void> writeDraft(
    String sessionKey,
    Map<String, String> studentIdToStatus,
  ) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(
      _draftPrefsKey(sessionKey),
      jsonEncode(studentIdToStatus),
    );
  }

  static Future<void> clearDraft(String sessionKey) async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_draftPrefsKey(sessionKey));
  }

  static Future<DateTime?> readLastSaved(String sessionKey) async {
    final p = await SharedPreferences.getInstance();
    final ms = p.getInt(_lastSavedPrefsKey(sessionKey));
    if (ms == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ms, isUtc: false);
  }

  static Future<void> writeLastSaved(
    String sessionKey,
    DateTime localTime,
  ) async {
    final p = await SharedPreferences.getInstance();
    await p.setInt(
      _lastSavedPrefsKey(sessionKey),
      localTime.millisecondsSinceEpoch,
    );
  }
}

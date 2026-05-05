import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_role.dart';

/// Resolves the user's role using the same sources as [web middleware]:
/// `is_super_admin` RPC, `profiles.role`, `is_teacher` RPC, and JWT metadata fallback.
class RoleService {
  RoleService(this._client);

  final SupabaseClient _client;

  Future<AppRole> resolveForSession(User user) async {
    final meta = (user.userMetadata?['role'] as String?)?.toLowerCase().trim();
    String fromMeta = 'parent';
    if (meta == 'admin') {
      fromMeta = 'admin';
    } else if (meta == 'teacher') {
      fromMeta = 'teacher';
    }

    var roleKey = fromMeta;

    try {
      final superRes = await _client.rpc<dynamic>('is_super_admin');
      if (superRes == true) {
        return AppRole.superAdminWeb;
      }
    } catch (_) {
      /* RPC missing or network */
    }

    final profile = await _client
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    final pr = (profile?['role'] as String?)?.toLowerCase().trim();
    if (pr == 'finance' || pr == 'accounts') {
      roleKey = 'admin';
    } else if (pr == 'admin' ||
        pr == 'parent' ||
        pr == 'super_admin' ||
        pr == 'teacher') {
      roleKey = pr!;
    }

    if (roleKey != 'super_admin' && roleKey != 'teacher') {
      try {
        final asTeacher = await _client.rpc<dynamic>('is_teacher');
        if (asTeacher == true) {
          roleKey = 'teacher';
        }
      } catch (_) {}
    }

    if (roleKey == 'super_admin') {
      return AppRole.superAdminWeb;
    }
    if (roleKey == 'teacher') {
      return AppRole.teacherMobile;
    }
    if (roleKey == 'admin') {
      final links = await _client
          .from('parent_students')
          .select('student_id')
          .eq('parent_id', user.id)
          .limit(1);
      final hasChild = (links as List<dynamic>).isNotEmpty;
      if (hasChild) {
        return AppRole.parentMobile;
      }
      return AppRole.adminWeb;
    }

    return AppRole.parentMobile;
  }

  Future<bool> isBlockedBySchoolSuspension() async {
    try {
      final v = await _client.rpc<dynamic>('is_user_blocked_by_school_suspension');
      return v == true;
    } catch (_) {
      return false;
    }
  }
}

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'teacher_main_scaffold.dart';

/// Routes here after login when session resolves to [AppRole.teacherMobile].
///
/// Implements the premium native teacher “working desk” (see web
/// `app/(dashboard)/teacher-dashboard`).
class TeacherHomeScreen extends StatelessWidget {
  const TeacherHomeScreen({super.key, required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    return TeacherMainScaffold(user: user);
  }
}

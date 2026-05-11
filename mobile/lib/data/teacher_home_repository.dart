// Back-compat wrapper; use TeacherRepository for new code.
export 'models/teacher_models.dart';
export 'teacher_repository.dart';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'models/teacher_models.dart';
import 'teacher_repository.dart';

class TeacherHomeRepository {
  TeacherHomeRepository(SupabaseClient client)
      : _inner = TeacherRepository(client);

  final TeacherRepository _inner;

  Future<TeacherDeskData> load(String teacherId) => _inner.loadDesk(teacherId);
}

import 'package:supabase_flutter/supabase_flutter.dart';

import 'models/teacher_home_models.dart';

String? _subjectNameFromJoin(dynamic subjects) {
  if (subjects is Map<String, dynamic>) {
    return subjects['name'] as String?;
  }
  if (subjects is List && subjects.isNotEmpty && subjects.first is Map) {
    return (subjects.first as Map)['name'] as String?;
  }
  return null;
}

class TeacherHomeRepository {
  TeacherHomeRepository(this._client);

  final SupabaseClient _client;

  Future<TeacherHomeData> load(String teacherId) async {
    final profile = await _client
        .from('profiles')
        .select('full_name')
        .eq('id', teacherId)
        .maybeSingle();

    final teacherName = profile?['full_name'] as String?;

    final taRes = await _client
        .from('teacher_assignments')
        .select(
          'id, class_id, school_id, subject, academic_year, subject_id, subjects(name)',
        )
        .eq('teacher_id', teacherId)
        .order('academic_year', ascending: false);

    final taRows = (taRes as List<dynamic>).cast<Map<String, dynamic>>();

    final classIds = taRows.map((r) => r['class_id'] as String).toSet().toList();

    final classNames = <String, String>{};
    if (classIds.isNotEmpty) {
      final classesRes = await _client
          .from('classes')
          .select('id, name')
          .inFilter('id', classIds);
      for (final c in (classesRes as List<dynamic>).cast<Map<String, dynamic>>()) {
        classNames[c['id'] as String] = (c['name'] as String?)?.trim().isNotEmpty == true
            ? c['name'] as String
            : 'Class';
      }
    }

    final tsRes = await _client
        .from('teacher_subjects')
        .select('subject_id, subjects(name)')
        .eq('teacher_id', teacherId);

    final catalog = <TeacherCatalogSubject>[];
    final seenSubject = <String>{};
    for (final row in (tsRes as List<dynamic>).cast<Map<String, dynamic>>()) {
      final sid = row['subject_id'] as String?;
      if (sid == null || seenSubject.contains(sid)) continue;
      final name = _subjectNameFromJoin(row['subjects'])?.trim();
      if (name == null || name.isEmpty) continue;
      seenSubject.add(sid);
      catalog.add(TeacherCatalogSubject(subjectId: sid, name: name));
    }
    catalog.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    final assignments = <TeacherAssignmentDisplay>[];
    for (final r in taRows) {
      final classId = r['class_id'] as String;
      final joined = _subjectNameFromJoin(r['subjects'])?.trim();
      final legacy = (r['subject'] as String?)?.trim();
      final subjectLabel = (joined != null && joined.isNotEmpty)
          ? joined
          : (legacy != null && legacy.isNotEmpty)
              ? legacy
              : 'Subject';
      assignments.add(
        TeacherAssignmentDisplay(
          id: r['id'] as String,
          classId: classId,
          className: classNames[classId] ?? 'Class',
          schoolId: r['school_id'] as String,
          subjectLabel: subjectLabel,
          academicYear: (r['academic_year'] as String?)?.trim() ?? '',
        ),
      );
    }

    final studentsByClassId = <String, List<TeacherStudentMini>>{};
    if (classIds.isNotEmpty) {
      final studentsRes = await _client
          .from('students')
          .select('id, full_name, admission_number, class_id, status')
          .inFilter('class_id', classIds)
          .order('full_name');

      for (final s in (studentsRes as List<dynamic>).cast<Map<String, dynamic>>()) {
        final cid = s['class_id'] as String;
        studentsByClassId.putIfAbsent(cid, () => []);
        studentsByClassId[cid]!.add(
          TeacherStudentMini(
            id: s['id'] as String,
            fullName: (s['full_name'] as String?)?.trim().isNotEmpty == true
                ? s['full_name'] as String
                : 'Student',
            admissionNumber: s['admission_number'] as String?,
            classId: cid,
            status: s['status'] as String?,
          ),
        );
      }
    }

    return TeacherHomeData(
      teacherName: teacherName,
      assignments: assignments,
      catalogSubjects: catalog,
      studentsByClassId: studentsByClassId,
      classNames: classNames,
    );
  }
}

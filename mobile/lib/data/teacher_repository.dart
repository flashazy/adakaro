import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/attendance/teacher_attendance_status.dart';
import '../core/gradebook/gradebook_assignment_delete_guard.dart';
import 'models/teacher_models.dart';
import 'teacher_enrollment.dart';

/// Normalizes `teacher_department_roles.department` to DB check constraint values.
String? _canonicalTeacherDepartment(dynamic raw) {
  final d = '${raw ?? ''}'.trim().toLowerCase();
  if (d.isEmpty) return null;
  switch (d) {
    case 'academic':
    case 'discipline':
    case 'health':
    case 'finance':
    case 'accounts':
      return d;
    default:
      if (kDebugMode) {
        debugPrint(
          '[TeacherDesk] Unknown department value from DB (ignored for UI): "$d"',
        );
      }
      return null;
  }
}

String? _subjectNameFromJoin(dynamic subjects) {
  if (subjects is Map<String, dynamic>) {
    return subjects['name'] as String?;
  }
  if (subjects is List && subjects.isNotEmpty && subjects.first is Map) {
    return (subjects.first as Map)['name'] as String?;
  }
  return null;
}

class TeacherRepository {
  TeacherRepository(this._client);

  final SupabaseClient _client;

  Future<TeacherDeskData> loadDesk(String teacherId) async {
    final profile = await _client
        .from('profiles')
        .select('full_name, role')
        .eq('id', teacherId)
        .maybeSingle();

    final teacherName = profile?['full_name'] as String?;
    final profileRole =
        '${profile?['role'] ?? ''}'.trim().toLowerCase();
    final hasProfileFinanceAccess =
        profileRole == 'finance' || profileRole == 'accounts';

    final deptRes = await _client
        .from('teacher_department_roles')
        .select('school_id, department')
        .eq('user_id', teacherId);

    final teacherDepartments = <String>{};
    String? anyDepartmentSchoolId;
    String? academicDepartmentSchoolId;
    for (final row in (deptRes as List<dynamic>).cast<Map<String, dynamic>>()) {
      final dep = _canonicalTeacherDepartment(row['department']);
      if (dep != null) teacherDepartments.add(dep);
      final sid = row['school_id'] as String?;
      if (sid != null && sid.trim().isNotEmpty) {
        anyDepartmentSchoolId ??= sid;
        if (dep == 'academic') academicDepartmentSchoolId = sid;
      }
    }
    final departmentContextSchoolId =
        academicDepartmentSchoolId ?? anyDepartmentSchoolId;

    final coordRes = await _client
        .from('teacher_coordinators')
        .select('id')
        .eq('teacher_id', teacherId)
        .limit(1);
    final isCoordinator = (coordRes as List<dynamic>).isNotEmpty;

    final taRes = await _client
        .from('teacher_assignments')
        .select(
          'id, class_id, school_id, subject, academic_year, subject_id, subjects(name)',
        )
        .eq('teacher_id', teacherId)
        .order('academic_year', ascending: false);

    final taRows = (taRes as List<dynamic>).cast<Map<String, dynamic>>();
    final hasTeachingAssignments = taRows.isNotEmpty;

    final classIds = taRows.map((r) => r['class_id'] as String).toSet().toList();

    final classTeacherRes = await _client
        .from('classes')
        .select('id, name, school_id')
        .eq('class_teacher_id', teacherId)
        .order('name');

    final classTeacherClasses = (classTeacherRes as List<dynamic>)
        .map(
          (c) => TeacherClassTeacherBrief(
            id: (c as Map<String, dynamic>)['id'] as String,
            name:
                '${(c['name'] as String?)?.trim().isNotEmpty == true ? c['name'] : 'Class'}',
            schoolId: c['school_id'] as String?,
          ),
        )
        .toList();

    final classNames = <String, String>{};
    final schoolIds = <String>{};
    for (final r in taRows) {
      schoolIds.add(r['school_id'] as String);
    }
    for (final c in classTeacherClasses) {
      if (c.schoolId != null) schoolIds.add(c.schoolId!);
    }

    if (classIds.isNotEmpty) {
      final classesRes = await _client
          .from('classes')
          .select('id, name')
          .inFilter('id', classIds);
      for (final c in (classesRes as List<dynamic>).cast<Map<String, dynamic>>()) {
        classNames[c['id'] as String] =
            (c['name'] as String?)?.trim().isNotEmpty == true
                ? c['name'] as String
                : 'Class';
      }
    }

    String? primarySchoolName;
    String? schoolLevel;
    String? primarySchoolLogoUrl;
    if (schoolIds.isNotEmpty) {
      final sid = schoolIds.first;
      final sch = await _client
          .from('schools')
          .select('name, school_level, logo_url')
          .eq('id', sid)
          .maybeSingle();
      primarySchoolName = sch?['name'] as String?;
      schoolLevel = (sch?['school_level'] as String?)?.trim().toLowerCase();
      if (schoolLevel != 'primary' && schoolLevel != 'secondary') {
        schoolLevel = null;
      }
      final logoTrimmed = (sch?['logo_url'] as String?)?.trim();
      primarySchoolLogoUrl =
          (logoTrimmed != null && logoTrimmed.isNotEmpty) ? logoTrimmed : null;
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
          subjectId: r['subject_id'] as String?,
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
            fullName:
                (s['full_name'] as String?)?.trim().isNotEmpty == true
                    ? s['full_name'] as String
                    : 'Student',
            admissionNumber: s['admission_number'] as String?,
            classId: cid,
            status: s['status'] as String?,
          ),
        );
      }
    }

    TeacherLockedContact? lockedContact;
    if (!hasTeachingAssignments && classTeacherClasses.isEmpty) {
      lockedContact = await _tryLoadLockedContact(teacherId);
    }

    final resolvedSchoolLogoUrl =
        primarySchoolLogoUrl ?? lockedContact?.schoolLogoUrl;

    if (kDebugMode) {
      final deptDbg = teacherDepartments.toList()..sort();
      final ctDbg =
          classTeacherClasses.map((c) => '${c.id}:${c.name}').toList();
      debugPrint(
        '[TeacherDesk] teacherId=$teacherId '
        'teacher_department_roles=$deptDbg '
        'isCoordinator=$isCoordinator '
        'classTeacherClasses=$ctDbg '
        'profileRole=${profile?['role']} '
        'hasProfileFinanceAccess=$hasProfileFinanceAccess',
      );
    }

    return TeacherDeskData(
      teacherName: teacherName,
      primarySchoolName: primarySchoolName,
      schoolLevel: schoolLevel,
      schoolLogoUrl: resolvedSchoolLogoUrl,
      assignments: assignments,
      catalogSubjects: catalog,
      studentsByClassId: studentsByClassId,
      classNames: classNames,
      hasTeachingAssignments: hasTeachingAssignments,
      classTeacherClasses: classTeacherClasses,
      lockedContact: lockedContact,
      teacherDepartments: teacherDepartments,
      isCoordinator: isCoordinator,
      hasProfileFinanceAccess: hasProfileFinanceAccess,
      departmentContextSchoolId: departmentContextSchoolId,
    );
  }

  Future<TeacherLockedContact?> _tryLoadLockedContact(String teacherId) async {
    try {
      final mem = await _client
          .from('school_members')
          .select('school_id')
          .eq('user_id', teacherId)
          .eq('role', 'teacher')
          .maybeSingle();

      final schoolId = mem?['school_id'] as String?;
      if (schoolId == null) return null;

      final school = await _client
          .from('schools')
          .select('name, logo_url')
          .eq('id', schoolId)
          .maybeSingle();
      final schoolName =
          (school?['name'] as String?)?.trim().isNotEmpty == true
              ? school!['name'] as String
              : 'Your school';
      final logoTrimmed = (school?['logo_url'] as String?)?.trim();
      final schoolLogoUrl = (logoTrimmed != null && logoTrimmed.isNotEmpty)
          ? logoTrimmed
          : null;

      final adminMem = await _client
          .from('school_members')
          .select('user_id')
          .eq('school_id', schoolId)
          .eq('role', 'admin')
          .order('created_at', ascending: true)
          .limit(1)
          .maybeSingle();

      final adminUserId = adminMem?['user_id'] as String?;
      if (adminUserId == null) {
        return TeacherLockedContact(
          schoolName: schoolName,
          adminName: 'School administrator',
          schoolLogoUrl: schoolLogoUrl,
        );
      }

      final prof = await _client
          .from('profiles')
          .select('full_name, email, phone')
          .eq('id', adminUserId)
          .maybeSingle();

      final phoneRaw = '${prof?['phone'] ?? ''}'.trim();

      return TeacherLockedContact(
        schoolName: schoolName,
        adminName:
            '${prof?['full_name'] ?? ''}'.trim().isNotEmpty
                ? prof!['full_name'] as String
                : 'School administrator',
        adminEmail: prof?['email'] as String?,
        adminPhone: phoneRaw.isNotEmpty ? phoneRaw : null,
        schoolLogoUrl: schoolLogoUrl,
      );
    } catch (_) {
      return null;
    }
  }

  Future<String?> schoolIdForClassInTeacherCluster({
    required String teacherId,
    required String classId,
  }) async {
    final cluster = await teacherResolveClassCluster(_client, classId);
    final ta = await _client
        .from('teacher_assignments')
        .select('school_id')
        .eq('teacher_id', teacherId)
        .inFilter('class_id', cluster.classIds)
        .limit(1)
        .maybeSingle();
    return ta?['school_id'] as String?;
  }

  Future<Map<String, String>> loadAttendanceForDate({
    required String teacherId,
    required String classId,
    required String dateYmd,
    required String? subjectId,
  }) async {
    final rows = await _client
        .from('teacher_attendance')
        .select('student_id, status, subject_id')
        .eq('teacher_id', teacherId)
        .eq('class_id', classId)
        .eq('attendance_date', dateYmd);
    final out = <String, String>{};
    for (final r in (rows as List<dynamic>).cast<Map<String, dynamic>>()) {
      final sid = r['student_id'] as String?;
      final st = r['status'] as String?;
      final sub = r['subject_id'] as String?;
      final wantSub = subjectId?.trim().isNotEmpty == true ? subjectId : null;
      if (wantSub == null) {
        if (sub != null) continue;
      } else if (sub != wantSub) {
        continue;
      }
      if (sid != null && st != null) {
        out[sid] = normalizeTeacherAttendanceStatus(st);
      }
    }
    return out;
  }

  Future<void> upsertAttendanceRow({
    required String teacherId,
    required String schoolId,
    required String classId,
    required String studentId,
    required String dateYmd,
    required String status,
    String? subjectId,
  }) async {
    final normalized = status.toLowerCase().trim();
    if (normalized != 'present' &&
        normalized != 'absent' &&
        normalized != 'late') {
      throw ArgumentError('Invalid attendance status');
    }

    final existing = await _client
        .from('teacher_attendance')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .eq('attendance_date', dateYmd)
        .eq(
          'attendance_scope_key',
          (subjectId != null && subjectId.isNotEmpty) ? subjectId : '',
        )
        .maybeSingle();

    if (existing != null && existing['id'] != null) {
      await _client.from('teacher_attendance').update({
        'status': normalized,
        'subject_id': subjectId,
      }).eq('id', existing['id'] as String);
    } else {
      await _client.from('teacher_attendance').insert({
        'teacher_id': teacherId,
        'school_id': schoolId,
        'class_id': classId,
        'student_id': studentId,
        'attendance_date': dateYmd,
        'status': normalized,
        'subject_id': subjectId,
      });
    }
  }

  Future<List<TeacherGradebookAssignmentMini>> loadGradebookAssignments({
    required String teacherId,
    required String classId,
    required String subjectLabel,
  }) async {
    final cluster = await teacherResolveClassCluster(_client, classId);
    List<String> classIdsForQuery;
    final parentIdRow = await _client
        .from('classes')
        .select('parent_class_id')
        .eq('id', classId)
        .maybeSingle();
    final parentId = parentIdRow?['parent_class_id'] as String?;
    if (parentId != null) {
      classIdsForQuery = [classId, parentId];
    } else {
      classIdsForQuery = cluster.classIds.contains(classId)
          ? cluster.classIds
          : [classId];
    }

    final res = await _client
        .from('teacher_gradebook_assignments')
        .select(
          'id, title, max_score, weight, due_date, subject, term, academic_year, created_at, exam_type',
        )
        .eq('teacher_id', teacherId)
        .inFilter('class_id', classIdsForQuery)
        .order('created_at', ascending: false);

    final subjectLower = subjectLabel.trim().toLowerCase();
    final rows = (res as List<dynamic>).cast<Map<String, dynamic>>();
    final filtered = rows
        .where(
          (r) =>
              '${r['subject']}'.trim().toLowerCase() == subjectLower,
        )
        .toList();

    return filtered.map(_mapGradebookRow).toList();
  }

  bool _gradebookTermMatches(String? rowTerm, String selectedTerm) {
    final t = (rowTerm ?? '').trim();
    if (t.isEmpty) return true;
    return t == selectedTerm;
  }

  TeacherGradebookAssignmentMini _mapGradebookRow(Map<String, dynamic> r) {
    final etRaw = r['exam_type'];
    final examType = etRaw is String && etRaw.trim().isNotEmpty ? etRaw : null;
    return TeacherGradebookAssignmentMini(
      id: r['id'] as String,
      title: (r['title'] as String?)?.trim().isNotEmpty == true
          ? r['title'] as String
          : 'Assignment',
      maxScore: (r['max_score'] is num)
          ? (r['max_score'] as num).toDouble()
          : double.tryParse('${r['max_score']}') ?? 100,
      weight: (r['weight'] is num)
          ? (r['weight'] as num).toDouble()
          : double.tryParse('${r['weight']}') ?? 100,
      subject: '${r['subject']}',
      dueDate: r['due_date'] as String?,
      term: r['term'] as String?,
      academicYear: r['academic_year'] as String?,
      createdAt: r['created_at'] as String?,
      examType: examType,
    );
  }

  /// Web `loadGradebookClassMatrix` — assignments + roster + score matrix for a term.
  Future<TeacherGradebookMatrixSnapshot> loadGradebookClassMatrix({
    required String teacherId,
    required String classId,
    required String subjectLabel,
    required String term,
    required String? subjectId,
  }) async {
    final cluster = await teacherResolveClassCluster(_client, classId);
    List<String> classIdsForQuery;
    final parentIdRow = await _client
        .from('classes')
        .select('parent_class_id')
        .eq('id', classId)
        .maybeSingle();
    final parentId = parentIdRow?['parent_class_id'] as String?;
    if (parentId != null) {
      classIdsForQuery = [classId, parentId];
    } else {
      classIdsForQuery = cluster.classIds.contains(classId)
          ? cluster.classIds
          : [classId];
    }

    final res = await _client
        .from('teacher_gradebook_assignments')
        .select(
          'id, title, max_score, weight, due_date, subject, term, academic_year, created_at, exam_type',
        )
        .eq('teacher_id', teacherId)
        .inFilter('class_id', classIdsForQuery)
        .order('created_at', ascending: true);

    final subjectLower = subjectLabel.trim().toLowerCase();
    final rows = (res as List<dynamic>).cast<Map<String, dynamic>>();
    final filtered = rows
        .where(
          (r) =>
              '${r['subject']}'.trim().toLowerCase() == subjectLower &&
              _gradebookTermMatches(r['term'] as String?, term),
        )
        .toList();

    final assignments = filtered.map(_mapGradebookRow).toList();

    final ay = filtered.isNotEmpty
        ? enrollmentYearFromAssignmentString(
            filtered.first['academic_year'] as String?,
          )
        : teacherCurrentEnrollmentPeriod().academicYear;

    final rosterMaps = await teacherGetStudentsForSubject(
      _client,
      classId: classId,
      subjectId: subjectId,
      academicYear: ay,
      term: term,
      enrollmentDateOnOrBefore: null,
    );

    final students = rosterMaps
        .map(
          (m) => TeacherEvaluateStudentRow(
            id: m['id']!,
            fullName: m['full_name'] ?? 'Student',
            gender: _normalizeGender(m['gender']),
          ),
        )
        .toList();

    final assignmentIds = assignments.map((a) => a.id).toList();
    final scoreMatrix = <String, Map<String, TeacherEvaluateScoreCell>>{};

    if (assignmentIds.isNotEmpty) {
      final scoreRes = await _client
          .from('teacher_scores')
          .select('assignment_id, student_id, score, remarks, comments')
          .inFilter('assignment_id', assignmentIds);

      for (final r in (scoreRes as List<dynamic>).cast<Map<String, dynamic>>()) {
        final aid = r['assignment_id'] as String;
        final sid = r['student_id'] as String;
        final sc = r['score'];
        double? val;
        if (sc is num) {
          val = sc.toDouble();
        } else if (sc != null) {
          val = double.tryParse('$sc');
        }
        final rem = (r['remarks'] as String?)?.trim();
        final com = (r['comments'] as String?)?.trim();
        final remarks = (rem != null && rem.isNotEmpty) ? rem : com;
        scoreMatrix.putIfAbsent(aid, () => {});
        scoreMatrix[aid]![sid] = TeacherEvaluateScoreCell(
          score: val,
          remarks: remarks,
        );
      }
    }

    return TeacherGradebookMatrixSnapshot(
      assignments: assignments,
      students: students,
      scoreMatrix: scoreMatrix,
    );
  }

  String? _normalizeGender(String? raw) {
    final g = (raw ?? '').trim().toLowerCase();
    if (g.isEmpty) return null;
    if (g == 'm' || g == 'male') return 'male';
    if (g == 'f' || g == 'female') return 'female';
    return g;
  }

  Future<TeacherEvaluateReportMeta> loadEvaluateReportMeta({
    required String teacherId,
    required String classId,
    required String subjectLabel,
  }) async {
    final cluster = await teacherResolveClassCluster(_client, classId);
    final clsRow = await _client
        .from('classes')
        .select('name, school_id')
        .eq('id', classId)
        .maybeSingle();

    var className = 'Class';
    var schoolName = 'School';
    if (clsRow != null) {
      className =
          (clsRow['name'] as String?)?.trim().isNotEmpty == true
              ? clsRow['name'] as String
              : className;
      final schId = clsRow['school_id'] as String?;
      if (schId != null) {
        final sch = await _client
            .from('schools')
            .select('name')
            .eq('id', schId)
            .maybeSingle();
        schoolName =
            ((sch?['name'] as String?)?.trim().isNotEmpty == true)
                ? sch!['name'] as String
                : schoolName;
      }
    }

    final subj = subjectLabel.trim();
    final taRes = await _client
        .from('teacher_assignments')
        .select('academic_year')
        .eq('teacher_id', teacherId)
        .inFilter('class_id', cluster.classIds)
        .eq('subject', subj)
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();

    var termLabel = (taRes?['academic_year'] as String?)?.trim();
    termLabel = (termLabel != null && termLabel.isNotEmpty) ? termLabel : '—';

    final prof = await _client
        .from('profiles')
        .select('full_name')
        .eq('id', teacherId)
        .maybeSingle();
    final teacherName =
        (prof?['full_name'] as String?)?.trim().isNotEmpty == true
            ? prof!['full_name'] as String
            : 'Teacher';

    return TeacherEvaluateReportMeta(
      schoolName: schoolName,
      className: className,
      subject: subj,
      teacherName: teacherName,
      termLabel: termLabel,
    );
  }

  Future<Map<String, double?>> loadScores({
    required String assignmentId,
  }) async {
    final res = await _client
        .from('teacher_scores')
        .select('student_id, score')
        .eq('assignment_id', assignmentId);

    final out = <String, double?>{};
    for (final r in (res as List<dynamic>).cast<Map<String, dynamic>>()) {
      final sid = r['student_id'] as String;
      final sc = r['score'];
      double? val;
      if (sc == null) {
        val = null;
      } else if (sc is num) {
        val = sc.toDouble();
      } else {
        val = double.tryParse('$sc');
      }
      out[sid] = val;
    }
    return out;
  }

  Future<void> upsertScore({
    required String assignmentId,
    required String studentId,
    double? score,
  }) async {
    final existing = await _client
        .from('teacher_scores')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .maybeSingle();

    if (score == null || score.isNaN) {
      if (existing != null) {
        await _client
            .from('teacher_scores')
            .delete()
            .eq('id', existing['id'] as String);
      }
      return;
    }

    if (existing != null) {
      await _client.from('teacher_scores').update({'score': score}).eq(
            'id',
            existing['id'] as String,
          );
    } else {
      await _client.from('teacher_scores').insert({
        'assignment_id': assignmentId,
        'student_id': studentId,
        'score': score,
      });
    }
  }

  Future<String?> createGradebookAssignment({
    required String teacherId,
    required String classId,
    required String subject,
    required String title,
    required double maxScore,
    double weight = 100,
    String? dueDate,
    String? term,
  }) async {
    final ay = '${DateTime.now().year}';
    final termVal =
        term == 'Term 1' || term == 'Term 2' ? term : null;

    final res = await _client
        .from('teacher_gradebook_assignments')
        .insert({
          'teacher_id': teacherId,
          'class_id': classId,
          'subject': subject.trim(),
          'title': title.trim(),
          'max_score': maxScore,
          'weight': weight,
          'due_date': (dueDate != null && dueDate.isNotEmpty) ? dueDate : null,
          'academic_year': ay,
          if (termVal != null) 'term': termVal,
        })
        .select('id')
        .maybeSingle();
    return res?['id'] as String?;
  }

  /// Deletes a gradebook assignment; [teacher_scores] cascade from DB FK.
  /// Returns `null` on success, or a short error if missing / not deletable.
  Future<String?> deleteGradebookAssignment(String assignmentId) async {
    final row = await _client
        .from('teacher_gradebook_assignments')
        .select('id, title, exam_type')
        .eq('id', assignmentId)
        .maybeSingle();
    if (row == null) return 'Assignment not found.';
    final title = (row['title'] as String?)?.trim().isNotEmpty == true
        ? row['title'] as String
        : 'Assignment';
    final etRaw = row['exam_type'];
    final examType = etRaw is String ? etRaw : null;
    if (!isTeacherGradebookAssignmentDeletable(
      title: title,
      examType: examType,
    )) {
      return 'This assignment cannot be deleted.';
    }
    await _client
        .from('teacher_gradebook_assignments')
        .delete()
        .eq('id', assignmentId);
    return null;
  }

  Future<List<TeacherLessonPlanListRow>> loadLessonPlans(String teacherId) async {
    final res = await _client
        .from('lesson_plans')
        .select(
          'id, lesson_date, period, duration_minutes, classes:class_id(name), subjects:subject_id(name)',
        )
        .eq('teacher_id', teacherId)
        .order('lesson_date', ascending: false)
        .limit(200);

    final out = <TeacherLessonPlanListRow>[];
    for (final r in (res as List<dynamic>).cast<Map<String, dynamic>>()) {
      final cls = r['classes'];
      final sub = r['subjects'];
      String className = 'Class';
      if (cls is Map) className = '${cls['name'] ?? className}';
      if (cls is List && cls.isNotEmpty && cls.first is Map) {
        className = '${(cls.first as Map)['name'] ?? className}';
      }
      String subjectName = '';
      if (sub is Map) subjectName = '${sub['name'] ?? ''}';
      if (sub is List && sub.isNotEmpty && sub.first is Map) {
        subjectName = '${(sub.first as Map)['name'] ?? ''}';
      }

      final periodVal = r['period'];
      out.add(
        TeacherLessonPlanListRow(
          id: r['id'] as String,
          lessonDate: '${r['lesson_date']}',
          period: periodVal == null ? '' : '$periodVal',
          className: className,
          subjectName: subjectName.trim().isNotEmpty ? subjectName : 'Subject',
          durationMinutes: (r['duration_minutes'] is num)
              ? (r['duration_minutes'] as num).toInt()
              : int.tryParse('${r['duration_minutes']}') ?? 0,
        ),
      );
    }
    return out;
  }

  Future<Map<String, dynamic>?> loadLessonPlanDetail(
    String id,
    String teacherId,
  ) async {
    final row = await _client
        .from('lesson_plans')
        .select('*')
        .eq('id', id)
        .eq('teacher_id', teacherId)
        .maybeSingle();
    if (row == null) return null;
    return Map<String, dynamic>.from(row as Map);
  }

  Future<void> insertLessonPlan({
    required String teacherId,
    required Map<String, dynamic> payload,
  }) async {
    await _client.from('lesson_plans').insert({
      ...payload,
      'teacher_id': teacherId,
    });
  }

  Future<void> updateLessonPlan({
    required String id,
    required String teacherId,
    required Map<String, dynamic> patch,
  }) async {
    await _client.from('lesson_plans').update(patch).eq('id', id).eq(
          'teacher_id',
          teacherId,
        );
  }

  Future<List<TeacherDocumentRow>> loadDocuments(String teacherId) async {
    final res = await _client
        .from('teacher_documents')
        .select(
          'id, document_name, file_url, file_type, file_size, category, uploaded_at',
        )
        .eq('teacher_id', teacherId)
        .order('uploaded_at', ascending: false);

    return (res as List<dynamic>)
        .map(
          (r) => TeacherDocumentRow(
            id: (r as Map<String, dynamic>)['id'] as String,
            documentName: '${r['document_name']}',
            fileUrl: '${r['file_url']}',
            fileType: '${r['file_type']}',
            category: '${r['category'] ?? 'Other'}',
            fileSize: r['file_size'] as int?,
            uploadedAt: '${r['uploaded_at']}',
          ),
        )
        .toList();
  }

  /// Stored `file_url` is usually a Storage object path (`userId/uuid.ext`).
  Future<String?> signedTeacherDocUrl(
    String fileUrlOrPath, {
    int expiresSec = 3600,
  }) async {
    final t = fileUrlOrPath.trim();
    if (t.isEmpty) return null;
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    try {
      return await _client.storage
          .from('teacher-docs')
          .createSignedUrl(t, expiresSec);
    } catch (_) {
      return null;
    }
  }

  Future<void> insertDocumentRow({
    required String teacherId,
    required String name,
    required String fileUrl,
    required String fileType,
    required String category,
    int? fileSize,
  }) async {
    await _client.from('teacher_documents').insert({
      'teacher_id': teacherId,
      'document_name': name,
      'file_url': fileUrl,
      'file_type': fileType,
      'category': category,
      'file_size': fileSize,
    });
  }

  Future<List<Map<String, dynamic>>> loadAcademicReportsForSchool(
    String schoolId,
  ) async {
    try {
      final res = await _client
          .from('academic_reports')
          .select(
            'id, class_id, term, academic_year, generated_at, classes(name)',
          )
          .eq('school_id', schoolId)
          .order('generated_at', ascending: false)
          .limit(50);
      return (res as List<dynamic>)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<int> countLessonPlansToday({
    required String teacherId,
    required List<String> classIds,
    required String lessonDate,
  }) async {
    if (classIds.isEmpty) return 0;
    final res = await _client
        .from('lesson_plans')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('lesson_date', lessonDate)
        .inFilter('class_id', classIds);
    return (res as List?)?.length ?? 0;
  }

  /// Distinct students marked [present] or [late] today (late counts as attended).
  Future<int> countAttendanceTodayDedup({
    required String teacherId,
    required String dateYmd,
  }) async {
    final res = await _client
        .from('teacher_attendance')
        .select('student_id, status')
        .eq('teacher_id', teacherId)
        .eq('attendance_date', dateYmd);

    final attendedStudentIds = <String>{};
    for (final r in (res as List<dynamic>).cast<Map<String, dynamic>>()) {
      final sid = r['student_id'] as String?;
      final st = normalizeTeacherAttendanceStatus(r['status'] as String?);
      if (sid != null && teacherAttendanceCountsAsAttended(st)) {
        attendedStudentIds.add(sid);
      }
    }
    return attendedStudentIds.length;
  }
}

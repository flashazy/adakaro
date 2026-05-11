import 'package:supabase_flutter/supabase_flutter.dart';

/// Mirrors web `getCurrentAcademicYearAndTerm` (Sept–Dec → Term 2).
({int academicYear, String term}) teacherCurrentEnrollmentPeriod() {
  final d = DateTime.now();
  final m = d.month;
  if (m >= 9) {
    return (academicYear: d.year, term: 'Term 2');
  }
  return (academicYear: d.year, term: 'Term 1');
}

class ClassClusterInfo {
  const ClassClusterInfo({
    required this.classIds,
    required this.rootClassId,
    required this.childClassIds,
    required this.isParent,
  });

  final List<String> classIds;
  final String rootClassId;
  final List<String> childClassIds;
  final bool isParent;
}

/// Same shape as web `resolveClassCluster` (parent/child streams).
Future<ClassClusterInfo> teacherResolveClassCluster(
  SupabaseClient client,
  String classId,
) async {
  final selfRow = await client
      .from('classes')
      .select('id, parent_class_id')
      .eq('id', classId)
      .maybeSingle();

  if (selfRow == null) {
    return ClassClusterInfo(
      classIds: [classId],
      rootClassId: classId,
      childClassIds: const [],
      isParent: false,
    );
  }

  final selfId = selfRow['id'] as String;
  final parentId = selfRow['parent_class_id'] as String?;

  final rootClassId = parentId ?? selfId;

  final childRes = await client
      .from('classes')
      .select('id')
      .eq('parent_class_id', rootClassId);

  final childClassIds = (childRes as List<dynamic>)
      .map((e) => (e as Map<String, dynamic>)['id'] as String)
      .toList();

  final ids = <String>{classId, rootClassId, ...childClassIds};

  return ClassClusterInfo(
    classIds: ids.toList(),
    rootClassId: rootClassId,
    childClassIds: childClassIds,
    isParent: selfId == rootClassId && childClassIds.isNotEmpty,
  );
}

int compareAdmissionNumbers(String? a, String? b) {
  final ax = (a ?? '').trim();
  final bx = (b ?? '').trim();
  if (ax.isEmpty && bx.isEmpty) return 0;
  if (ax.isEmpty) return 1;
  if (bx.isEmpty) return -1;
  final an = num.tryParse(ax);
  final bn = num.tryParse(bx);
  if (an != null && bn != null) return an.compareTo(bn);
  return ax.toLowerCase().compareTo(bx.toLowerCase());
}

int _compareStudentsByGenderThenName(Map<String, dynamic> x, Map<String, dynamic> y) {
  const order = {'male': 0, 'm': 0, 'female': 1, 'f': 1};
  final gx = order[(x['gender'] as String?)?.toLowerCase().trim()];
  final gy = order[(y['gender'] as String?)?.toLowerCase().trim()];
  if (gx != null || gy != null) {
    if (gx == null) return 1;
    if (gy == null) return -1;
    if (gx != gy) return gx.compareTo(gy);
  }
  final nx = '${x['full_name']}'.toLowerCase();
  final ny = '${y['full_name']}'.toLowerCase();
  return nx.compareTo(ny);
}

/// Mirrors web `getStudentsForSubject` (enrolment-aware, cluster-aware).
Future<List<Map<String, String>>> teacherGetStudentsForSubject(
  SupabaseClient client, {
  required String classId,
  required String? subjectId,
  required int academicYear,
  required String term,
  String? enrollmentDateOnOrBefore,
}) async {
  final cluster = await teacherResolveClassCluster(client, classId);
  final clusterHasStreams = cluster.isParent && cluster.childClassIds.isNotEmpty;
  final effectiveClassIds = clusterHasStreams ? cluster.classIds : [classId];

  dynamic q = client
      .from('students')
      .select('id, full_name, gender, admission_number, class_id')
      .eq('status', 'active')
      .inFilter('class_id', effectiveClassIds);
  if (enrollmentDateOnOrBefore != null &&
      enrollmentDateOnOrBefore.trim().isNotEmpty) {
    q = q.lte('enrollment_date', enrollmentDateOnOrBefore.trim());
  }
  final res = await q.order('full_name');
  final studentRows =
      (res as List<dynamic>).cast<Map<String, dynamic>>();
  if (studentRows.isEmpty) return [];

  var list = List<Map<String, dynamic>>.from(studentRows);

  if (subjectId == null || subjectId.isEmpty) {
    if (clusterHasStreams) {
      list.sort(
        (a, b) => compareAdmissionNumbers(
          a['admission_number'] as String?,
          b['admission_number'] as String?,
        ),
      );
    } else {
      list.sort(_compareStudentsByGenderThenName);
    }
    return list
        .map(
          (s) => {
            'id': s['id'] as String,
            'full_name': '${s['full_name']}',
            'gender': '${s['gender'] ?? ''}',
          },
        )
        .toList();
  }

  final enrollRes = await client
      .from('student_subject_enrollment')
      .select('student_id')
      .inFilter('class_id', effectiveClassIds)
      .eq('academic_year', academicYear)
      .eq('term', term)
      .eq('subject_id', subjectId);

  final inSubject = (enrollRes as List<dynamic>)
      .map((e) => (e as Map<String, dynamic>)['student_id'] as String)
      .toSet();

  list = list.where((s) => inSubject.contains(s['id'] as String)).toList();

  if (clusterHasStreams) {
    list.sort(
      (a, b) => compareAdmissionNumbers(
        a['admission_number'] as String?,
        b['admission_number'] as String?,
      ),
    );
  } else {
    list.sort(_compareStudentsByGenderThenName);
  }

  return list
      .map(
        (s) => {
          'id': s['id'] as String,
          'full_name': '${s['full_name']}',
          'gender': '${s['gender'] ?? ''}',
        },
      )
      .toList();
}

int enrollmentYearFromAssignmentString(String? y) {
  final m = RegExp(r'\d{4}').firstMatch(y ?? '');
  if (m != null) return int.tryParse(m.group(0)!) ?? DateTime.now().year;
  return teacherCurrentEnrollmentPeriod().academicYear;
}

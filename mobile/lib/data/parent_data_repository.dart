import 'package:supabase_flutter/supabase_flutter.dart';

import 'models/attendance_record.dart';
import 'models/chat_message_row.dart';
import 'models/fee_balance_row.dart';
import 'models/parent_overview.dart';
import 'models/payment_row.dart';
import 'models/report_card_comment_row.dart';
import 'models/report_card_summary.dart';
import 'models/student_profile_extra_data.dart';
import 'models/student_summary.dart';
import '../core/currency_format.dart';

class ParentDataRepository {
  ParentDataRepository(this._client);

  final SupabaseClient _client;

  Future<String?> loadProfileName(String userId) async {
    final row = await _client
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();
    return row?['full_name'] as String?;
  }

  Future<ParentOverview> loadOverview(String parentId) async {
    final name = await loadProfileName(parentId);

    final links = await _client
        .from('parent_students')
        .select('student_id')
        .eq('parent_id', parentId);

    final ids = (links as List<dynamic>)
        .map((e) => (e as Map<String, dynamic>)['student_id'] as String)
        .toList();

    if (ids.isEmpty) {
      return ParentOverview(
        profileName: name,
        students: [],
        balances: [],
        payments: [],
      );
    }

    final studentsRes = await _client
        .from('students')
        .select(
          'id, full_name, admission_number, school_id, class_id, gender, date_of_birth, status, parent_name, parent_phone, avatar_url, class:classes(name)',
        )
        .inFilter('id', ids)
        .order('full_name');

    final studentRows = (studentsRes as List).cast<Map<String, dynamic>>();
    final schoolIds =
        studentRows.map((r) => r['school_id'] as String).toSet().toList();

    final schoolById = <String, Map<String, dynamic>>{};
    if (schoolIds.isNotEmpty) {
      final schoolsRes = await _client
          .from('schools')
          .select('id, name, currency')
          .inFilter('id', schoolIds);
      for (final s in (schoolsRes as List).cast<Map<String, dynamic>>()) {
        schoolById[s['id'] as String] = s;
      }
    }

    final students = studentRows.map((r) {
      final sid = r['school_id'] as String;
      final sch = schoolById[sid];
      final cur = normalizeSchoolCurrency(sch?['currency'] as String?);
      final classData = r['class'];
      String? className;
      if (classData is Map<String, dynamic>) {
        className = classData['name'] as String?;
      } else if (classData is List &&
          classData.isNotEmpty &&
          classData.first is Map) {
        className = (classData.first as Map)['name'] as String?;
      }
      return StudentSummary(
        id: r['id'] as String,
        fullName: r['full_name'] as String,
        admissionNumber: r['admission_number'] as String?,
        schoolId: sid,
        classId: r['class_id'] as String,
        className: className,
        gender: r['gender'] as String?,
        dateOfBirth: r['date_of_birth'] as String?,
        status: r['status'] as String?,
        parentName: r['parent_name'] as String?,
        parentPhone: r['parent_phone'] as String?,
        schoolName: sch?['name'] as String?,
        avatarUrl: r['avatar_url'] as String?,
        currencyCode: cur,
      );
    }).toList();

    students.sort(
      (a, b) => a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()),
    );

    final balancesRes = await _client
        .from('student_fee_balances')
        .select(
          'student_id, fee_structure_id, fee_name, total_fee, total_paid, balance, due_date',
        )
        .inFilter('student_id', ids);

    final balances = (balancesRes as List)
        .cast<Map<String, dynamic>>()
        .map(FeeBalanceRow.fromJson)
        .toList();

    final paymentsRes = await _client
        .from('payments')
        .select(
          'id, student_id, amount, payment_method, payment_date, reference_number, fee_structure:fee_structures(name), receipt:receipts(id, receipt_number)',
        )
        .inFilter('student_id', ids)
        .order('payment_date', ascending: false)
        .limit(80);

    final payments = (paymentsRes as List)
        .cast<Map<String, dynamic>>()
        .map(PaymentRow.fromJson)
        .toList();

    return ParentOverview(
      profileName: name,
      students: students,
      balances: balances,
      payments: payments,
    );
  }

  /// Extra read-only data for the student profile hub (RLS-enforced per table).
  Future<StudentProfileExtraData> loadStudentProfileExtra({
    required String parentId,
    required String studentId,
    required String classId,
  }) async {
    List<AttendanceRecord> attendance = [];
    List<ReportCardSummary> reportCards = [];
    List<ReportCardCommentRow> reportComments = [];
    String? convId;
    List<ChatMessageRow> messages = [];

    try {
      attendance = await loadStudentAttendance(studentId);
    } catch (_) {}

    try {
      reportCards = await loadReportCards(studentId);
    } catch (_) {}

    try {
      reportComments = await loadReportCardComments(studentId);
    } catch (_) {}

    try {
      convId = await primaryConversationId(parentId, classId);
      if (convId != null) {
        messages = await loadChatMessages(convId);
      }
    } catch (_) {}

    return StudentProfileExtraData(
      attendance: attendance,
      reportCards: reportCards,
      reportComments: reportComments,
      messages: messages,
      primaryConversationId: convId,
    );
  }

  Future<List<AttendanceRecord>> loadStudentAttendance(String studentId) async {
    final res = await _client
        .from('teacher_attendance')
        .select(
          'id, attendance_date, status, subject_id, created_at',
        )
        .eq('student_id', studentId)
        .order('attendance_date', ascending: false)
        .limit(150);
    return (res as List)
        .cast<Map<String, dynamic>>()
        .map(AttendanceRecord.fromJson)
        .toList();
  }

  Future<List<ReportCardSummary>> loadReportCards(String studentId) async {
    final res = await _client
        .from('report_cards')
        .select('id, term, academic_year, status, submitted_at, admin_note')
        .eq('student_id', studentId)
        .order('academic_year', ascending: false);
    return (res as List)
        .cast<Map<String, dynamic>>()
        .map(ReportCardSummary.fromJson)
        .toList();
  }

  Future<List<ReportCardCommentRow>> loadReportCardComments(
    String studentId,
  ) async {
    final res = await _client
        .from('teacher_report_card_comments')
        .select(
          'id, report_card_id, subject, term, academic_year, status, comment, '
          'score_percent, letter_grade, exam1_score, exam2_score, calculated_score, '
          'calculated_grade, position',
        )
        .eq('student_id', studentId)
        .order('academic_year', ascending: false);
    return (res as List)
        .cast<Map<String, dynamic>>()
        .map(ReportCardCommentRow.fromJson)
        .toList();
  }

  Future<String?> primaryConversationId(String parentId, String classId) async {
    final row = await _client
        .from('chat_conversations')
        .select('id')
        .eq('parent_id', parentId)
        .eq('class_id', classId)
        .order('last_message_at', ascending: false)
        .limit(1)
        .maybeSingle();
    return row?['id'] as String?;
  }

  Future<List<ChatMessageRow>> loadChatMessages(String conversationId) async {
    final res = await _client
        .from('chat_messages')
        .select('id, conversation_id, sender_id, message, is_read, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .limit(200);
    return (res as List)
        .cast<Map<String, dynamic>>()
        .map(ChatMessageRow.fromJson)
        .toList();
  }

  /// Returns false if RLS rejects or network fails (caller shows a toast/snackbar).
  Future<bool> sendParentChatMessage({
    required String conversationId,
    required String text,
  }) async {
    final uid = _client.auth.currentUser?.id;
    if (uid == null) return false;
    final body = text.trim();
    if (body.isEmpty) return false;
    try {
      await _client.from('chat_messages').insert({
        'conversation_id': conversationId,
        'sender_id': uid,
        'message': body,
        'is_read': false,
      });
      return true;
    } catch (_) {
      return false;
    }
  }
}

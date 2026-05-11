import 'package:supabase_flutter/supabase_flutter.dart';

import 'models/attendance_record.dart';
import 'models/chat_message_row.dart';
import 'models/fee_balance_row.dart';
import 'models/parent_overview.dart';
import 'models/parent_seen_state.dart';
import 'models/payment_row.dart';
import 'models/report_card_comment_row.dart';
import 'models/report_card_summary.dart';
import 'models/student_profile_extra_data.dart';
import 'models/student_summary.dart';
import '../core/attendance/teacher_attendance_status.dart';
import '../core/currency_format.dart';
import '../core/report_card_academic.dart';
import 'models/class_report_settings_row.dart';
import 'models/report_card_detail_extras.dart';

class ParentDataRepository {
  ParentDataRepository(this._client);

  final SupabaseClient _client;

  static DateTime? _tryParseIso(String? v) {
    if (v == null) return null;
    final t = v.trim();
    if (t.isEmpty) return null;
    return DateTime.tryParse(t);
  }

  static String? _isoMax(String? a, String? b) {
    final da = _tryParseIso(a);
    final db = _tryParseIso(b);
    if (da == null) return b;
    if (db == null) return a;
    return da.isAfter(db) ? a : b;
  }

  static const _teacherReportCommentsSelectFull =
      'id, report_card_id, subject, term, academic_year, status, comment, '
      'score_percent, letter_grade, exam1_score, exam2_score, calculated_score, '
      'calculated_grade, exam1_score_overridden, exam2_score_overridden, position';

  /// Pre-override column list — used when DB/API rejects unknown columns.
  static const _teacherReportCommentsSelectLegacy =
      'id, report_card_id, subject, term, academic_year, status, comment, '
      'score_percent, letter_grade, exam1_score, exam2_score, calculated_score, '
      'calculated_grade, position';

  List<ReportCardCommentRow> _parseReportCardCommentRows(dynamic res) {
    final out = <ReportCardCommentRow>[];
    final list = res is List ? res : const [];
    for (final raw in list) {
      final row = ReportCardCommentRow.tryFromJson(raw);
      if (row != null) out.add(row);
    }
    return out;
  }

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
    final seen = await _loadParentSeenState(parentId);

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
        attention: ParentAttentionSignals.empty,
        seen: seen,
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
          .select('id, name, currency, logo_url, school_stamp_url')
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
      final logoTrimmed = (sch?['logo_url'] as String?)?.trim();
      final stampTrimmed = (sch?['school_stamp_url'] as String?)?.trim();
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
        schoolLogoUrl: (logoTrimmed != null && logoTrimmed.isNotEmpty)
            ? logoTrimmed
            : null,
        schoolStampUrl: (stampTrimmed != null && stampTrimmed.isNotEmpty)
            ? stampTrimmed
            : null,
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
          'student_id, fee_structure_id, fee_name, term, total_fee, total_paid, balance, due_date',
        )
        .inFilter('student_id', ids);

    final balances = (balancesRes as List)
        .cast<Map<String, dynamic>>()
        .map(FeeBalanceRow.fromJson)
        .toList();

    final paymentsRes = await _client
        .from('payments')
        .select(
          'id, student_id, amount, payment_method, status, payment_date, reference_number, notes, fee_structure:fee_structures(name), receipt:receipts(id, receipt_number, issued_at)',
        )
        .inFilter('student_id', ids)
        .order('payment_date', ascending: false)
        .limit(80);

    final payments = (paymentsRes as List)
        .cast<Map<String, dynamic>>()
        .map(PaymentRow.fromJson)
        .toList();

    final attention = await _loadAttentionSignals(
      parentId: parentId,
      studentIds: ids,
      classIds: students.map((s) => s.classId).toSet().toList(),
      balances: balances,
      payments: payments,
    );

    return ParentOverview(
      profileName: name,
      students: students,
      balances: balances,
      payments: payments,
      attention: attention,
      seen: seen,
    );
  }

  Future<ParentSeenState> _loadParentSeenState(String parentId) async {
    try {
      final row = await _client
          .from('parent_seen_states')
          .select(
            'last_seen_messages_at, last_seen_subject_results_at, last_seen_report_cards_at, last_seen_receipts_at, last_seen_fees_at',
          )
          .eq('parent_id', parentId)
          .maybeSingle();
      if (row == null) return ParentSeenState.empty;
      return ParentSeenState.fromJson(Map<String, dynamic>.from(row as Map));
    } catch (_) {
      return ParentSeenState.empty;
    }
  }

  Future<void> markParentSectionSeen({
    required String parentId,
    required String column,
    DateTime? seenAt,
  }) async {
    final dt = (seenAt ?? DateTime.now()).toUtc().toIso8601String();
    try {
      await _client.from('parent_seen_states').upsert({
        'parent_id': parentId,
        column: dt,
      });
    } catch (_) {
      // Best-effort. UI is optimistic; will reconcile on next refresh.
    }
  }

  Future<ParentAttentionSignals> _loadAttentionSignals({
    required String parentId,
    required List<String> studentIds,
    required List<String> classIds,
    required List<FeeBalanceRow> balances,
    required List<PaymentRow> payments,
  }) async {
    // Best-effort signals. If any query fails (RLS/network), we return partials.
    var messagesUnread = 0;
    String? messagesLatestAt;
    String? reportApprovedAt;
    String? subjectLatestAt;
    String? paymentsLatestAt;
    String? attendanceConcernAt;

    // Fees overdue derived locally (keeps load fast + resilient).
    final now = DateTime.now();
    var feesHasOverdue = false;
    String? feesLatestAt;
    for (final b in balances) {
      if (b.balance <= 0) continue;
      final due = _tryParseIso(b.dueDate);
      if (due == null) continue;
      if (due.isBefore(now)) {
        feesHasOverdue = true;
      }
    }

    // Fees latest activity must come from a stable DB timestamp.
    // `student_fee_balances` is a VIEW (no updated_at), so we use `fee_structures.updated_at`.
    try {
      final feeIds = balances
          .map((b) => b.feeStructureId)
          .where((id) => id.trim().isNotEmpty)
          .toSet()
          .toList();
      if (feeIds.isNotEmpty) {
        final res = await _client
            .from('fee_structures')
            .select('updated_at')
            .inFilter('id', feeIds)
            .order('updated_at', ascending: false)
            .limit(1);
        final rows = (res as List).cast<Map<String, dynamic>>();
        final v = rows.isEmpty ? null : rows.first['updated_at'];
        feesLatestAt = v?.toString();
      }
    } catch (_) {
      // If we cannot get a stable timestamp, do NOT show Fees indicator.
      feesLatestAt = null;
      feesHasOverdue = false;
    }

    // Payments / receipts: latest of payment date and receipt issued date.
    for (final p in payments) {
      paymentsLatestAt = _isoMax(paymentsLatestAt, p.paymentDate);
      paymentsLatestAt = _isoMax(paymentsLatestAt, p.receiptIssuedAt);
    }

    // Messages: unread count + latest message timestamp from active conversations.
    try {
      if (classIds.isNotEmpty) {
        final convRes = await _client
            .from('chat_conversations')
            .select('id')
            .eq('parent_id', parentId)
            .inFilter('class_id', classIds)
            .order('last_message_at', ascending: false)
            .limit(25);
        final convIds = (convRes as List)
            .cast<Map<String, dynamic>>()
            .map((r) => r['id'] as String?)
            .whereType<String>()
            .toList();

        if (convIds.isNotEmpty) {
          final unreadRes = await _client
              .from('chat_messages')
              .select('id')
              .inFilter('conversation_id', convIds)
              .eq('is_read', false)
              .neq('sender_id', parentId)
              .order('created_at', ascending: false)
              .limit(120);
          final unreadRows = (unreadRes as List).cast<Map<String, dynamic>>();
          messagesUnread = unreadRows.length;

          final latestRes = await _client
              .from('chat_messages')
              .select('created_at')
              .inFilter('conversation_id', convIds)
              .order('created_at', ascending: false)
              .limit(1);
          final latestRows = (latestRes as List).cast<Map<String, dynamic>>();
          messagesLatestAt =
              latestRows.isEmpty ? null : latestRows.first['created_at'] as String?;
        }
      }
    } catch (_) {}

    // Report cards: latest approved report (published).
    try {
      final res = await _client
          .from('report_cards')
          .select('approved_at')
          .inFilter('student_id', studentIds)
          .not('approved_at', 'is', null)
          .order('approved_at', ascending: false)
          .limit(1);
      final rows = (res as List).cast<Map<String, dynamic>>();
      reportApprovedAt =
          rows.isEmpty ? null : rows.first['approved_at'] as String?;
    } catch (_) {}

    // Subject results: best-effort use latest report card update as proxy.
    // Prefer teacher_report_card_comments.updated_at (parent-visible via RLS).
    try {
      final res = await _client
          .from('teacher_report_card_comments')
          .select('updated_at')
          .inFilter('student_id', studentIds)
          .order('updated_at', ascending: false)
          .limit(1);
      final rows = (res as List).cast<Map<String, dynamic>>();
      subjectLatestAt =
          rows.isEmpty ? null : rows.first['updated_at'] as String?;
    } catch (_) {}

    // Attendance concern: only flag when there's a strong recent absence signal.
    try {
      final res = await _client
          .from('teacher_attendance')
          .select('status, attendance_date')
          .inFilter('student_id', studentIds)
          .order('attendance_date', ascending: false)
          .limit(40);
      final rows = (res as List).cast<Map<String, dynamic>>();
      final recent = rows.take(12).toList();
      final absentCount =
          recent.where((r) => (r['status'] as String?) == 'absent').length;
      if (absentCount >= 3) {
        attendanceConcernAt = recent.isEmpty
            ? null
            : (recent.first['attendance_date'] as String?);
      }
    } catch (_) {}

    return ParentAttentionSignals(
      messagesUnreadCount: messagesUnread,
      messagesLatestAt: messagesLatestAt,
      subjectResultsLatestAt: subjectLatestAt,
      reportCardsLatestApprovedAt: reportApprovedAt,
      feesHasOverdue: feesHasOverdue,
      feesLatestAt: feesLatestAt,
      paymentsLatestAt: paymentsLatestAt,
      attendanceConcernLatestAt: attendanceConcernAt,
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
    try {
      final res = await _client
          .from('report_cards')
          .select(
            'id, student_id, class_id, school_id, teacher_id, term, academic_year, '
            'status, submitted_at, admin_note, approved_at, created_at, updated_at, '
            'students ( full_name ), '
            'classes ( name ), '
            'schools ( name, logo_url, motto, school_stamp_url, head_teacher_signature_url, school_level ), '
            'teacher:profiles!report_cards_teacher_id_fkey ( full_name )',
          )
          .eq('student_id', studentId)
          .order('academic_year', ascending: false);
      return (res as List)
          .cast<Map<String, dynamic>>()
          .map(ReportCardSummary.fromJson)
          .toList();
    } catch (_) {
      final res = await _client
          .from('report_cards')
          .select(
            'id, student_id, class_id, school_id, teacher_id, term, academic_year, '
            'status, submitted_at, admin_note, approved_at, created_at, updated_at, '
            'students ( full_name ), '
            'classes ( name ), '
            'schools ( name, logo_url, motto, school_stamp_url, head_teacher_signature_url, school_level )',
          )
          .eq('student_id', studentId)
          .order('academic_year', ascending: false);
      return (res as List)
          .cast<Map<String, dynamic>>()
          .map(ReportCardSummary.fromJson)
          .toList();
    }
  }

  Future<List<ReportCardCommentRow>> loadReportCardComments(
    String studentId,
  ) async {
    try {
      final res = await _client
          .from('teacher_report_card_comments')
          .select(_teacherReportCommentsSelectFull)
          .eq('student_id', studentId)
          .order('academic_year', ascending: false);
      return _parseReportCardCommentRows(res);
    } catch (_) {
      try {
        final res = await _client
            .from('teacher_report_card_comments')
            .select(_teacherReportCommentsSelectLegacy)
            .eq('student_id', studentId)
            .order('academic_year', ascending: false);
        return _parseReportCardCommentRows(res);
      } catch (_) {
        return [];
      }
    }
  }

  /// Class settings + term attendance counts for the parent report card view.
  Future<ReportCardDetailExtras> loadReportCardDetailExtras({
    required String studentId,
    required String classId,
    required String term,
    required String academicYear,
  }) async {
    ClassReportSettingsRow? settings;
    try {
      final year = reportAcademicYearToEnrollmentYear(academicYear);
      final row = await _client
          .from('class_report_settings')
          .select(
            'closing_date, opening_date, coordinator_message, required_items',
          )
          .eq('class_id', classId)
          .eq('term', term)
          .eq('academic_year', year)
          .maybeSingle();
      if (row != null) {
        settings = ClassReportSettingsRow.fromJson(
          Map<String, dynamic>.from(row as Map),
        );
      }
    } catch (_) {}

    var present = 0;
    var absent = 0;
    var late = 0;
    try {
      final range = termDateRange(term, academicYear);
      final att = await _client
          .from('teacher_attendance')
          .select('status')
          .eq('student_id', studentId)
          .eq('class_id', classId)
          .gte('attendance_date', range.start)
          .lte('attendance_date', range.end);
      final list = (att as List).cast<Map<String, dynamic>>();
      for (final r in list) {
        switch (normalizeTeacherAttendanceStatus(r['status'] as String?)) {
          case 'present':
            present++;
            break;
          case 'absent':
            absent++;
            break;
          case 'late':
            late++;
            break;
        }
      }
    } catch (_) {}

    return ReportCardDetailExtras(
      settings: settings,
      attendancePresent: present,
      attendanceAbsent: absent,
      attendanceLate: late,
    );
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

import 'package:flutter/material.dart';

/// Parent home quick actions — labels match the web parent dashboard.
enum ParentQuickAction {
  attendance,
  subjectResults,
  examResults,
  reportCards,
  fees,
  paymentsReceipts,
  messages,
  profile,
}

extension ParentQuickActionLabels on ParentQuickAction {
  String get title => switch (this) {
        ParentQuickAction.attendance => 'Attendance',
        ParentQuickAction.subjectResults => 'Subject results',
        ParentQuickAction.examResults => 'Exam results',
        ParentQuickAction.reportCards => 'Report cards',
        ParentQuickAction.fees => 'Fees',
        ParentQuickAction.paymentsReceipts => 'Payments / Receipts',
        ParentQuickAction.messages => 'Messages',
        ParentQuickAction.profile => 'Profile',
      };

  IconData get icon => switch (this) {
        ParentQuickAction.attendance => Icons.schedule_rounded,
        ParentQuickAction.subjectResults => Icons.auto_stories_rounded,
        ParentQuickAction.examResults => Icons.analytics_rounded,
        ParentQuickAction.reportCards => Icons.badge_rounded,
        ParentQuickAction.fees => Icons.savings_rounded,
        ParentQuickAction.paymentsReceipts => Icons.payments_rounded,
        ParentQuickAction.messages => Icons.mark_unread_chat_alt_rounded,
        ParentQuickAction.profile => Icons.face_rounded,
      };

  /// Slightly louder home tile for academics (visual only; routing unchanged).
  bool get homeEmphasizedOnDashboard => switch (this) {
        ParentQuickAction.attendance => true,
        ParentQuickAction.reportCards => true,
        _ => false,
      };

  /// Short line under the title on the parent home grid (not shown elsewhere).
  String get homeSubtitle => switch (this) {
        ParentQuickAction.attendance => 'Daily attendance',
        ParentQuickAction.subjectResults => 'Grades & topics',
        ParentQuickAction.examResults => 'Formal exams',
        ParentQuickAction.reportCards => 'Official reports',
        ParentQuickAction.fees => 'School finances',
        ParentQuickAction.paymentsReceipts => 'Receipts',
        ParentQuickAction.messages => 'Teacher updates',
        ParentQuickAction.profile => 'Student profile',
      };

  /// Card wash + icon disc colors — restrained pastels with clear contrast.
  ({Color cardBg, Color iconDisc, Color iconFg}) get homeTileStyle =>
      switch (this) {
        ParentQuickAction.attendance => (
            cardBg: const Color(0xFFE8F2FA),
            iconDisc: const Color(0xFFB8DEF5),
            iconFg: const Color(0xFF0C5F8A),
          ),
        ParentQuickAction.subjectResults => (
            cardBg: const Color(0xFFF5F0FB),
            iconDisc: const Color(0xFFE2D8F8),
            iconFg: const Color(0xFF553499),
          ),
        ParentQuickAction.examResults => (
            cardBg: const Color(0xFFF0FAF5),
            iconDisc: const Color(0xFFB9EBD4),
            iconFg: const Color(0xFF0D6B4F),
          ),
        ParentQuickAction.reportCards => (
            cardBg: const Color(0xFFEAF0FB),
            iconDisc: const Color(0xFFBCD0F5),
            iconFg: const Color(0xFF2447B3),
          ),
        ParentQuickAction.fees => (
            cardBg: const Color(0xFFFBF8F5),
            iconDisc: const Color(0xFFF5E1D4),
            iconFg: const Color(0xFF99431A),
          ),
        ParentQuickAction.paymentsReceipts => (
            cardBg: const Color(0xFFF2FAF8),
            iconDisc: const Color(0xFFB8EBE3),
            iconFg: const Color(0xFF126B63),
          ),
        ParentQuickAction.messages => (
            cardBg: const Color(0xFFF4F3FC),
            iconDisc: const Color(0xFFDCD6F7),
            iconFg: const Color(0xFF4C3294),
          ),
        ParentQuickAction.profile => (
            cardBg: const Color(0xFFF3F5F8),
            iconDisc: const Color(0xFFD7DEE9),
            iconFg: const Color(0xFF3D4856),
          ),
      };
}

/// Display order for the parent home icon grid.
const List<ParentQuickAction> kParentQuickActionsGridOrder = [
  ParentQuickAction.attendance,
  ParentQuickAction.messages,
  ParentQuickAction.subjectResults,
  ParentQuickAction.reportCards,
  ParentQuickAction.examResults,
  ParentQuickAction.fees,
  ParentQuickAction.paymentsReceipts,
  ParentQuickAction.profile,
];

import 'package:flutter/material.dart';

/// Teacher “working desk” — calm indigo/slate, distinct from parent home.
abstract final class TeacherUiTokens {
  static const double horizontalPadding = 20;

  static LinearGradient get deskWelcomeGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF3730A3),
          Color(0xFF4F46E5),
          Color(0xFF6366F1),
        ],
        stops: [0.0, 0.45, 1.0],
      );

  static List<BoxShadow> get cardLift => const [
        BoxShadow(
          color: Color(0x140F172A),
          blurRadius: 20,
          offset: Offset(0, 8),
        ),
      ];
}

enum TeacherDeskTileKind {
  attendance,
  lessonPlans,
  marks,
  documents,
  evaluateSubject;

  /// Daily teaching workflow tiles in the 2×2 working-desk grid.
  static const List<TeacherDeskTileKind> gridTiles = [
    attendance,
    lessonPlans,
    marks,
    evaluateSubject,
  ];

  IconData get icon => switch (this) {
        TeacherDeskTileKind.attendance => Icons.groups_rounded,
        TeacherDeskTileKind.lessonPlans => Icons.menu_book_rounded,
        TeacherDeskTileKind.marks => Icons.grade_rounded,
        TeacherDeskTileKind.documents => Icons.folder_special_rounded,
        TeacherDeskTileKind.evaluateSubject => Icons.insights_rounded,
      };

  String get title => switch (this) {
        TeacherDeskTileKind.attendance => 'Class List',
        TeacherDeskTileKind.lessonPlans => 'Lesson plans',
        TeacherDeskTileKind.marks => 'Marks',
        TeacherDeskTileKind.documents => 'My documents',
        TeacherDeskTileKind.evaluateSubject => 'Evaluate subject',
      };

  String get subtitle => switch (this) {
        TeacherDeskTileKind.attendance => 'Your students',
        TeacherDeskTileKind.lessonPlans => 'Plan lessons',
        TeacherDeskTileKind.marks => 'Enter scores',
        TeacherDeskTileKind.documents => 'Files & certs',
        TeacherDeskTileKind.evaluateSubject => 'Review marks',
      };

  ({Color cardBg, Color iconDisc, Color iconFg}) get palette => switch (this) {
        TeacherDeskTileKind.attendance => (
            cardBg: const Color(0xFFE8F2FA),
            iconDisc: const Color(0xFFB8DEF5),
            iconFg: const Color(0xFF0C5F8A),
          ),
        TeacherDeskTileKind.lessonPlans => (
            cardBg: const Color(0xFFF2FAF8),
            iconDisc: const Color(0xFFB8EBE3),
            iconFg: const Color(0xFF126B63),
          ),
        TeacherDeskTileKind.marks => (
            cardBg: const Color(0xFFFFFBEB),
            iconDisc: const Color(0xFFFDE68A),
            iconFg: const Color(0xFF92400E),
          ),
        TeacherDeskTileKind.documents => (
            cardBg: const Color(0xFFEEF2FF),
            iconDisc: const Color(0xFFC7D2FE),
            iconFg: const Color(0xFF4338CA),
          ),
        TeacherDeskTileKind.evaluateSubject => (
            cardBg: const Color(0xFFEFF6FF),
            iconDisc: const Color(0xFFBEDBFF),
            iconFg: const Color(0xFF1E3A5F),
          ),
      };
}

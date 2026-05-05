import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Shared layout and decoration for parent-facing screens (no logic).
abstract final class ParentUiTokens {
  static const double radiusLg = 22;
  static const double radiusMd = 16;
  static const double radiusSm = 12;
  static const double actionMinHeight = 52;
  static const double horizontalPadding = 20;

  static List<BoxShadow> get cardShadow => const [
        BoxShadow(
          color: Color(0x140F172A),
          blurRadius: 24,
          offset: Offset(0, 10),
        ),
        BoxShadow(
          color: Color(0x080F172A),
          blurRadius: 4,
          offset: Offset(0, 1),
        ),
      ];

  static BoxDecoration softCard({Color? color}) {
    return BoxDecoration(
      color: color ?? Colors.white,
      borderRadius: BorderRadius.circular(radiusLg),
      border: Border.all(
        color: AppColors.cardBorder.withValues(alpha: 0.85),
      ),
      boxShadow: cardShadow,
    );
  }

  static BoxDecoration insetWell() {
    return BoxDecoration(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(radiusMd),
      border: Border.all(
        color: AppColors.cardBorder.withValues(alpha: 0.7),
      ),
    );
  }

  static LinearGradient get heroHeaderGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFFEEF2FF),
          Color(0xFFF5F3FF),
          Color(0xFFFFFFFF),
        ],
        stops: [0.0, 0.45, 1.0],
      );

  static LinearGradient get profileHeaderGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF4F46E5),
          Color(0xFF6366F1),
          Color(0xFF7C3AED),
        ],
      );
}

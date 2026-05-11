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

  /// Parent home hero — softer blend than profile header gradients.
  static LinearGradient get parentWelcomeGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF5F56EB),
          Color(0xFF6468EE),
          Color(0xFF7366ED),
          Color(0xFF7F72E9),
        ],
        stops: [0.0, 0.32, 0.62, 1.0],
      );

  /// Lighter lift for the compact parent home hero card.
  static List<BoxShadow> get parentHeroElevatedShadow => const [
        BoxShadow(
          color: Color(0x0B0F172A),
          blurRadius: 20,
          offset: Offset(0, 10),
          spreadRadius: -6,
        ),
        BoxShadow(
          color: Color(0x050F172A),
          blurRadius: 8,
          offset: Offset(0, 3),
        ),
      ];

  /// Softer layered shadow for prominent cards.
  static List<BoxShadow> get softElevatedShadow => const [
        BoxShadow(
          color: Color(0x0E0F172A),
          blurRadius: 28,
          offset: Offset(0, 14),
          spreadRadius: -8,
        ),
        BoxShadow(
          color: Color(0x050F172A),
          blurRadius: 8,
          offset: Offset(0, 4),
        ),
      ];

  static List<BoxShadow> get subtleTileShadow => const [
        BoxShadow(
          color: Color(0x080F172A),
          blurRadius: 20,
          offset: Offset(0, 8),
          spreadRadius: -6,
        ),
      ];

  /// Quick-action tiles — soft lift, minimal edge definition.
  static List<BoxShadow> get quickActionPremiumShadow => const [
        BoxShadow(
          color: Color(0x070F172A),
          blurRadius: 18,
          offset: Offset(0, 6),
          spreadRadius: -3,
        ),
        BoxShadow(
          color: Color(0x030F172A),
          blurRadius: 4,
          offset: Offset(0, 1),
        ),
      ];

  /// Gentle extra lift for a few highlighted shortcut tiles only.
  static List<BoxShadow> get quickActionEmphasisLift => const [
        BoxShadow(
          color: Color(0x050F172A),
          blurRadius: 14,
          offset: Offset(0, 5),
          spreadRadius: -2,
        ),
      ];

  /// Home “Your child” card — airy, anchored finish without harsh contrast.
  static List<BoxShadow> get homeStudentAnchorShadow => const [
        BoxShadow(
          color: Color(0x0525356A),
          blurRadius: 24,
          offset: Offset(0, 10),
          spreadRadius: -5,
        ),
        BoxShadow(
          color: Color(0x04202850),
          blurRadius: 8,
          offset: Offset(0, 2),
        ),
      ];

  /// Muted canvas behind parent home scroll.
  static const Color parentHomeCanvas = Color(0xFFF2F5FB);
}

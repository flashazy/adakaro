import 'package:flutter/material.dart';

/// Brand colors aligned with web `--school-primary` default (indigo-600).
abstract final class AppColors {
  static const Color primary = Color(0xFF4F46E5);
  static const Color primaryDark = Color(0xFF4338CA);
  static const Color surface = Color(0xFFF8FAFC);
  static const Color cardBorder = Color(0xFFE2E8F0);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color success = Color(0xFF059669);
  static const Color warning = Color(0xFFD97706);

  /// Soft fills for chips and highlights (indigo / green / amber families).
  static const Color indigoWash = Color(0xFFEEF2FF);
  static const Color successBg = Color(0xFFECFDF5);
  static const Color successBorder = Color(0xFFA7F3D0);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color warningBorder = Color(0xFFFDE68A);
}

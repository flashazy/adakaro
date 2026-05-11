import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';

/// Placeholder for role dashboards not yet implemented on mobile (web parity pending).
class TeacherRolePlaceholderScreen extends StatelessWidget {
  const TeacherRolePlaceholderScreen({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.all(TeacherUiTokens.horizontalPadding + 4),
        children: [
          const SizedBox(height: 24),
          Icon(
            Icons.construction_rounded,
            size: 48,
            color: AppColors.primary.withValues(alpha: 0.45),
          ),
          const SizedBox(height: 20),
          Text(
            body,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: AppColors.textSecondary,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

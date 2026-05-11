import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Compact pill for paid / due / neutral states.
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    required this.foreground,
    required this.background,
    this.borderColor,
    this.icon,
    this.compact = false,
  });

  final String label;
  final Color foreground;
  final Color background;
  final Color? borderColor;
  final IconData? icon;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final pad = compact
        ? const EdgeInsets.symmetric(horizontal: 7, vertical: 3)
        : const EdgeInsets.symmetric(horizontal: 10, vertical: 6);
    final iconSize = compact ? 12.0 : 14.0;
    return Container(
      padding: pad,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: borderColor ?? background,
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: iconSize, color: foreground),
            SizedBox(width: compact ? 3 : 4),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: foreground,
                  letterSpacing: compact ? 0.05 : 0.2,
                  fontSize: compact ? 10 : null,
                ),
          ),
        ],
      ),
    );
  }

  /// Outstanding balance — calm, neutral tone for low-stress surfaces.
  static StatusChip balanceCalm(String text, {bool compact = false}) {
    return StatusChip(
      label: text,
      foreground: const Color(0xFF44403C),
      background: const Color(0xFFF5F5F4),
      borderColor: const Color(0xFFE7E5E4),
      icon: Icons.account_balance_wallet_outlined,
      compact: compact,
    );
  }

  /// Home privacy: balance amount not shown until parent reveals.
  static StatusChip balancePrivate({bool compact = false}) {
    return StatusChip(
      label: compact ? 'Private' : 'Balance private',
      foreground: AppColors.textSecondary,
      background: const Color(0xFFF8FAFC),
      borderColor: AppColors.cardBorder,
      icon: Icons.lock_outline_rounded,
      compact: compact,
    );
  }

  /// Strong “due” state (prefer [balanceCalm] on calming surfaces like parent home).
  static StatusChip balanceDue(String text) {
    return StatusChip(
      label: text,
      foreground: const Color(0xFF92400E),
      background: AppColors.warningBg,
      borderColor: AppColors.warningBorder,
      icon: Icons.schedule_rounded,
    );
  }

  /// Paid up / cleared (green).
  static StatusChip paidUp({bool compact = false}) {
    return StatusChip(
      label: compact ? 'Paid' : 'Paid up',
      foreground: const Color(0xFF047857),
      background: AppColors.successBg,
      borderColor: AppColors.successBorder,
      icon: Icons.check_circle_rounded,
      compact: compact,
    );
  }

  /// Partial / line balance (indigo).
  static StatusChip lineBalance(String text) {
    return StatusChip(
      label: text,
      foreground: AppColors.primaryDark,
      background: AppColors.indigoWash,
      borderColor: const Color(0xFFC7D2FE),
      icon: Icons.account_balance_wallet_rounded,
    );
  }
}

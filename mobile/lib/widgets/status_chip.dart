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
  });

  final String label;
  final Color foreground;
  final Color background;
  final Color? borderColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
            Icon(icon, size: 14, color: foreground),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: foreground,
                  letterSpacing: 0.2,
                ),
          ),
        ],
      ),
    );
  }

  /// Outstanding balance (amber).
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
  static StatusChip paidUp() {
    return StatusChip(
      label: 'Paid up',
      foreground: const Color(0xFF047857),
      background: AppColors.successBg,
      borderColor: AppColors.successBorder,
      icon: Icons.check_circle_rounded,
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

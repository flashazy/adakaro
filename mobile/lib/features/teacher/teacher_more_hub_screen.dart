import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import 'teacher_academic_reports_screen.dart';
import 'teacher_role_placeholder_screen.dart';

/// Fifth bottom tab: admin-assigned school responsibilities only.
class TeacherMoreHubScreen extends StatelessWidget {
  const TeacherMoreHubScreen({
    super.key,
    required this.data,
    required this.onOpenClassesSubjects,
    required this.onDeskRefresh,
  });

  final TeacherDeskData data;
  final VoidCallback onOpenClassesSubjects;
  final Future<void> Function() onDeskRefresh;

  static const _respShadows = [
    BoxShadow(
      color: Color(0x140F172A),
      blurRadius: 16,
      offset: Offset(0, 6),
    ),
    BoxShadow(
      color: Color(0x080F172A),
      blurRadius: 4,
      offset: Offset(0, 2),
    ),
  ];

  /// Operational hierarchy: class teacher → coordinator → departments.
  static const _iconBoxSize = 44.0;
  static const _iconBoxRadius = 12.0;
  static const _iconGlyphSize = 22.0;

  int _assignedRoleCount() {
    var n = 0;
    if (data.showsClassTeacherResponsibility) n++;
    if (data.showsCoordinatorResponsibility) n++;
    if (data.showsAcademicDepartment) n++;
    if (data.showsDisciplineDepartment) n++;
    if (data.showsHealthDepartment) n++;
    if (data.showsFinanceResponsibility) n++;
    return n;
  }

  List<({int order, Widget card})> _responsibilityEntries(BuildContext context) {
    final entries = <({int order, Widget card})>[];

    void push(int order, Widget Function() build) {
      entries.add((order: order, card: build()));
    }

    if (data.showsClassTeacherResponsibility) {
      push(0, () => _ResponsibilityCard(
            key: const ValueKey('role-class-teacher'),
            icon: Icons.groups_rounded,
            iconColor: const Color(0xFF3730A3),
            title: 'Class teacher',
            subtitle: 'Manage your assigned class',
            boxShadow: _respShadows,
            iconBoxSize: _iconBoxSize,
            iconBoxRadius: _iconBoxRadius,
            iconGlyphSize: _iconGlyphSize,
            onTap: onOpenClassesSubjects,
          ));
    }
    if (data.showsCoordinatorResponsibility) {
      push(1, () => _ResponsibilityCard(
            key: const ValueKey('role-coordinator'),
            icon: Icons.fact_check_rounded,
            iconColor: const Color(0xFF0C5F8A),
            title: 'Coordinator',
            subtitle: 'Oversee report cards and approvals',
            boxShadow: _respShadows,
            iconBoxSize: _iconBoxSize,
            iconBoxRadius: _iconBoxRadius,
            iconGlyphSize: _iconGlyphSize,
            onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const TeacherRolePlaceholderScreen(
                    title: 'Coordinator',
                    body: 'Coordinator tools will appear here.',
                  ),
                ),
              );
            },
          ));
    }
    if (data.showsAcademicDepartment) {
      push(2, () => _ResponsibilityCard(
            key: const ValueKey('role-academic'),
            icon: Icons.menu_book_rounded,
            iconColor: const Color(0xFF1E3A5F),
            title: 'Academic',
            subtitle: 'Review academic performance',
            boxShadow: _respShadows,
            iconBoxSize: _iconBoxSize,
            iconBoxRadius: _iconBoxRadius,
            iconGlyphSize: _iconGlyphSize,
            onTap: () =>
                openAcademicReportsOncePlausible(context, data: data),
          ));
    }
    if (data.showsDisciplineDepartment) {
      push(3, () => _ResponsibilityCard(
            key: const ValueKey('role-discipline'),
            icon: Icons.gavel_rounded,
            iconColor: const Color(0xFF92400E),
            title: 'Discipline',
            subtitle: 'Manage student discipline records',
            boxShadow: _respShadows,
            iconBoxSize: _iconBoxSize,
            iconBoxRadius: _iconBoxRadius,
            iconGlyphSize: _iconGlyphSize,
            onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const TeacherRolePlaceholderScreen(
                    title: 'Discipline',
                    body: 'Discipline records dashboard coming soon.',
                  ),
                ),
              );
            },
          ));
    }
    if (data.showsHealthDepartment) {
      push(4, () => _ResponsibilityCard(
            key: const ValueKey('role-health'),
            icon: Icons.favorite_rounded,
            iconColor: const Color(0xFF126B63),
            title: 'Health',
            subtitle: 'Access student health information',
            boxShadow: _respShadows,
            iconBoxSize: _iconBoxSize,
            iconBoxRadius: _iconBoxRadius,
            iconGlyphSize: _iconGlyphSize,
            onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const TeacherRolePlaceholderScreen(
                    title: 'Health',
                    body: 'Health records dashboard coming soon.',
                  ),
                ),
              );
            },
          ));
    }
    if (data.showsFinanceResponsibility) {
      push(5, () => _ResponsibilityCard(
            key: const ValueKey('role-finance'),
            icon: Icons.payments_rounded,
            iconColor: const Color(0xFF4338CA),
            title: 'Finance',
            subtitle: 'Review finance and payment records',
            boxShadow: _respShadows,
            iconBoxSize: _iconBoxSize,
            iconBoxRadius: _iconBoxRadius,
            iconGlyphSize: _iconGlyphSize,
            onTap: () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => const TeacherRolePlaceholderScreen(
                    title: 'Finance',
                    body: 'Finance dashboard coming soon.',
                  ),
                ),
              );
            },
          ));
    }

    entries.sort((a, b) => a.order.compareTo(b.order));
    return entries;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final entries = _responsibilityEntries(context);
    final count = _assignedRoleCount();
    final roleLabel = count == 1 ? '1 role' : '$count roles';

    return ColoredBox(
      color: AppColors.surface,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          TeacherUiTokens.horizontalPadding,
          16,
          TeacherUiTokens.horizontalPadding,
          28,
        ),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  'Roles & access',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.indigoWash.withValues(alpha: 0.95),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.12),
                  ),
                ),
                child: Text(
                  roleLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primaryDark.withValues(alpha: 0.88),
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Authority and responsibilities in your school',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 16),
          if (!data.hasAnyAssignedResponsibility)
            _EmptyResponsibilitiesCard(
              theme: theme,
              onRefresh: onDeskRefresh,
            )
          else
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < entries.length; i++) ...[
                  if (i > 0) const SizedBox(height: 8),
                  entries[i].card,
                ],
              ],
            ),
        ],
      ),
    );
  }
}

class _EmptyResponsibilitiesCard extends StatelessWidget {
  const _EmptyResponsibilitiesCard({
    required this.theme,
    required this.onRefresh,
  });

  final ThemeData theme;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.cardBorder.withValues(alpha: 0.85),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0C0F172A),
            blurRadius: 14,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(
            Icons.shield_outlined,
            size: 40,
            color: AppColors.primary.withValues(alpha: 0.48),
          ),
          const SizedBox(height: 12),
          Text(
            'No responsibilities assigned',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Your school administrator can assign academic, discipline, '
            'finance, health, or classroom responsibilities.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: () async {
              await onRefresh();
            },
            icon: Icon(
              Icons.refresh_rounded,
              size: 18,
              color: AppColors.primaryDark.withValues(alpha: 0.9),
            ),
            label: const Text('Refresh'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primaryDark,
              side: BorderSide(
                color: AppColors.cardBorder.withValues(alpha: 0.95),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ResponsibilityCard extends StatefulWidget {
  const _ResponsibilityCard({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.boxShadow,
    required this.iconBoxSize,
    required this.iconBoxRadius,
    required this.iconGlyphSize,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final List<BoxShadow> boxShadow;
  final double iconBoxSize;
  final double iconBoxRadius;
  final double iconGlyphSize;

  @override
  State<_ResponsibilityCard> createState() => _ResponsibilityCardState();
}

class _ResponsibilityCardState extends State<_ResponsibilityCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerUp: (_) => setState(() => _pressed = false),
      onPointerCancel: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.985 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: widget.onTap,
            splashColor: AppColors.primary.withValues(alpha: 0.12),
            highlightColor: AppColors.primary.withValues(alpha: 0.06),
            child: Ink(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.cardBorder.withValues(alpha: 0.75),
                ),
                boxShadow: widget.boxShadow,
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    SizedBox(
                      width: widget.iconBoxSize,
                      height: widget.iconBoxSize,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: widget.iconColor.withValues(alpha: 0.12),
                          borderRadius:
                              BorderRadius.circular(widget.iconBoxRadius),
                        ),
                        child: Center(
                          child: Icon(
                            widget.icon,
                            color: widget.iconColor,
                            size: widget.iconGlyphSize,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              letterSpacing: -0.15,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.subtitle,
                            style: TextStyle(
                              fontSize: 12.5,
                              height: 1.3,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.textSecondary.withValues(alpha: 0.85),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../widgets/school_logo_avatar.dart';
import 'teacher_quick_action.dart';

class TeacherHomeDashboard extends StatelessWidget {
  const TeacherHomeDashboard({
    super.key,
    required this.data,
    required this.todayAttendanceDedupCount,
    required this.todayLessonPlansCount,
    required this.onNavigate,
    required this.onRefresh,
    this.refreshError,
  });

  final TeacherDeskData data;
  final int todayAttendanceDedupCount;
  final int? todayLessonPlansCount;
  final void Function(TeacherQuickDestination d) onNavigate;
  final Future<void> Function() onRefresh;
  final String? refreshError;

  @override
  Widget build(BuildContext context) {
    final name =
        data.teacherName?.trim().isNotEmpty == true ? data.teacherName!.trim() : 'Teacher';
    final school = data.primarySchoolName?.trim().isNotEmpty == true
        ? data.primarySchoolName!.trim()
        : '';

    final assignmentSummary = data.assignments.isEmpty && data.showClassTeacherOnly
        ? 'Class teacher (${data.classTeacherClasses.length})'
        : data.assignments.isEmpty
            ? 'No teaching assignments loaded'
            : '${data.assignments.length} class / subject pairing${data.assignments.length == 1 ? '' : 's'}';

    return ColoredBox(
      color: const Color(0xFFF4F6FA),
      child: RefreshIndicator(
        onRefresh: onRefresh,
        color: AppColors.primary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            10,
            TeacherUiTokens.horizontalPadding,
            28,
          ),
          children: [
            if (refreshError != null) ...[
              Material(
                color: Theme.of(context).colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(14),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded,
                          color: Theme.of(context).colorScheme.onErrorContainer),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          refreshError!,
                          style: TextStyle(
                            color:
                                Theme.of(context).colorScheme.onErrorContainer,
                          ),
                        ),
                      ),
                      TextButton(onPressed: onRefresh, child: const Text('Retry')),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],
            if (data.showClassTeacherOnly) ...[
              _BannerCard(
                child: Text(
                  'You are set up as a class teacher. Subject teaching assignments '
                  'are managed separately — when your administrator assigns classes, '
                  'they will appear below.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        height: 1.4,
                        color: const Color(0xFF312E81),
                        fontWeight: FontWeight.w500,
                      ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            _DeskHeroCard(
              displayName: name,
              schoolLine: school,
              schoolLogoUrl: data.schoolLogoUrl,
              assignmentLine: assignmentSummary,
              attendanceToday: todayAttendanceDedupCount,
              lessonsToday: todayLessonPlansCount ?? 0,
            ),
            const SizedBox(height: 18),
            Text(
              'Working desk',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.06,
                    color: const Color(0xFF94A3B8),
                    fontSize: 13,
                  ),
            ),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 9,
              crossAxisSpacing: 9,
              childAspectRatio: 1.68,
              children: [
                for (final k in TeacherDeskTileKind.values)
                  _DeskShortcutTile(
                    kind: k,
                    enabled: !_tileDisabled(k),
                    onTap: () => _onTileTap(k),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  bool _tileDisabled(TeacherDeskTileKind k) {
    final noTeach = !data.hasTeachingAssignments;
    switch (k) {
      case TeacherDeskTileKind.attendance:
      case TeacherDeskTileKind.lessonPlans:
      case TeacherDeskTileKind.marks:
        return noTeach;
      case TeacherDeskTileKind.documents:
      case TeacherDeskTileKind.classesSubjects:
        return false;
      case TeacherDeskTileKind.evaluateSubject:
        return noTeach;
    }
  }

  void _onTileTap(TeacherDeskTileKind k) {
    switch (k) {
      case TeacherDeskTileKind.attendance:
        onNavigate(TeacherQuickDestination.attendance);
        break;
      case TeacherDeskTileKind.lessonPlans:
        onNavigate(TeacherQuickDestination.lessonPlans);
        break;
      case TeacherDeskTileKind.marks:
        onNavigate(TeacherQuickDestination.marks);
        break;
      case TeacherDeskTileKind.documents:
        onNavigate(TeacherQuickDestination.documents);
        break;
      case TeacherDeskTileKind.classesSubjects:
        onNavigate(TeacherQuickDestination.classesSubjects);
        break;
      case TeacherDeskTileKind.evaluateSubject:
        onNavigate(TeacherQuickDestination.evaluateSubject);
        break;
    }
  }
}

class _BannerCard extends StatelessWidget {
  const _BannerCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.085),
            const Color(0xFFEEF2FF),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.12),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: child,
    );
  }
}

/// Depth tier for art-directed glass hierarchy on the desk card.
enum _DeskGlassDepth {
  /// Hero anchor — strongest frost, border, and lift.
  primary,
  /// School context — supportive, clearly secondary.
  secondary,
  /// Pairings / workload line — lightest middle read.
  secondaryQuiet,
}

class _DeskGlassTierSpec {
  const _DeskGlassTierSpec({
    required this.top,
    required this.bottom,
    required this.borderA,
    required this.borderW,
    required this.glowA,
    required this.glowBlur,
    required this.glowSpread,
    required this.shadeA,
    required this.shadeBlur,
    required this.shadeSpread,
    required this.shadeY,
  });

  final double top;
  final double bottom;
  final double borderA;
  final double borderW;
  final double glowA;
  final double glowBlur;
  final double glowSpread;
  final double shadeA;
  final double shadeBlur;
  final double shadeSpread;
  final double shadeY;

  static _DeskGlassTierSpec forDepth(_DeskGlassDepth depth) {
    switch (depth) {
      case _DeskGlassDepth.primary:
        return const _DeskGlassTierSpec(
          top: 0.105,
          bottom: 0.052,
          borderA: 0.152,
          borderW: 0.8,
          glowA: 0.062,
          glowBlur: 17,
          glowSpread: -4,
          shadeA: 0.068,
          shadeBlur: 22,
          shadeSpread: -8,
          shadeY: 6,
        );
      case _DeskGlassDepth.secondary:
        return const _DeskGlassTierSpec(
          top: 0.042,
          bottom: 0.019,
          borderA: 0.076,
          borderW: 0.66,
          glowA: 0.017,
          glowBlur: 9,
          glowSpread: -4,
          shadeA: 0.028,
          shadeBlur: 12,
          shadeSpread: -7,
          shadeY: 4,
        );
      case _DeskGlassDepth.secondaryQuiet:
        return const _DeskGlassTierSpec(
          top: 0.036,
          bottom: 0.016,
          borderA: 0.069,
          borderW: 0.64,
          glowA: 0.014,
          glowBlur: 8,
          glowSpread: -4,
          shadeA: 0.024,
          shadeBlur: 11,
          shadeSpread: -7,
          shadeY: 3,
        );
    }
  }
}

/// Frosted glass surface with explicit primary / secondary depth.
class _DeskGlassPlate extends StatelessWidget {
  const _DeskGlassPlate({
    required this.child,
    required this.depth,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    this.borderRadius = 16,
  });

  final Widget child;
  final EdgeInsets padding;
  final double borderRadius;
  final _DeskGlassDepth depth;

  @override
  Widget build(BuildContext context) {
    final g = _DeskGlassTierSpec.forDepth(depth);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: g.top),
            Colors.white.withValues(alpha: g.bottom),
          ],
        ),
        border: Border.all(
          color: Colors.white.withValues(alpha: g.borderA),
          width: g.borderW,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.white.withValues(alpha: g.glowA),
            blurRadius: g.glowBlur,
            spreadRadius: g.glowSpread,
            offset: const Offset(0, 1),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: g.shadeA),
            blurRadius: g.shadeBlur,
            spreadRadius: g.shadeSpread,
            offset: Offset(0, g.shadeY),
          ),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// Compact school logo for the desk card — small, soft, no heavy ring.
class _HeroSchoolLogoBadge extends StatelessWidget {
  const _HeroSchoolLogoBadge({
    required this.logoUrl,
    required this.schoolName,
  });

  final String? logoUrl;
  final String schoolName;

  static const double _innerSize = 36;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.065),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.16),
          width: 0.55,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.white.withValues(alpha: 0.025),
            blurRadius: 8,
            spreadRadius: -3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: SchoolLogoAvatar(
        logoUrl: logoUrl,
        schoolName: schoolName,
        size: _innerSize,
        softChrome: true,
        fallbackIcon: Icons.school_rounded,
      ),
    );
  }
}

class _DeskHeroCard extends StatefulWidget {
  const _DeskHeroCard({
    required this.displayName,
    required this.schoolLine,
    required this.schoolLogoUrl,
    required this.assignmentLine,
    required this.attendanceToday,
    required this.lessonsToday,
  });

  final String displayName;
  final String schoolLine;
  final String? schoolLogoUrl;
  final String assignmentLine;
  final int attendanceToday;
  final int lessonsToday;

  @override
  State<_DeskHeroCard> createState() => _DeskHeroCardState();
}

class _DeskHeroCardState extends State<_DeskHeroCard>
    with SingleTickerProviderStateMixin {
  static const BorderRadius _radius = BorderRadius.all(Radius.circular(22));

  static const Alignment _highlightBegin = Alignment(-0.90, -0.94);
  static const Alignment _highlightEnd = Alignment(-0.84, -0.88);

  late final AnimationController _drift;

  @override
  void initState() {
    super.initState();
    _drift = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 16),
    );
  }

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  void _syncDriftAnimation() {
    final mq = MediaQuery.maybeOf(context);
    final reduceMotion = mq?.disableAnimations ?? false;
    final tickerOff = !TickerMode.of(context);
    if (reduceMotion || tickerOff) {
      _drift.stop();
      _drift.value = 0.5;
    } else if (!_drift.isAnimating) {
      _drift.repeat(reverse: true);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncDriftAnimation();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final markSchool =
        widget.schoolLine.trim().isNotEmpty ? widget.schoolLine.trim() : 'School';

    return Container(
      decoration: BoxDecoration(
        borderRadius: _radius,
        boxShadow: [
          const BoxShadow(
            color: Color(0x0C0F172A),
            blurRadius: 30,
            spreadRadius: -2,
            offset: Offset(0, 10),
          ),
          BoxShadow(
            color: Color(0xFF4F46E5).withValues(alpha: 0.07),
            blurRadius: 40,
            spreadRadius: -14,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.loose,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: TeacherUiTokens.deskWelcomeGradient,
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: const Alignment(-0.85, -1),
                  end: const Alignment(0.65, 0.9),
                  colors: [
                    Colors.white.withValues(alpha: 0.06),
                    Colors.transparent,
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.38, 1.0],
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.92, -0.48),
                  radius: 0.72,
                  colors: [
                    Colors.white.withValues(alpha: 0.055),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 1.0],
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: _drift,
                builder: (context, _) {
                  final t = Curves.easeInOutCubic.transform(_drift.value);
                  final center =
                      Alignment.lerp(_highlightBegin, _highlightEnd, t)!;
                  return DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: center,
                        radius: 1.12,
                        colors: [
                          Colors.white.withValues(alpha: 0.10),
                          Colors.transparent,
                        ],
                        stops: const [0.0, 1.0],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(1.02, 1.0),
                  radius: 1.18,
                  colors: [
                    const Color(0xFF1E1B4B).withValues(alpha: 0.22),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 1.0],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 22, 18, 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _DeskGlassPlate(
                  depth: _DeskGlassDepth.primary,
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                  borderRadius: 18,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _HeroSchoolLogoBadge(
                        logoUrl: widget.schoolLogoUrl,
                        schoolName: markSchool,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome back,',
                              style: theme.textTheme.labelLarge?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.78),
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.12,
                                    height: 1.25,
                                    fontSize: 12.5,
                                  ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              widget.displayName,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleLarge?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.36,
                                    height: 1.2,
                                    fontSize: 20,
                                  ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              'Your teaching desk is ready.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.74),
                                    fontWeight: FontWeight.w400,
                                    height: 1.45,
                                  ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              "Ready for today's classroom work",
                              style: theme.textTheme.labelSmall?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.44),
                                    fontWeight: FontWeight.w500,
                                    height: 1.35,
                                    fontSize: 11,
                                    letterSpacing: 0.02,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (widget.schoolLine.isNotEmpty)
                  _DeskGlassPlate(
                    depth: _DeskGlassDepth.secondary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
                    ),
                    borderRadius: 13,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.apartment_rounded,
                          size: 18,
                          color: Colors.white.withValues(alpha: 0.78),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            widget.schoolLine,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.91),
                                  fontWeight: FontWeight.w700,
                                  height: 1.22,
                                  letterSpacing: -0.06,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (widget.schoolLine.isNotEmpty) const SizedBox(height: 7),
                _DeskGlassPlate(
                  depth: _DeskGlassDepth.secondaryQuiet,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  borderRadius: 13,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.auto_stories_rounded,
                        size: 17,
                        color: Colors.white.withValues(alpha: 0.64),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          widget.assignmentLine,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelMedium?.copyWith(
                                color: Colors.white.withValues(alpha: 0.74),
                                height: 1.3,
                                fontWeight: FontWeight.w500,
                                fontSize: 12.5,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    color: Colors.white.withValues(alpha: 0.020),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.055),
                      width: 0.58,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.white.withValues(alpha: 0.022),
                        blurRadius: 12,
                        spreadRadius: -7,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(6, 6, 6, 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: _HeroStatChip(
                            label: 'Attendance today',
                            value: '${widget.attendanceToday}',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _HeroStatChip(
                            label: 'Lesson plans today',
                            value: '${widget.lessonsToday}',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroStatChip extends StatefulWidget {
  const _HeroStatChip({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  State<_HeroStatChip> createState() => _HeroStatChipState();
}

class _HeroStatChipState extends State<_HeroStatChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      behavior: HitTestBehavior.translucent,
      child: AnimatedScale(
        scale: _pressed ? 0.988 : 1.0,
        duration: const Duration(milliseconds: 95),
        curve: Curves.easeOutCubic,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 95),
          curve: Curves.easeOutCubic,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(15),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: _pressed ? 0.088 : 0.072),
                Colors.white.withValues(alpha: _pressed ? 0.040 : 0.034),
              ],
            ),
            border: Border.all(
              color: Colors.white.withValues(alpha: _pressed ? 0.095 : 0.098),
              width: 0.64,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.white.withValues(alpha: _pressed ? 0.028 : 0.022),
                blurRadius: 9,
                spreadRadius: -4,
                offset: const Offset(0, 1),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: _pressed ? 0.032 : 0.036),
                blurRadius: 12,
                spreadRadius: -7,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(13, 12, 13, 13),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    widget.value,
                    maxLines: 1,
                    style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.65,
                          height: 1.02,
                          fontSize: 28,
                        ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  widget.label,
                  style: theme.textTheme.labelSmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.48),
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                        letterSpacing: 0.02,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DeskShortcutTile extends StatelessWidget {
  const _DeskShortcutTile({
    required this.kind,
    required this.onTap,
    required this.enabled,
  });

  final TeacherDeskTileKind kind;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final palette = kind.palette;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(17),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: enabled ? onTap : null,
        splashColor:
            enabled ? AppColors.primary.withValues(alpha: 0.06) : null,
        child: Ink(
          decoration: BoxDecoration(
            color: enabled ? palette.cardBg : palette.cardBg.withValues(alpha: 0.56),
            borderRadius: BorderRadius.circular(17),
            border: Border.all(color: Colors.white.withValues(alpha: 0.95)),
            boxShadow: TeacherUiTokens.cardLift,
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(11, 8, 11, 12),
            child: Column(
              children: [
                SizedBox(
                  height: 34,
                  child: Center(
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: palette.iconDisc,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.97),
                          width: 1.05,
                        ),
                      ),
                      child: Icon(kind.icon, size: 18, color: palette.iconFg),
                    ),
                  ),
                ),
                const SizedBox(height: 5),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        kind.title,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              fontSize: 11.5,
                              height: 1.12,
                              letterSpacing: -0.06,
                              color: const Color(0xFF0F172A),
                            ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        enabled ? kind.subtitle : 'Requires assignment',
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 12,
                          height: 1.18,
                          color: AppColors.textSecondary.withValues(
                            alpha: enabled ? 0.7 : 0.48,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

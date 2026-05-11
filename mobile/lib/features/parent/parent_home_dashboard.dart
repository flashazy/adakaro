import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../core/currency_format.dart';
import '../../core/parent_display_name.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/parent_overview.dart';
import '../../data/models/student_summary.dart';
import '../../widgets/data_error_banner.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/parent_attention_indicator.dart';
import '../../widgets/school_logo_avatar.dart';
import '../../widgets/status_chip.dart';
import '../../widgets/student_avatar.dart';
import 'parent_quick_action.dart';

String? _normalizeHttpsUrl(String? raw) {
  final u = raw?.trim();
  if (u == null || u.isEmpty) return null;
  final lower = u.toLowerCase();
  if (!(lower.startsWith('http://') || lower.startsWith('https://'))) {
    return null;
  }
  return u;
}

String? _normalizeSchoolHeroLogoUrl(String? raw) => _normalizeHttpsUrl(raw);

/// First linked student avatar suitable for hero watermark (emotional backdrop only).
String? _heroWatermarkAvatarUrl(List<StudentSummary> students) {
  for (final s in students) {
    final url = _normalizeHttpsUrl(s.avatarUrl);
    if (url != null) return url;
  }
  return null;
}

class _HeroLead {
  const _HeroLead({
    this.schoolLogoUrl,
    required this.primaryLine,
    required this.secondaryLine,
    required this.markLetterSource,
    this.studentWatermarkAvatarUrl,
  });

  /// Network logo shown via [SchoolLogoAvatar]; stored normalized or raw resolves there.
  final String? schoolLogoUrl;

  /// School / organization headline under the greeting.
  final String primaryLine;

  /// Class subtitle, or synthesized context for multi-student setups.
  final String secondaryLine;

  /// Canonical string for embossed initials fallback (prefer full school/org name).
  final String markLetterSource;

  /// Subtle watermark only; omit when unavailable or fails to paint.
  final String? studentWatermarkAvatarUrl;

  static _HeroLead fromStudents(List<StudentSummary> students) {
    final watermarkAvatar = _heroWatermarkAvatarUrl(students);

    if (students.isEmpty) {
      return const _HeroLead(
        primaryLine: '',
        secondaryLine: '',
        markLetterSource: '',
        studentWatermarkAvatarUrl: null,
      );
    }
    if (students.length == 1) {
      final s = students.single;
      final sch = s.schoolName?.trim();
      final cls = s.className?.trim();
      final mark =
          sch?.isNotEmpty == true ? sch! : ((cls ?? '').isNotEmpty ? cls! : '');
      return _HeroLead(
        schoolLogoUrl: _normalizeSchoolHeroLogoUrl(s.schoolLogoUrl),
        primaryLine: sch ?? '',
        secondaryLine: cls ?? '',
        markLetterSource: mark,
        studentWatermarkAvatarUrl: watermarkAvatar,
      );
    }

    final schoolIds = {...students.map((x) => x.schoolId)};
    if (schoolIds.length > 1) {
      return _HeroLead(
        primaryLine: '${students.length} children',
        secondaryLine: 'Multiple schools',
        markLetterSource: '',
        studentWatermarkAvatarUrl: watermarkAvatar,
      );
    }

    final named = students
        .where((x) => (x.schoolName?.trim().isNotEmpty ?? false))
        .map((x) => x)
        .toList();
    final schoolNameSrc = named.isEmpty ? '' : named.first.schoolName!.trim();
    String? pickedLogoInput;
    for (final x in students) {
      final n = _normalizeSchoolHeroLogoUrl(x.schoolLogoUrl);
      if (n != null) {
        pickedLogoInput = x.schoolLogoUrl;
        break;
      }
    }

    final classLabels = students
        .map((x) => x.className?.trim())
        .whereType<String>()
        .where((c) => c.isNotEmpty)
        .toSet()
        .toList()
      ..sort();

    final secondary = switch (classLabels.length) {
      0 => '',
      1 => classLabels.single,
      _ => '${students.length} children',
    };

    final markSrc = schoolNameSrc.isNotEmpty
        ? schoolNameSrc
        : (secondary.isNotEmpty && classLabels.length == 1 ? secondary : '');

    return _HeroLead(
      schoolLogoUrl: _normalizeSchoolHeroLogoUrl(pickedLogoInput),
      primaryLine: schoolNameSrc.isNotEmpty
          ? schoolNameSrc
          : '${students.length} children',
      secondaryLine: secondary,
      markLetterSource: markSrc,
      studentWatermarkAvatarUrl: watermarkAvatar,
    );
  }
}

/// Parent home: calm school-life control center — detail lives in Fees and profiles.
class ParentHomeDashboard extends StatelessWidget {
  const ParentHomeDashboard({
    super.key,
    required this.overview,
    required this.onRefresh,
    required this.refreshError,
    required this.onOpenStudentProfile,
    required this.onQuickAction,
    required this.effectiveSeenAt,
  });

  final ParentOverview overview;
  final Future<void> Function() onRefresh;
  final String? refreshError;
  final void Function(StudentSummary student) onOpenStudentProfile;
  final void Function(ParentQuickAction action) onQuickAction;
  final Map<ParentQuickAction, DateTime?> effectiveSeenAt;

  static DateTime? _tryParseIso(String? v) {
    if (v == null) return null;
    final t = v.trim();
    if (t.isEmpty) return null;
    return DateTime.tryParse(t);
  }

  static bool _isUnseen(DateTime? latest, DateTime? seenAt) {
    if (latest == null) return false;
    if (seenAt == null) return true;
    return latest.isAfter(seenAt);
  }

  static Color _indicatorColor(ParentQuickAction a) {
    // Subtle, calm colors (premium): mapped per spec.
    return switch (a) {
      ParentQuickAction.messages => const Color(0xFF7A62E6), // purple
      ParentQuickAction.subjectResults => const Color(0xFF8D8AF0), // lavender
      ParentQuickAction.reportCards => const Color(0xFF3A78E6), // blue
      ParentQuickAction.fees => const Color(0xFFE0A23A), // amber
      ParentQuickAction.paymentsReceipts => const Color(0xFF2DAA7A), // green
      ParentQuickAction.attendance => const Color(0xFF3A78E6),
      ParentQuickAction.examResults => const Color(0xFF8D8AF0),
      ParentQuickAction.profile => const Color(0xFF94A3B8),
    };
  }

  Map<ParentQuickAction, Widget> _computeSmartIndicators() {
    final att = overview.attention;

    final messagesLatest = _tryParseIso(att.messagesLatestAt);
    final subjectLatest = _tryParseIso(att.subjectResultsLatestAt);
    final reportLatest = _tryParseIso(att.reportCardsLatestApprovedAt);
    final paymentsLatest = _tryParseIso(att.paymentsLatestAt);
    final attendanceLatest = _tryParseIso(att.attendanceConcernLatestAt);
    final feesLatestAt = _tryParseIso(att.feesLatestAt);

    final candidates = <({ParentQuickAction action, int priority, Widget w})>[];

    // Fees: only if overdue (amber), high priority; unseen vs last_seen uses fees activity time.
    if (att.feesHasOverdue &&
        _isUnseen(feesLatestAt, effectiveSeenAt[ParentQuickAction.fees])) {
      candidates.add((
        action: ParentQuickAction.fees,
        priority: 100,
        w: ParentAttentionIndicator(
          kind: ParentAttentionKind.dot,
          color: _indicatorColor(ParentQuickAction.fees),
        ),
      ));
    }

    // Messages: count when unread; otherwise dot for new comms.
    if (_isUnseen(
      messagesLatest,
      effectiveSeenAt[ParentQuickAction.messages],
    )) {
      if (att.messagesUnreadCount > 0) {
        candidates.add((
          action: ParentQuickAction.messages,
          priority: 95,
          w: ParentAttentionIndicator(
            kind: ParentAttentionKind.count,
            color: _indicatorColor(ParentQuickAction.messages),
            count: att.messagesUnreadCount,
          ),
        ));
      } else {
        candidates.add((
          action: ParentQuickAction.messages,
          priority: 80,
          w: ParentAttentionIndicator(
            kind: ParentAttentionKind.dot,
            color: _indicatorColor(ParentQuickAction.messages),
          ),
        ));
      }
    }

    // Report cards: subtle blue pulse when newly published.
    if (_isUnseen(
      reportLatest,
      effectiveSeenAt[ParentQuickAction.reportCards],
    )) {
      candidates.add((
        action: ParentQuickAction.reportCards,
        priority: 90,
        w: ParentAttentionIndicator(
          kind: ParentAttentionKind.pulse,
          color: _indicatorColor(ParentQuickAction.reportCards),
        ),
      ));
    }

    // Attendance: only serious concern.
    if (_isUnseen(
      attendanceLatest,
      effectiveSeenAt[ParentQuickAction.attendance],
    )) {
      candidates.add((
        action: ParentQuickAction.attendance,
        priority: 85,
        w: ParentAttentionIndicator(
          kind: ParentAttentionKind.dot,
          color: _indicatorColor(ParentQuickAction.attendance),
        ),
      ));
    }

    // Payments / receipts: muted green dot on new update.
    if (_isUnseen(
      paymentsLatest,
      effectiveSeenAt[ParentQuickAction.paymentsReceipts],
    )) {
      candidates.add((
        action: ParentQuickAction.paymentsReceipts,
        priority: 70,
        w: ParentAttentionIndicator(
          kind: ParentAttentionKind.dot,
          color: _indicatorColor(ParentQuickAction.paymentsReceipts),
        ),
      ));
    }

    // Subject results: soft lavender dot when new results appear and unseen.
    if (_isUnseen(
      subjectLatest,
      effectiveSeenAt[ParentQuickAction.subjectResults],
    )) {
      candidates.add((
        action: ParentQuickAction.subjectResults,
        priority: 60,
        w: ParentAttentionIndicator(
          kind: ParentAttentionKind.dot,
          color: _indicatorColor(ParentQuickAction.subjectResults),
        ),
      ));
    }

    // Cap indicators to avoid overload: show at most 3.
    candidates.sort((a, b) => b.priority.compareTo(a.priority));
    final chosen = candidates.take(3).toList();
    final out = <ParentQuickAction, Widget>{};
    for (final c in chosen) {
      out[c.action] = c.w;
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final students = overview.students;

    /// Compact finish above navigation + device home-indicator inset.
    final listBottomInset = 28.0 + MediaQuery.paddingOf(context).bottom;

    final parentDisplayName = formatParentHeroDisplayName(overview.profileName);
    final heroLead = _HeroLead.fromStudents(students);
    final schoolFormatted = heroLead.primaryLine.isEmpty
        ? ''
        : formatHeroContextLine(heroLead.primaryLine);

    return ColoredBox(
      color: ParentUiTokens.parentHomeCanvas,
      child: RefreshIndicator(
        onRefresh: onRefresh,
        color: AppColors.primary,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            ParentUiTokens.horizontalPadding,
            8,
            ParentUiTokens.horizontalPadding,
            listBottomInset,
          ),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (refreshError != null) ...[
              DataErrorBanner(
                message: refreshError!,
                onRetry: onRefresh,
              ),
              const SizedBox(height: 10),
            ],
            _PremiumWelcomeHero(
              parentDisplayName: parentDisplayName,
              schoolLine: schoolFormatted,
              badgeLine: 'Stay connected — every school moment matters.',
              schoolLogoUrl: heroLead.schoolLogoUrl,
              markLetterSource: heroLead.markLetterSource,
              studentWatermarkAvatarUrl: heroLead.studentWatermarkAvatarUrl,
            ),
            const SizedBox(height: 12),
            if (students.isEmpty)
              EmptyState(
                icon: Icons.family_restroom_rounded,
                title: 'No students linked',
                message: 'Connect through your school or the Adakaro website.',
              )
            else ...[
              _CompactSectionLabel('Shortcuts'),
              const SizedBox(height: 10),
              _ParentQuickActionsGrid(
                onTapAction: onQuickAction,
                indicators: _computeSmartIndicators(),
              ),
              const SizedBox(height: 18),
              _CompactSectionLabel(
                students.length == 1 ? 'Your child' : 'Your children',
                anchored: true,
              ),
              const SizedBox(height: 12),
              ...students.map((s) {
                final rows = overview.balances
                    .where((b) => b.studentId == s.id)
                    .toList();
                final due = rows.fold<double>(0, (a, b) => a + b.balance);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _HomeStudentSummaryCard(
                    student: s,
                    balanceDue: due,
                    onOpenProfile: () => onOpenStudentProfile(s),
                  ),
                );
              }),
              const _DashboardAtmosphereFooter(),
            ],
          ],
        ),
      ),
    );
  }
}

class _PremiumWelcomeHero extends StatelessWidget {
  const _PremiumWelcomeHero({
    required this.parentDisplayName,
    required this.schoolLine,
    required this.badgeLine,
    required this.schoolLogoUrl,
    required this.markLetterSource,
    required this.studentWatermarkAvatarUrl,
  });

  final String parentDisplayName;
  final String schoolLine;
  final String badgeLine;
  final String? schoolLogoUrl;
  final String markLetterSource;

  /// Calm emotional backdrop behind hero copy; omit when unavailable.
  final String? studentWatermarkAvatarUrl;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasParentName = parentDisplayName.isNotEmpty;
    final watermarkUrl = studentWatermarkAvatarUrl;

    return Container(
      decoration: BoxDecoration(
        gradient: ParentUiTokens.parentWelcomeGradient,
        borderRadius: BorderRadius.circular(22),
        boxShadow: ParentUiTokens.parentHeroElevatedShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -28,
            top: -32,
            child: IgnorePointer(
              child: Container(
                width: 104,
                height: 104,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.024),
                ),
              ),
            ),
          ),
          if (watermarkUrl != null)
            Positioned.fill(
              child: IgnorePointer(
                child: ExcludeSemantics(
                  child: Align(
                    alignment: const Alignment(1.24, 0.47),
                    child: _HeroStudentWatermark(imageUrl: watermarkUrl),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: SchoolLogoAvatar(
                    logoUrl: schoolLogoUrl,
                    schoolName: markLetterSource,
                    size: 48,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  hasParentName ? 'Welcome back,' : 'Welcome back',
                  textAlign: TextAlign.start,
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.90),
                    fontWeight: FontWeight.w600,
                    height: 1.34,
                    letterSpacing: -0.05,
                  ),
                ),
                if (hasParentName) ...[
                  const SizedBox(height: 7),
                  Text(
                    parentDisplayName,
                    textAlign: TextAlign.start,
                    maxLines: 2,
                    softWrap: true,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.28,
                      height: 1.28,
                    ),
                  ),
                ],
                if (schoolLine.isNotEmpty) ...[
                  SizedBox(height: hasParentName ? 12 : 11),
                  Text(
                    schoolLine,
                    textAlign: TextAlign.start,
                    maxLines: 2,
                    softWrap: true,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: Colors.white.withValues(alpha: 0.88),
                      fontWeight: FontWeight.w600,
                      height: 1.38,
                    ),
                  ),
                ],
                if (badgeLine.isNotEmpty) ...[
                  SizedBox(height: schoolLine.isNotEmpty ? 14 : 13),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.088),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.075),
                        width: 0.85,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 9.5, 16, 9.5),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(top: 1),
                            child: Icon(
                              Icons.hub_outlined,
                              size: 15,
                              color: Colors.white.withValues(alpha: 0.82),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              badgeLine,
                              textAlign: TextAlign.start,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontWeight: FontWeight.w500,
                                height: 1.32,
                                fontSize: 10.75,
                                letterSpacing: -0.01,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Faint circular student portrait behind hero copy — removed if load fails.
class _HeroStudentWatermark extends StatefulWidget {
  const _HeroStudentWatermark({required this.imageUrl});

  /// ~8% smaller than prior pass — more breathing room for the text rail.
  static const double _diameter = 188;

  /// Subtle portrait presence; veil + rim tint blend the oval only (no haze planes).
  static const double _watermarkOpacity = 0.09;

  /// Slightly softer focal detail; keeps likeness visible, not photographic.
  static const double _blurSigma = 3.4;

  static const double _blurScaleBoost = 1.08;

  /// Soft veil over likeness to reduce harsh contrast without losing warmth.
  static const Color _warmVeil = Color.fromRGBO(246, 244, 255, 1);

  /// Matches hero violet; used only inside the oval rim (tiny soft ring, not a plate).
  static final Color _heroRimGlow =
      const Color(0xFF6B63EA).withValues(alpha: 0.105);

  final String imageUrl;

  @override
  State<_HeroStudentWatermark> createState() => _HeroStudentWatermarkState();
}

class _HeroStudentWatermarkState extends State<_HeroStudentWatermark> {
  bool _disposeTree = false;

  @override
  Widget build(BuildContext context) {
    if (_disposeTree) {
      return const SizedBox.shrink();
    }

    final imageLayer = ColorFiltered(
      colorFilter: const ColorFilter.matrix(<double>[
        0.92,
        0.05,
        0.03,
        0,
        6,
        0.05,
        0.91,
        0.05,
        0,
        7,
        0.03,
        0.06,
        0.93,
        0,
        10,
        0,
        0,
        0,
        1,
        0,
      ]),
      child: Stack(
        fit: StackFit.expand,
        clipBehavior: Clip.hardEdge,
        children: [
          ImageFiltered(
            imageFilter: ImageFilter.blur(
              sigmaX: _HeroStudentWatermark._blurSigma,
              sigmaY: _HeroStudentWatermark._blurSigma,
            ),
            child: Transform.scale(
              scale: _HeroStudentWatermark._blurScaleBoost,
              child: Image.network(
                widget.imageUrl,
                fit: BoxFit.cover,
                gaplessPlayback: true,
                alignment: Alignment.center,
                filterQuality: FilterQuality.low,
                errorBuilder: (context, _, __) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) {
                      setState(() => _disposeTree = true);
                    }
                  });
                  return const SizedBox.expand();
                },
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) {
                    return child;
                  }
                  return const SizedBox.expand();
                },
              ),
            ),
          ),
          ColoredBox(
            color: _HeroStudentWatermark._warmVeil.withValues(alpha: 0.13),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.02,
                colors: [
                  Colors.transparent,
                  _HeroStudentWatermark._heroRimGlow,
                ],
                stops: const [0.8, 1.0],
              ),
            ),
          ),
        ],
      ),
    );

    return SizedBox.square(
      dimension: _HeroStudentWatermark._diameter,
      child: ClipOval(
        child: Opacity(
          opacity: _HeroStudentWatermark._watermarkOpacity,
          child: imageLayer,
        ),
      ),
    );
  }
}

class _CompactSectionLabel extends StatelessWidget {
  const _CompactSectionLabel(this.label, {this.anchored = false});

  final String label;
  final bool anchored;

  @override
  Widget build(BuildContext context) {
    if (anchored) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 3,
            height: 17,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.primary.withValues(alpha: 0.52),
                  AppColors.primary.withValues(alpha: 0.26),
                ],
              ),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.04,
                    fontSize: 15,
                    color: const Color(0xFF596175),
                    height: 1.24,
                  ),
            ),
          ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.only(left: 6, bottom: 1),
      child: Text(
        label,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.12,
              fontSize: 13,
              color: const Color(0xFFB1BACE),
              height: 1.2,
            ),
      ),
    );
  }
}

class _FooterSecondaryTaglineSlot extends StatelessWidget {
  /// Reserved for a future static or rotating emotional line; intentionally empty.
  const _FooterSecondaryTaglineSlot();

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _DashboardAtmosphereFooter extends StatelessWidget {
  const _DashboardAtmosphereFooter();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 0),
      child: Align(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Run your school with clarity.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 10.25,
                    fontWeight: FontWeight.w400,
                    letterSpacing: 0.12,
                    height: 1.4,
                    color: const Color(0xFF8C96AA).withValues(alpha: 0.44),
                  ),
            ),
            const _FooterSecondaryTaglineSlot(),
          ],
        ),
      ),
    );
  }
}

List<BoxShadow> _shortcutPressShadows(
  List<BoxShadow> base,
  List<BoxShadow> extra,
  double press,
) {
  final t = press.clamp(0.0, 1.0);
  BoxShadow soften(BoxShadow s) => BoxShadow(
        color: s.color,
        blurRadius: s.blurRadius * (1.0 - 0.14 * t),
        offset: Offset(s.offset.dx, s.offset.dy * (1.0 - 0.2 * t)),
        spreadRadius: s.spreadRadius,
      );
  return [...base.map(soften), ...extra.map(soften)];
}

class _ParentQuickActionsGrid extends StatelessWidget {
  const _ParentQuickActionsGrid({
    required this.onTapAction,
    required this.indicators,
  });

  final void Function(ParentQuickAction action) onTapAction;
  final Map<ParentQuickAction, Widget> indicators;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      mainAxisSpacing: 9,
      crossAxisSpacing: 9,
      childAspectRatio: 1.74,
      children: [
        for (final action in kParentQuickActionsGridOrder)
          _CompactShortcutTile(
            action: action,
            onTap: () => onTapAction(action),
            indicator: indicators[action],
          ),
      ],
    );
  }
}

class _CompactShortcutTile extends StatefulWidget {
  const _CompactShortcutTile({
    required this.action,
    required this.onTap,
    required this.indicator,
  });

  final ParentQuickAction action;
  final VoidCallback onTap;
  final Widget? indicator;

  @override
  State<_CompactShortcutTile> createState() => _CompactShortcutTileState();
}

class _CompactShortcutTileState extends State<_CompactShortcutTile>
    with SingleTickerProviderStateMixin {
  late final AnimationController _press;

  @override
  void initState() {
    super.initState();
    _press = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 95),
      reverseDuration: const Duration(milliseconds: 155),
    );
  }

  @override
  void dispose() {
    _press.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final action = widget.action;
    final style = action.homeTileStyle;
    final emphasized = action.homeEmphasizedOnDashboard;
    const iconBandHeight = 42.0;
    const circleSize = 37.0;
    const edgePad = EdgeInsets.fromLTRB(10, 9, 10, 9);
    final baseShadows = ParentUiTokens.quickActionPremiumShadow;
    final extraShadows =
        emphasized ? ParentUiTokens.quickActionEmphasisLift : <BoxShadow>[];
    final indicator = widget.indicator;

    return Listener(
      onPointerDown: (_) => _press.forward(),
      onPointerUp: (_) => _press.reverse(),
      onPointerCancel: (_) => _press.reverse(),
      child: AnimatedBuilder(
        animation: _press,
        builder: (context, _) {
          final t = Curves.easeOutCubic.transform(_press.value);
          final scale = 1.0 - t * 0.015;
          final shadows = _shortcutPressShadows(
            baseShadows,
            extraShadows,
            t,
          );
          return Transform.scale(
            scale: scale,
            alignment: Alignment.center,
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(17),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: widget.onTap,
                borderRadius: BorderRadius.circular(17),
                splashFactory: InkRipple.splashFactory,
                splashColor: AppColors.primary
                    .withValues(alpha: emphasized ? 0.09 : 0.07),
                highlightColor: Colors.transparent,
                child: Ink(
                  decoration: BoxDecoration(
                    color: style.cardBg,
                    borderRadius: BorderRadius.circular(17),
                    border: Border.all(
                      color: emphasized
                          ? const Color(0x100F172A)
                          : Colors.white.withValues(alpha: 0.96),
                      width: emphasized ? 1.08 : 1,
                    ),
                    boxShadow: shadows,
                  ),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Padding(
                        padding: edgePad,
                        child: Column(
                          children: [
                            SizedBox(
                              height: iconBandHeight,
                              width: double.infinity,
                              child: Center(
                                child: Container(
                                  width: circleSize,
                                  height: circleSize,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: style.iconDisc,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.97),
                                      width: 1.05,
                                    ),
                                  ),
                                  child: Icon(
                                    action.icon,
                                    color: style.iconFg,
                                    size: 17.75,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Expanded(
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 2),
                                child: Column(
                                  children: [
                                    Expanded(
                                      child: Align(
                                        alignment: Alignment.center,
                                        child: Text(
                                          action.title,
                                          maxLines: 2,
                                          softWrap: true,
                                          textAlign: TextAlign.center,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelMedium
                                              ?.copyWith(
                                                fontWeight: FontWeight.w700,
                                                height: 1.08,
                                                fontSize: 11.55,
                                                letterSpacing: -0.13,
                                                color: const Color(0xFF0F172A),
                                              ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    SizedBox(
                                      height: 12,
                                      width: double.infinity,
                                      child: Align(
                                        alignment: Alignment.topCenter,
                                        child: Text(
                                          action.homeSubtitle,
                                          maxLines: 1,
                                          softWrap: true,
                                          textAlign: TextAlign.center,
                                          overflow: TextOverflow.ellipsis,
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelSmall
                                              ?.copyWith(
                                                fontWeight: FontWeight.w500,
                                                fontSize: 9.875,
                                                height: 1.02,
                                                color: AppColors.textSecondary
                                                    .withValues(alpha: 0.84),
                                                letterSpacing: 0.02,
                                              ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (indicator != null)
                        Positioned(
                          right: 10,
                          top: 9,
                          child: IgnorePointer(
                            child: ExcludeSemantics(child: indicator),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _HomeStudentSummaryCard extends StatelessWidget {
  const _HomeStudentSummaryCard({
    required this.student,
    required this.balanceDue,
    required this.onOpenProfile,
  });

  final StudentSummary student;
  final double balanceDue;
  final VoidCallback onOpenProfile;

  @override
  Widget build(BuildContext context) {
    final sch = student.schoolName?.trim();
    final cls = student.className?.trim();

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(21),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: BorderRadius.circular(21),
        onTap: onOpenProfile,
        splashFactory: InkRipple.splashFactory,
        splashColor: AppColors.primary.withValues(alpha: 0.055),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(21),
            border: Border.all(
              color: AppColors.cardBorder.withValues(alpha: 0.26),
            ),
            boxShadow: ParentUiTokens.homeStudentAnchorShadow,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.07),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: StudentAvatar(
                          radius: 42,
                          imageUrl: student.avatarUrl,
                          fallbackName: student.fullName,
                        ),
                      ),
                      Positioned(
                        right: 1,
                        bottom: 1,
                        child: Container(
                          width: 11,
                          height: 11,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.success.withValues(alpha: 0.88),
                            border: Border.all(
                              color: Colors.white,
                              width: 2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color:
                                    AppColors.success.withValues(alpha: 0.22),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        student.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.22,
                              height: 1.18,
                              color: const Color(0xFF0F172A),
                            ),
                      ),
                      if (sch != null && sch.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          sch,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontSize: 13,
                                    color: AppColors.textSecondary
                                        .withValues(alpha: 0.72),
                                    fontWeight: FontWeight.w400,
                                    height: 1.25,
                                  ),
                        ),
                      ],
                      if (cls != null && cls.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          cls,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontSize: 12,
                                    color: AppColors.textSecondary
                                        .withValues(alpha: 0.64),
                                    fontWeight: FontWeight.w400,
                                    height: 1.2,
                                  ),
                        ),
                      ],
                      if (student.admissionNumber?.trim().isNotEmpty ==
                          true) ...[
                        const SizedBox(height: 5),
                        Text(
                          student.admissionNumber!.trim(),
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    fontSize: 10,
                                    letterSpacing: 0.06,
                                    color: AppColors.textSecondary
                                        .withValues(alpha: 0.55),
                                    fontWeight: FontWeight.w500,
                                  ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (balanceDue > 0)
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerRight,
                        child: StatusChip(
                          label:
                              'Balance • ${formatCurrency(balanceDue, student.currencyCode)}',
                          foreground: const Color(0xFF44403C),
                          background: const Color(0xFFF5F5F4),
                          borderColor: const Color(0xFFE7E5E4),
                          icon: null,
                          compact: true,
                        ),
                      )
                    else
                      StatusChip.paidUp(compact: true),
                    const SizedBox(height: 4),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: AppColors.textSecondary.withValues(alpha: 0.32),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';
import 'teacher_lesson_plan_detail_screen.dart';
import 'teacher_new_lesson_plan_screen.dart';

class TeacherLessonPlansScreen extends StatefulWidget {
  const TeacherLessonPlansScreen({
    super.key,
    required this.user,
    required this.data,
  });

  final User user;
  final TeacherDeskData data;

  @override
  State<TeacherLessonPlansScreen> createState() =>
      _TeacherLessonPlansScreenState();
}

class _TeacherLessonPlansScreenState extends State<TeacherLessonPlansScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);

  List<TeacherLessonPlanListRow> _plans = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await _repo.loadLessonPlans(widget.user.id);
      if (!mounted) return;
      setState(() {
        _plans = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyDataLoadError(e);
        _loading = false;
      });
    }
  }

  Future<void> _openNewPlan() async {
    final assigns = widget.data.assignments
        .where((a) => a.subjectId != null && a.subjectId!.isNotEmpty)
        .toList();
    if (assigns.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Lesson plans need a catalog subject link on your assignment.',
            ),
          ),
        );
      }
      return;
    }

    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (ctx) => TeacherNewLessonPlanScreen(
          user: widget.user,
          data: widget.data,
        ),
      ),
    );
    if (saved == true && mounted) {
      await _load();
    }
  }

  void _openPlanDetail(TeacherLessonPlanListRow plan) {
    Navigator.of(context)
        .push<void>(
      MaterialPageRoute<void>(
        builder: (ctx) => TeacherLessonPlanDetailScreen(
          user: widget.user,
          data: widget.data,
          summary: plan,
        ),
      ),
    )
        .then((_) {
      if (mounted) unawaited(_load());
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final cardBorder =
        AppColors.cardBorder.withValues(alpha: dark ? 0.42 : 0.88);
    final cardFill = dark
        ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.22)
        : Colors.white.withValues(alpha: 0.92);
    final pageBg = dark
        ? Color.lerp(
            theme.colorScheme.surfaceContainerLowest,
            theme.colorScheme.surface,
            0.25,
          )!
        : Color.lerp(AppColors.surface, Colors.white, 0.35)!;

    return Scaffold(
      backgroundColor: pageBg,
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? ListView(children: [
                SizedBox(height: MediaQuery.sizeOf(context).height * 0.3),
                const Center(child: CircularProgressIndicator()),
              ])
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                  TeacherUiTokens.horizontalPadding,
                  16,
                  TeacherUiTokens.horizontalPadding,
                  100,
                ),
                children: [
                  Text(
                    'Lesson plans',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tap a plan to view details',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppColors.textSecondary.withValues(
                        alpha: dark ? 0.55 : 0.72,
                      ),
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.1,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _error!,
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                    ),
                  if (_plans.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 48),
                      child: Text(
                        widget.data.hasTeachingAssignments
                            ? 'No lesson plans yet. Tap + to create one.'
                            : 'Assignments are required to publish lesson plans here.',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ..._plans.map((p) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => _openPlanDetail(p),
                          borderRadius: BorderRadius.circular(14),
                          child: Ink(
                            decoration: BoxDecoration(
                              color: cardFill,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: cardBorder),
                              boxShadow: TeacherUiTokens.cardLift,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(
                                16,
                                14,
                                10,
                                14,
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          p.subjectName,
                                          style: theme.textTheme.titleSmall
                                              ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: -0.15,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          '${p.className} · ${p.lessonDate}',
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                            color: AppColors.textSecondary
                                                .withValues(
                                              alpha: dark ? 0.62 : 0.88,
                                            ),
                                            height: 1.35,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Period ${p.period} · ${p.durationMinutes} min',
                                          style: theme.textTheme.labelSmall
                                              ?.copyWith(
                                            color: AppColors.textSecondary
                                                .withValues(
                                              alpha: dark ? 0.5 : 0.72,
                                            ),
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 0.12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.chevron_right_rounded,
                                        color: AppColors.textSecondary
                                            .withValues(
                                          alpha: dark ? 0.45 : 0.55,
                                        ),
                                        size: 26,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'View',
                                        style: theme.textTheme.labelSmall
                                            ?.copyWith(
                                          color: AppColors.textSecondary
                                              .withValues(
                                            alpha: dark ? 0.5 : 0.65,
                                          ),
                                          fontWeight: FontWeight.w700,
                                          fontSize: 10,
                                          letterSpacing: 0.35,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
      ),
      floatingActionButton: widget.data.hasTeachingAssignments
          ? FloatingActionButton(
              onPressed: _openNewPlan,
              child: const Icon(Icons.add_rounded),
            )
          : null,
    );
  }
}

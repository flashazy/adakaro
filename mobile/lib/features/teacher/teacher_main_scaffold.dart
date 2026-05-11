import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';
import '../auth/login_screen.dart';
import 'teacher_academic_reports_screen.dart';
import 'teacher_attendance_screen.dart'
    show AttendanceLeaveHandler, TeacherAttendanceScreen;
import 'teacher_documents_screen.dart';
import 'teacher_evaluate_subject_screen.dart';
import 'teacher_home_dashboard.dart';
import 'teacher_lesson_plans_screen.dart';
import 'teacher_marks_screen.dart';
import 'teacher_more_hub_screen.dart';
import 'teacher_quick_action.dart';
import 'widgets/teacher_locked_desk_placeholder.dart';
import '../../widgets/school_logo_avatar.dart';

class TeacherMainScaffold extends StatefulWidget {
  const TeacherMainScaffold({super.key, required this.user});

  final User user;

  @override
  State<TeacherMainScaffold> createState() => _TeacherMainScaffoldState();
}

class _TeacherMainScaffoldState extends State<TeacherMainScaffold> {
  final _repo = TeacherRepository(Supabase.instance.client);

  int _tab = 0;
  TeacherDeskData? _desk;
  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  String? _refreshError;

  int _attToday = 0;
  int _lessonsToday = 0;

  AttendanceLeaveHandler? _attendanceLeaveHandler;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _todayYmd() {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<void> _load() async {
    final isRefresh = _desk != null;
    if (isRefresh) {
      setState(() {
        _refreshing = true;
        _refreshError = null;
      });
    } else {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final desk = await _repo.loadDesk(widget.user.id);

      final classIds = desk.assignments.map((e) => e.classId).toSet().toList();

      final attendCount = await _repo.countAttendanceTodayDedup(
        teacherId: widget.user.id,
        dateYmd: _todayYmd(),
      );
      final lessonCount = classIds.isEmpty
          ? 0
          : await _repo.countLessonPlansToday(
              teacherId: widget.user.id,
              classIds: classIds,
              lessonDate: _todayYmd(),
            );

      if (!mounted) return;
      setState(() {
        _desk = desk;
        _attToday = attendCount;
        _lessonsToday = lessonCount;
        _loading = false;
        _refreshing = false;
        _error = null;
        _refreshError = null;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = friendlyDataLoadError(e);
      if (isRefresh) {
        setState(() {
          _refreshing = false;
          _refreshError = msg;
        });
      } else {
        setState(() {
          _error = msg;
          _loading = false;
        });
      }
    }
  }

  Future<void> _signOut() async {
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {}
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      (r) => false,
    );
  }

  Future<void> _trySelectTab(int i) async {
    if (_tab == 1 && i != 1) {
      final h = _attendanceLeaveHandler;
      if (h != null && !await h()) return;
    }
    if (mounted) setState(() => _tab = i);
  }

  void _onNavigate(TeacherQuickDestination d) {
    switch (d) {
      case TeacherQuickDestination.attendance:
        unawaited(_trySelectTab(1));
        break;
      case TeacherQuickDestination.lessonPlans:
        unawaited(_trySelectTab(3));
        break;
      case TeacherQuickDestination.marks:
        unawaited(_trySelectTab(2));
        break;
      case TeacherQuickDestination.documents:
        final docDesk = _desk;
        if (docDesk == null) return;
        Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => TeacherDocumentsScreen(
              user: widget.user,
              data: docDesk,
            ),
          ),
        );
        break;
      case TeacherQuickDestination.evaluateSubject:
        final evDesk = _desk;
        if (evDesk == null) return;
        Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => TeacherEvaluateSubjectScreen(
              user: widget.user,
              data: evDesk,
            ),
          ),
        );
        break;
      case TeacherQuickDestination.classesSubjects:
        final desk = _desk;
        if (desk == null) return;
        _showClassesSubjectsSheet(context, desk);
        break;
      case TeacherQuickDestination.academicReports:
        final desk = _desk;
        if (desk == null) return;
        if (!desk.showsAcademicDepartment) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Academic reports are available when your school assigns you '
                'to the Academic department (Roles tab).',
              ),
            ),
          );
          return;
        }
        openAcademicReportsOncePlausible(context, data: desk);
        break;
    }
  }

  void _showClassesSubjectsSheet(BuildContext context, TeacherDeskData desk) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Classes & subjects',
                    style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 12),
                  if (desk.assignments.isEmpty)
                    Text(
                      desk.showClassTeacherOnly
                          ? 'You are assigned as class teacher — subject assignments will appear separately.'
                          : 'No assignments to list yet.',
                      style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    )
                  else
                    ...desk.assignments.map(
                      (a) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Material(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          elevation: 0,
                          shadowColor: Colors.transparent,
                          child: ExpansionTile(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: AppColors.cardBorder.withValues(
                                  alpha: 0.7,
                                ),
                              ),
                            ),
                            title: Text(
                              a.className,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            subtitle: Text(a.subjectLabel),
                            childrenPadding:
                                const EdgeInsets.fromLTRB(16, 0, 16, 12),
                            children: [
                              Text(
                                'Year · ${a.academicYear}',
                                style: Theme.of(ctx)
                                    .textTheme
                                    .labelMedium
                                    ?.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                              ),
                              const Divider(),
                              ...(desk.studentsByClassId[a.classId] ??
                                      const [])
                                  .take(120)
                                  .map(
                                    (s) => ListTile(
                                      dense: true,
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(
                                        s.fullName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      subtitle: (s.admissionNumber
                                                  ?.trim()
                                                  .isNotEmpty ==
                                              true)
                                          ? Text('Adm: ${s.admissionNumber}')
                                          : null,
                                    ),
                                  ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 48,
                  height: 48,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Preparing your teaching desk…',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_error != null && _desk == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Teacher')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 20),
                FilledButton(onPressed: _load, child: const Text('Try again')),
              ],
            ),
          ),
        ),
      );
    }

    final desk = _desk!;

    if (desk.showFullLock) {
      final avatarSchoolLabel = () {
        final fromLock = desk.lockedContact?.schoolName.trim() ?? '';
        if (fromLock.isNotEmpty) return fromLock;
        final fromDesk = desk.primarySchoolName?.trim() ?? '';
        if (fromDesk.isNotEmpty) return fromDesk;
        return 'School';
      }();
      final teacherSubtitle = () {
        final n = desk.teacherName?.trim() ?? '';
        if (n.isEmpty) return null;
        return 'Teacher: $n';
      }();

      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          backgroundColor: AppColors.surface,
          surfaceTintColor: Colors.transparent,
          centerTitle: false,
          toolbarHeight: 56,
          leadingWidth: 62,
          leading: Padding(
            padding: const EdgeInsets.only(left: 10),
            child: Center(
              child: SchoolLogoAvatar(
                logoUrl: desk.lockedContact?.schoolLogoUrl,
                schoolName: avatarSchoolLabel,
                size: 46,
                fallbackIcon: Icons.school_rounded,
              ),
            ),
          ),
          titleSpacing: 8,
          title: Align(
            alignment: Alignment.centerLeft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Teacher',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                if (teacherSubtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Text(
                      teacherSubtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            IconButton(
              tooltip: 'Refresh',
              onPressed: _refreshing ? null : _load,
              icon: _refreshing
                  ? SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    )
                  : const Icon(Icons.refresh_rounded),
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'signout') {
                  _signOut();
                } else if (v == 'refresh') {
                  _load();
                } else if (v == 'contact') {
                  openTeacherAdministratorContact(context, desk.lockedContact);
                }
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'refresh',
                  child: Row(
                    children: [
                      Icon(
                        Icons.refresh_rounded,
                        size: 20,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                      const SizedBox(width: 12),
                      const Text('Refresh'),
                    ],
                  ),
                ),
                if (teacherLockedContactIsReachable(desk.lockedContact))
                  PopupMenuItem(
                    value: 'contact',
                    child: Row(
                      children: [
                        Icon(
                          Icons.support_agent_rounded,
                          size: 20,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                        const SizedBox(width: 12),
                        const Text('Contact administrator'),
                      ],
                    ),
                  ),
                PopupMenuItem(
                  value: 'signout',
                  child: Row(
                    children: [
                      Icon(
                        Icons.logout_rounded,
                        size: 20,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                      const SizedBox(width: 12),
                      const Text('Sign out'),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () async {
            await _load();
          },
          child: TeacherLockedDeskPlaceholder(
            contact: desk.lockedContact,
            onRefreshStatus: _load,
            onSignOut: _signOut,
            isRefreshing: _refreshing,
          ),
        ),
      );
    }

    final tabs = <Widget>[
      TeacherHomeDashboard(
        data: desk,
        todayAttendanceDedupCount: _attToday,
        todayLessonPlansCount: _lessonsToday,
        refreshError: _refreshError,
        onRefresh: _load,
        onNavigate: _onNavigate,
      ),
      TeacherAttendanceScreen(
        user: widget.user,
        data: desk,
        onRegisterLeaveHandler: (h) => _attendanceLeaveHandler = h,
      ),
      TeacherMarksScreen(user: widget.user, data: desk),
      TeacherLessonPlansScreen(user: widget.user, data: desk),
      TeacherMoreHubScreen(
        data: desk,
        onOpenClassesSubjects: () => _showClassesSubjectsSheet(context, desk),
        onDeskRefresh: _load,
      ),
    ];

    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Teacher'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refreshing ? null : _load,
            icon: _refreshing
                ? SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color:
                          Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'signout') _signOut();
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'signout', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: tabs),
      bottomNavigationBar: keyboardOpen
          ? null
          : NavigationBar(
              selectedIndex: _tab,
              onDestinationSelected: (i) => unawaited(_trySelectTab(i)),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.how_to_reg_outlined),
                  selectedIcon: Icon(Icons.how_to_reg_rounded),
                  label: 'Attendance',
                ),
                NavigationDestination(
                  icon: Icon(Icons.grading_outlined),
                  selectedIcon: Icon(Icons.grade_rounded),
                  label: 'Marks',
                ),
                NavigationDestination(
                  icon: Icon(Icons.auto_stories_outlined),
                  selectedIcon: Icon(Icons.auto_stories_rounded),
                  label: 'Plans',
                ),
                NavigationDestination(
                  icon: Icon(Icons.badge_outlined),
                  selectedIcon: Icon(Icons.badge_rounded),
                  label: 'Roles',
                ),
              ],
            ),
    );
  }
}

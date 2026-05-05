import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/teacher_home_models.dart';
import '../../data/teacher_home_repository.dart';
import '../auth/login_screen.dart';
import '../../widgets/empty_state.dart';

/// Read-only teacher home: assignments, catalog subjects, and students where RLS allows.
class TeacherHomeScreen extends StatefulWidget {
  const TeacherHomeScreen({super.key, required this.user});

  final User user;

  @override
  State<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends State<TeacherHomeScreen> {
  TeacherHomeData? _data;
  bool _loading = true;
  bool _refreshing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final isRefresh = _data != null;
    if (isRefresh) {
      setState(() {
        _refreshing = true;
        _error = null;
      });
    } else {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final repo = TeacherHomeRepository(Supabase.instance.client);
      final data = await repo.load(widget.user.id);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
        _refreshing = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyDataLoadError(e);
        _loading = false;
        _refreshing = false;
      });
    }
  }

  Future<void> _signOut() async {
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {
      // Best-effort sign out; still clear local session UI.
    }
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      (r) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Adakaro')),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 40,
                height: 40,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
              SizedBox(height: 20),
              Text('Loading your teaching overview…'),
            ],
          ),
        ),
      );
    }

    if (_error != null && _data == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Adakaro')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.cloud_off_rounded,
                    size: 56, color: Theme.of(context).colorScheme.outline),
                const SizedBox(height: 16),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Try again'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final data = _data!;

    final uniqueClassIds = data.assignments.map((a) => a.classId).toSet().toList()
      ..sort((a, b) {
        final na = data.classNames[a] ?? a;
        final nb = data.classNames[b] ?? b;
        return na.toLowerCase().compareTo(nb.toLowerCase());
      });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Adakaro'),
        bottom: _refreshing
            ? const PreferredSize(
                preferredSize: Size.fromHeight(3),
                child: LinearProgressIndicator(minHeight: 3),
              )
            : null,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refreshing ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'out') _signOut();
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'out', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Material(
                  color: Theme.of(context).colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber_rounded,
                            color: Theme.of(context).colorScheme.onErrorContainer),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onErrorContainer,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: _load,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: AppColors.primary.withOpacity(0.15),
                      foregroundColor: AppColors.primary,
                      child: Icon(Icons.person_rounded, size: 30, color: AppColors.primary),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Teacher',
                            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                          ),
                          Text(
                            (data.teacherName?.trim().isNotEmpty == true)
                                ? data.teacherName!.trim()
                                : 'Welcome',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Read-only overview. Full tools stay on the Adakaro website.',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.textSecondary,
                                  height: 1.35,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Subjects (school catalog)',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            if (data.catalogSubjects.isEmpty)
              Text(
                'No catalog subjects linked to your profile yet. Subjects still appear under class assignments when set.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: data.catalogSubjects
                    .map(
                      (s) => Chip(
                        label: Text(s.name),
                        backgroundColor: AppColors.primary.withOpacity(0.08),
                        side: BorderSide(color: AppColors.primary.withOpacity(0.25)),
                      ),
                    )
                    .toList(),
              ),
            const SizedBox(height: 16),
            Text(
              'Subjects from assignments',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
            ),
            const SizedBox(height: 8),
            Builder(
              builder: (context) {
                final seen = <String>{};
                final labels = <String>[];
                for (final a in data.assignments) {
                  final k = a.subjectLabel.toLowerCase();
                  if (seen.add(k)) labels.add(a.subjectLabel);
                }
                labels.sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
                if (labels.isEmpty) {
                  return Text(
                    'None yet — add assignments at your school.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  );
                }
                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: labels
                      .map(
                        (name) => Chip(
                          label: Text(name),
                          visualDensity: VisualDensity.compact,
                        ),
                      )
                      .toList(),
                );
              },
            ),
            const SizedBox(height: 24),
            Text(
              'Class assignments',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            if (data.assignments.isEmpty)
              EmptyState(
                icon: Icons.assignment_outlined,
                title: 'No assignments yet',
                message:
                    'When your school assigns you to classes and subjects, they will show here. Use the website if you need help getting set up.',
              )
            else
              ...data.assignments.map(
                (a) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            a.className,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            a.subjectLabel,
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          if (a.academicYear.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                'Year: ${a.academicYear}',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Text(
              'Students by class',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Students appear when you are assigned to their class and school rules allow.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.35,
                  ),
            ),
            const SizedBox(height: 12),
            if (uniqueClassIds.isEmpty)
              const SizedBox.shrink()
            else
              ...uniqueClassIds.map((classId) {
                final name = data.classNames[classId] ?? 'Class';
                final students = data.studentsByClassId[classId] ?? [];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    clipBehavior: Clip.antiAlias,
                    child: ExpansionTile(
                      tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      childrenPadding: const EdgeInsets.only(bottom: 8),
                      title: Text(
                        name,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        '${students.length} student${students.length == 1 ? '' : 's'}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                      children: [
                        if (students.isEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                            child: Text(
                              'No students listed for this class, or they are not visible with your current permissions.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.textSecondary,
                                    height: 1.4,
                                  ),
                            ),
                          )
                        else
                          ...students.map(
                            (s) => ListTile(
                              dense: true,
                              title: Text(
                                s.fullName,
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                [
                                  if (s.admissionNumber?.trim().isNotEmpty == true)
                                    'Adm: ${s.admissionNumber}',
                                  if (s.status?.trim().isNotEmpty == true)
                                    s.status!.trim(),
                                ].join(' · '),
                                style: Theme.of(context).textTheme.labelSmall,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

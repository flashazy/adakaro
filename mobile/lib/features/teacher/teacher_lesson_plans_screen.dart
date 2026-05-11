import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';

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

  Future<void> _showNewPlan() async {
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

    final assignIx = ValueNotifier<int>(0);
    final periodCtrl = TextEditingController(text: '1st period');
    final durationCtrl = TextEditingController(text: '40');
    final date = ValueNotifier<DateTime>(DateTime.now());

    try {
      await showDialog<void>(
        context: context,
        builder: (ctx) {
          return AlertDialog(
            title: const Text('New lesson plan'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ValueListenableBuilder<int>(
                    valueListenable: assignIx,
                    builder: (context, ix, _) {
                      return DropdownButtonFormField<int>(
                        value: ix,
                        decoration: const InputDecoration(
                          labelText: 'Class & subject',
                          border: OutlineInputBorder(),
                        ),
                        items: [
                          for (var i = 0; i < assigns.length; i++)
                            DropdownMenuItem(
                              value: i,
                              child: Text(
                                '${assigns[i].className} · ${assigns[i].subjectLabel}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (v) =>
                            assignIx.value = v ?? 0,
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  ValueListenableBuilder<DateTime>(
                    valueListenable: date,
                    builder: (_, d, __) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title:
                          Text('Lesson date · ${d.year}-${d.month}-${d.day}'),
                      trailing: const Icon(Icons.event_rounded),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: date.value,
                          firstDate: DateTime(2020),
                          lastDate:
                              DateTime.now().add(const Duration(days: 730)),
                        );
                        if (picked != null) date.value = picked;
                      },
                    ),
                  ),
                  TextField(
                    controller: periodCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Period',
                      border: OutlineInputBorder(),
                      hintText: 'e.g. 1st period',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: durationCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Duration (minutes)',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () async {
                  final a = assigns[assignIx.value];
                  final dur = int.tryParse(durationCtrl.text.trim()) ?? 0;
                  if (dur < 1 || periodCtrl.text.trim().isEmpty) return;

                  try {
                    await _repo.insertLessonPlan(
                      teacherId: widget.user.id,
                      payload: {
                        'class_id': a.classId,
                        'subject_id': a.subjectId,
                        'lesson_date':
                            '${date.value.year}-${date.value.month.toString().padLeft(2, '0')}-${date.value.day.toString().padLeft(2, '0')}',
                        'period': periodCtrl.text.trim(),
                        'duration_minutes': dur,
                        'total_boys': 0,
                        'total_girls': 0,
                        'total_pupils': 0,
                        'present_count': 0,
                        'main_competence': '',
                        'specific_competence': '',
                        'main_activities': '',
                        'specific_activities': '',
                        'teaching_resources': '',
                        'references': '',
                        'remarks': '',
                        'teaching_learning_process': <String, dynamic>{},
                      },
                    );
                    if (ctx.mounted) Navigator.pop(ctx);
                    await _load();
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(content: Text(friendlyDataLoadError(e))),
                      );
                    }
                  }
                },
                child: const Text('Save'),
              ),
            ],
          );
        },
      );
    } finally {
      assignIx.dispose();
      periodCtrl.dispose();
      durationCtrl.dispose();
      date.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _error!,
                        style:
                            TextStyle(color: Theme.of(context).colorScheme.error),
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
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.4,
                            ),
                      ),
                    ),
                  ..._plans.map((p) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Card(
                        child: ListTile(
                          title: Text(
                            p.subjectName,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            '${p.className} · ${p.lessonDate}\nPeriod ${p.period} · ${p.durationMinutes} min',
                          ),
                          isThreeLine: true,
                          trailing: Text(
                            p.lessonDate,
                            style: Theme.of(context).textTheme.labelSmall,
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
              onPressed: _showNewPlan,
              child: const Icon(Icons.add_rounded),
            )
          : null,
    );
  }
}

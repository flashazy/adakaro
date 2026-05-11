import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/gradebook/gradebook_full_report_compute.dart';
import '../../core/gradebook/tanzania_grades.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_enrollment.dart';
import '../../data/teacher_repository.dart';

/// Mirrors web **Evaluate Subject** (FullGradeReport): statistics and ranking from
/// saved gradebook scores — no separate persistence beyond existing `teacher_scores`.
class TeacherEvaluateSubjectScreen extends StatefulWidget {
  const TeacherEvaluateSubjectScreen({
    super.key,
    required this.user,
    required this.data,
  });

  final User user;
  final TeacherDeskData data;

  @override
  State<TeacherEvaluateSubjectScreen> createState() =>
      _TeacherEvaluateSubjectScreenState();
}

class _TeacherEvaluateSubjectScreenState
    extends State<TeacherEvaluateSubjectScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);

  late String _term;
  int _pairIx = 0;
  TeacherGradebookMatrixSnapshot? _matrix;
  TeacherEvaluateReportMeta? _meta;
  bool _loading = false;
  String? _error;

  String get _schoolLevel => widget.data.schoolLevel ?? 'secondary';

  TeacherAssignmentDisplay? get _pair {
    final a = widget.data.assignments;
    if (a.isEmpty || _pairIx < 0 || _pairIx >= a.length) return null;
    return a[_pairIx];
  }

  @override
  void initState() {
    super.initState();
    _term = teacherCurrentEnrollmentPeriod().term;
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  ClassDraft _draftFromMatrix(TeacherGradebookMatrixSnapshot snap) {
    final d = <String, Map<String, DraftCell>>{};
    for (final a in snap.assignments) {
      d[a.id] = {};
      for (final s in snap.students) {
        final cell = snap.scoreMatrix[a.id]?[s.id];
        final scoreStr = cell?.score == null
            ? ''
            : _stripScore(cell!.score!);
        final rem = cell?.remarks?.trim() ?? '';
        d[a.id]![s.id] = DraftCell(score: scoreStr, remarks: rem);
      }
    }
    return d;
  }

  String _stripScore(double v) {
    if (v == v.roundToDouble()) return '${v.round()}';
    return v.toString();
  }

  int _countScoredCells(TeacherGradebookMatrixSnapshot snap) {
    var n = 0;
    for (final a in snap.assignments) {
      for (final s in snap.students) {
        final sc = snap.scoreMatrix[a.id]?[s.id]?.score;
        if (sc != null) n++;
      }
    }
    return n;
  }

  Future<void> _reload() async {
    final p = _pair;
    if (p == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final matrix = await _repo.loadGradebookClassMatrix(
        teacherId: widget.user.id,
        classId: p.classId,
        subjectLabel: p.subjectLabel,
        term: _term,
        subjectId: p.subjectId,
      );
      final meta = await _repo.loadEvaluateReportMeta(
        teacherId: widget.user.id,
        classId: p.classId,
        subjectLabel: p.subjectLabel,
      );
      if (!mounted) return;
      setState(() {
        _matrix = matrix;
        _meta = meta;
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

  Future<void> _promptNewAssignment() async {
    final p = _pair;
    if (p == null) return;
    final titleCtrl = TextEditingController();
    final maxCtrl = TextEditingController(text: '100');
    final weightCtrl = TextEditingController(text: '100');
    final dueCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New assignment'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: maxCtrl,
                decoration: const InputDecoration(
                  labelText: 'Max score',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: weightCtrl,
                decoration: const InputDecoration(
                  labelText: 'Weight (%)',
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dueCtrl,
                decoration: const InputDecoration(
                  labelText: 'Due date (optional, YYYY-MM-DD)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Create'),
          ),
        ],
      ),
    );

    final title = titleCtrl.text.trim();
    final mxRaw = maxCtrl.text.trim();
    final wRaw = weightCtrl.text.trim();
    final due = dueCtrl.text.trim();
    titleCtrl.dispose();
    maxCtrl.dispose();
    weightCtrl.dispose();
    dueCtrl.dispose();

    if (ok != true || title.isEmpty) return;
    final mx = double.tryParse(mxRaw.replaceAll(',', '.')) ?? 100;
    final weight = double.tryParse(wRaw.replaceAll(',', '.')) ?? 100;

    try {
      await _repo.createGradebookAssignment(
        teacherId: widget.user.id,
        classId: p.classId,
        subject: p.subjectLabel,
        title: title,
        maxScore: mx,
        weight: weight,
        dueDate: due.isEmpty ? null : due,
        term: _term,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Assignment created.')),
        );
        await _reload();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(friendlyDataLoadError(e))),
        );
      }
    }
  }

  void _openEvaluationSheet() {
    final snap = _matrix;
    final meta = _meta;
    if (snap == null || meta == null) return;
    if (snap.assignments.isEmpty || snap.students.isEmpty) return;

    final draft = _draftFromMatrix(snap);
    final metaLines = TeacherEvaluateReportMetaLines(
      schoolName: meta.schoolName,
      className: meta.className,
      subject: meta.subject,
      teacherName: meta.teacherName,
      termLabel: meta.termLabel,
    );

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return _EvaluationSheetBody(
          schoolLevel: _schoolLevel,
          metaLines: metaLines,
          snapshot: snap,
          draft: draft,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.data.hasTeachingAssignments ||
        widget.data.assignments.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Evaluate subject')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Evaluation is available when your school assigns you to classes.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
          ),
        ),
      );
    }

    final pairs = widget.data.assignments;
    final snap = _matrix;
    final scored = snap == null ? 0 : _countScoredCells(snap);
    final canEvaluate = snap != null &&
        snap.assignments.isNotEmpty &&
        snap.students.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Evaluate subject'),
        actions: [
          IconButton(
            tooltip: 'New assignment',
            onPressed: _pair == null ? null : _promptNewAssignment,
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            TeacherUiTokens.horizontalPadding,
            16,
            TeacherUiTokens.horizontalPadding,
            120,
          ),
          children: [
            Text(
              'Review performance using the same statistics as the Adakaro web '
              'marks page. Enter scores on the Enter scores tab first; this screen '
              'analyses saved marks only.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _term,
              decoration: const InputDecoration(
                labelText: 'Term',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'Term 1', child: Text('Term 1')),
                DropdownMenuItem(value: 'Term 2', child: Text('Term 2')),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _term = v);
                _reload();
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int>(
              value: _pairIx.clamp(0, pairs.length - 1),
              decoration: const InputDecoration(
                labelText: 'Class & subject',
                border: OutlineInputBorder(),
              ),
              items: [
                for (var i = 0; i < pairs.length; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text(
                      '${pairs[i].className} · ${pairs[i].subjectLabel}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _pairIx = v);
                _reload();
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (snap != null) ...[
              const SizedBox(height: 20),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Summary',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${snap.assignments.length} assignment${snap.assignments.length == 1 ? '' : 's'} · '
                        '${snap.students.length} student${snap.students.length == 1 ? '' : 's'} · '
                        '$scored score${scored == 1 ? '' : 's'} entered',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      if (snap.assignments.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            'No assignments for this class, subject, and term yet. '
                            'Create one with + or enter scores from the Marks tab.',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: !canEvaluate ? null : _openEvaluationSheet,
                icon: const Icon(Icons.analytics_outlined),
                label: const Text('View evaluation'),
              ),
              if (!canEvaluate)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Add assignments and students with marks to run evaluation.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EvaluationSheetBody extends StatefulWidget {
  const _EvaluationSheetBody({
    required this.schoolLevel,
    required this.metaLines,
    required this.snapshot,
    required this.draft,
  });

  final String schoolLevel;
  final TeacherEvaluateReportMetaLines metaLines;
  final TeacherGradebookMatrixSnapshot snapshot;
  final ClassDraft draft;

  @override
  State<_EvaluationSheetBody> createState() => _EvaluationSheetBodyState();
}

class _EvaluationSheetBodyState extends State<_EvaluationSheetBody> {
  late String _assignmentId;

  @override
  void initState() {
    super.initState();
    _assignmentId = widget.snapshot.assignments.first.id;
  }

  @override
  Widget build(BuildContext context) {
    final assigns = widget.snapshot.assignments;
    final sel = assigns.firstWhere((a) => a.id == _assignmentId);
    final students = widget.snapshot.students
        .map((s) => (id: s.id, gender: s.gender))
        .toList();
    final studentsRank = widget.snapshot.students
        .map((s) => (id: s.id, fullName: s.fullName))
        .toList();
    final studentsFull = widget.snapshot.students
        .map(
          (s) => (id: s.id, fullName: s.fullName, gender: s.gender),
        )
        .toList();

    final stats = computeReportStatsForAssignment(
      students,
      (id: sel.id, maxScore: sel.maxScore),
      widget.draft,
      widget.schoolLevel,
    );
    final ranking = buildStudentRanking(
      studentsRank,
      (id: sel.id, maxScore: sel.maxScore),
      widget.draft,
      widget.schoolLevel,
    );

    final reportText = buildPlainTextReport(
      meta: widget.metaLines,
      assignment: (id: sel.id, title: sel.title, maxScore: sel.maxScore),
      students: studentsFull,
      stats: stats,
      ranking: ranking,
      draft: widget.draft,
      schoolLevel: widget.schoolLevel,
    );

    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.92,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      builder: (ctx, scrollCtrl) {
        return ListView(
          controller: scrollCtrl,
          padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + bottomInset),
          children: [
            Text(
              'Subject evaluation',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '${widget.metaLines.schoolName} · ${widget.metaLines.className} · ${widget.metaLines.subject}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _assignmentId,
              decoration: const InputDecoration(
                labelText: 'Assignment',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final a in assigns)
                  DropdownMenuItem(
                    value: a.id,
                    child: Text(
                      '${a.title} (max ${a.maxScore})',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _assignmentId = v);
              },
            ),
            const SizedBox(height: 16),
            Text(
              'Passing (${passingThresholdPercent(widget.schoolLevel)}%+)',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            Text(stats.passing.passRateLine),
            Text(stats.passing.boysLine),
            Text(stats.passing.girlsLine),
            const SizedBox(height: 12),
            Text(
              'Failing',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            Text(stats.failing.failRateLine),
            const SizedBox(height: 12),
            Text(
              'Grades: A ${stats.dist.a} · B ${stats.dist.b} · C ${stats.dist.c} · D ${stats.dist.d} · '
              '${widget.schoolLevel == 'primary' ? 'E' : 'F'} '
              '${widget.schoolLevel == 'primary' ? stats.dist.e : stats.dist.f}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            Text(
              'Ranking',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            if (ranking.isEmpty)
              Text(
                'No scores for this assignment.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              )
            else
              ...ranking.take(25).map(
                    (r) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        radius: 16,
                        child: Text('${r.rank}'),
                      ),
                      title: Text(r.name),
                      subtitle: Text('${r.scorePct} · ${r.grade} ${r.badge}'),
                    ),
                  ),
            if (ranking.length > 25)
              Text(
                '+ ${ranking.length - 25} more…',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
              ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: reportText));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Report copied to clipboard.')),
                  );
                }
              },
              icon: const Icon(Icons.copy_rounded),
              label: const Text('Copy report text'),
            ),
            const SizedBox(height: 8),
            Text(
              'This matches the web “Evaluate Subject” analysis. It does not write '
              'report cards; save marks under Enter scores first.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
          ],
        );
      },
    );
  }
}

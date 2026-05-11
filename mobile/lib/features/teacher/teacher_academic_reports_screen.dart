import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/teacher_ui_tokens.dart';
import '../../data/models/teacher_models.dart';
import '../../data/teacher_repository.dart';

/// Read-only list when the signed-in user passes RLS (e.g. academic department).
class TeacherAcademicReportsScreen extends StatefulWidget {
  const TeacherAcademicReportsScreen({
    super.key,
    required this.schoolId,
  });

  final String schoolId;

  @override
  State<TeacherAcademicReportsScreen> createState() =>
      _TeacherAcademicReportsScreenState();
}

class _TeacherAcademicReportsScreenState
    extends State<TeacherAcademicReportsScreen> {
  final _repo = TeacherRepository(Supabase.instance.client);
  List<Map<String, dynamic>> _rows = [];
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
      final list =
          await _repo.loadAcademicReportsForSchool(widget.schoolId);
      if (!mounted) return;
      setState(() {
        _rows = list;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Academic reports')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _loading
            ? ListView(
                children: [
                  SizedBox(height: MediaQuery.sizeOf(context).height * 0.28),
                  const Center(child: CircularProgressIndicator()),
                ],
              )
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(TeacherUiTokens.horizontalPadding),
                children: [
                  if (_error != null)
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  if (_rows.isEmpty && _error == null)
                    Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: Text(
                        'No reports here, or your role does not include access. '
                        'Coordinators and admins can generate these on the web.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.45,
                            ),
                      ),
                    ),
                  for (final r in _rows)
                    Card(
                      child: ListTile(
                        title: Text(
                          '${r['classes'] is Map ? (r['classes'] as Map)['name'] : 'Class'}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '${r['academic_year']} · ${r['term']}\nGenerated ${r['generated_at']}',
                        ),
                        isThreeLine: true,
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

void openAcademicReportsOncePlausible(
  BuildContext context, {
  required TeacherDeskData data,
}) {
  final sid = data.resolvedSchoolIdForAcademicReports;
  if (sid == null || sid.trim().isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'No school context for reports. Ask your administrator if this persists.',
        ),
      ),
    );
    return;
  }

  Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => TeacherAcademicReportsScreen(schoolId: sid),
    ),
  );
}

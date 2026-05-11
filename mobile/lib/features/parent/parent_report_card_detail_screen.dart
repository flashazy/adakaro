import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/currency_format.dart';
import '../../core/report_card_academic.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/fee_balance_row.dart';
import '../../data/models/report_card_comment_row.dart';
import '../../data/models/class_report_settings_row.dart';
import '../../data/models/report_card_detail_extras.dart';
import '../../data/models/report_card_summary.dart';
import '../../data/models/student_summary.dart';
import '../../data/parent_data_repository.dart';

Color _statusBannerFill(String status) {
  switch (status) {
    case 'approved':
      return AppColors.successBg;
    case 'pending_review':
    case 'changes_requested':
      return AppColors.warningBg;
    default:
      return AppColors.indigoWash;
  }
}

Color _statusBannerBorder(String status) {
  switch (status) {
    case 'approved':
      return AppColors.successBorder;
    case 'pending_review':
    case 'changes_requested':
      return AppColors.warningBorder;
    default:
      return AppColors.cardBorder;
  }
}

Color _statusBannerText(String status) {
  switch (status) {
    case 'approved':
      return AppColors.success;
    case 'pending_review':
    case 'changes_requested':
      return AppColors.warning;
    default:
      return AppColors.primaryDark;
  }
}

/// Full official report card for parents (scrollable, matches web content where RLS allows).
class ParentReportCardDetailScreen extends StatefulWidget {
  const ParentReportCardDetailScreen({
    super.key,
    required this.card,
    required this.lines,
    required this.student,
    required this.balances,
  });

  final ReportCardSummary card;
  final List<ReportCardCommentRow> lines;
  final StudentSummary student;
  final List<FeeBalanceRow> balances;

  @override
  State<ParentReportCardDetailScreen> createState() =>
      _ParentReportCardDetailScreenState();
}

class _ParentReportCardDetailScreenState
    extends State<ParentReportCardDetailScreen> {
  ReportCardDetailExtras? _extras;
  bool _loadingExtras = true;
  bool _extrasFailed = false;

  @override
  void initState() {
    super.initState();
    _loadExtras();
  }

  Future<void> _loadExtras() async {
    setState(() {
      _loadingExtras = true;
      _extrasFailed = false;
    });
    try {
      final repo = ParentDataRepository(Supabase.instance.client);
      final data = await repo.loadReportCardDetailExtras(
        studentId: widget.student.id,
        classId: widget.card.classId,
        term: widget.card.term,
        academicYear: widget.card.academicYear,
      );
      if (!mounted) return;
      setState(() {
        _extras = data;
        _loadingExtras = false;
        _extrasFailed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingExtras = false;
        _extrasFailed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final student = widget.student;
    final schoolLevel = normalizeSchoolLevel(card.schoolLevel);
    final rollup = computeMobileReportRollup(
      lines: widget.lines,
      schoolLevel: schoolLevel,
    );
    final feeStatement = feeStatementForBalances(
      widget.balances,
      student.id,
      card.term,
      card.academicYear,
      student.currencyCode,
    );

    final studentDisplay = card.studentNameFromSchool?.trim().isNotEmpty == true
        ? card.studentNameFromSchool!.trim()
        : student.fullName;
    final classDisplay = card.className?.trim().isNotEmpty == true
        ? card.className!.trim()
        : (student.className?.trim().isNotEmpty == true
            ? student.className!.trim()
            : '—');
    final schoolDisplay = card.schoolName?.trim().isNotEmpty == true
        ? card.schoolName!.trim()
        : (student.schoolName?.trim().isNotEmpty == true
            ? student.schoolName!.trim()
            : 'School');

    final issuedSource =
        card.submittedAt ?? card.approvedAt ?? card.updatedAt ?? card.createdAt;
    final dateIssued = _formatLongDate(issuedSource);

    final teacherName = card.teacherNameFromProfile?.trim().isNotEmpty == true
        ? card.teacherNameFromProfile!.trim()
        : '—';

    final sortedLines = [...widget.lines]..sort(
        (a, b) => a.subject.toLowerCase().compareTo(b.subject.toLowerCase()));

    final summaryText = buildMobileReportSummaryParagraph(
      studentName: studentDisplay,
      term: card.term,
      academicYear: card.academicYear,
      schoolLevel: schoolLevel,
      rollup: rollup,
    );

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Report card'),
        surfaceTintColor: Colors.transparent,
      ),
      body: RefreshIndicator(
        onRefresh: _loadExtras,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(
            ParentUiTokens.horizontalPadding,
            12,
            ParentUiTokens.horizontalPadding,
            32,
          ),
          children: [
            if (_extrasFailed)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Material(
                  color: AppColors.warningBg,
                  borderRadius: BorderRadius.circular(ParentUiTokens.radiusMd),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(Icons.cloud_off_outlined,
                            color: AppColors.warning),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Could not load calendar and attendance notes. Pull to refresh or tap Retry.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        TextButton(
                          onPressed: _loadExtras,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            _OfficialHeader(
              schoolName: schoolDisplay,
              logoUrl: card.logoUrl,
              motto: card.schoolMotto,
              rawStatus: card.status,
              statusLabel: bannerLabelForReportStatus(card.status),
            ),
            const SizedBox(height: 16),
            _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _InfoRow(label: 'Student', value: studentDisplay),
                  _InfoRow(label: 'Class', value: classDisplay),
                  _InfoRow(label: 'Term', value: card.term),
                  _InfoRow(label: 'Academic year', value: card.academicYear),
                  _InfoRow(
                    label: 'Class teacher / coordinator',
                    value: teacherName,
                  ),
                  _InfoRow(label: 'Date issued', value: dateIssued),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_loadingExtras)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            else if (_extras != null) ...[
              _SectionCard(
                title: 'Attendance (this term)',
                child: Text(
                  attendanceSummaryLine(
                    _extras!.attendancePresent,
                    _extras!.attendanceAbsent,
                    _extras!.attendanceLate,
                  ),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        height: 1.45,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            _SectionTitle('Subject results'),
            const SizedBox(height: 8),
            ...sortedLines.map(
              (line) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _SubjectResultCard(
                  line: line,
                  term: card.term,
                  schoolLevel: schoolLevel,
                  rollup: rollup,
                ),
              ),
            ),
            const SizedBox(height: 8),
            _SectionCard(
              title: 'Grading guide',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    gradingScaleDescription(schoolLevel),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          height: 1.5,
                          color: AppColors.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '* Exam score adjusted from gradebook.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontStyle: FontStyle.italic,
                        ),
                  ),
                ],
              ),
            ),
            if (_extras?.settings != null) ...[
              const SizedBox(height: 12),
              _buildCalendarCard(context, _extras!.settings!),
            ],
            if (feeStatement != null) ...[
              const SizedBox(height: 12),
              _SectionCard(
                title: 'Fee statement (report period)',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _InfoRow(
                      label: 'Total fees',
                      value: formatCurrency(
                        feeStatement.totalFees,
                        feeStatement.currencyCode,
                      ),
                    ),
                    _InfoRow(
                      label: 'Amount paid',
                      value: formatCurrency(
                        feeStatement.amountPaid,
                        feeStatement.currencyCode,
                      ),
                    ),
                    _InfoRow(
                      label: 'Balance due',
                      value: formatCurrency(
                        feeStatement.balanceDue,
                        feeStatement.currencyCode,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_extras?.settings?.coordinatorMessage?.trim().isNotEmpty ==
                true) ...[
              const SizedBox(height: 12),
              _SectionCard(
                title: 'Coordinator message',
                child: Text(
                  _extras!.settings!.coordinatorMessage!.trim(),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        height: 1.5,
                      ),
                ),
              ),
            ],
            if (_extras?.settings?.requiredItems?.isNotEmpty == true) ...[
              const SizedBox(height: 12),
              _SectionCard(
                title: 'Items for next term',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var i = 0;
                        i < _extras!.settings!.requiredItems!.length;
                        i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${i + 1}.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _extras!.settings!.requiredItems![i],
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            _SectionCard(
              title: 'Summary',
              child: Text(
                summaryText,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      height: 1.55,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            if (card.adminNote?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 12),
              _SectionCard(
                title: 'School note',
                child: Text(
                  card.adminNote!.trim(),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        height: 1.5,
                      ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            _SignaturesFooter(
              headSignatureUrl: card.headTeacherSignatureUrl,
              stampUrl: card.schoolStampUrl,
            ),
            const SizedBox(height: 12),
            Text(
              'Generated via Adakaro Mobile App.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCalendarCard(
      BuildContext context, ClassReportSettingsRow settings) {
    String closeLabel() {
      final d = settings.closingDate;
      if (d == null || d.trim().isEmpty) return 'TBA';
      return _tryFormatUkDate(d) ?? 'TBA';
    }

    String openLabel() {
      final d = settings.openingDate;
      if (d == null || d.trim().isEmpty) return 'TBA';
      return _tryFormatUkDate(d) ?? 'TBA';
    }

    return _SectionCard(
      title: 'School calendar',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _InfoRow(
            label: 'Term closing',
            value: closeLabel(),
          ),
          _InfoRow(
            label: 'Next term opening',
            value: openLabel(),
          ),
        ],
      ),
    );
  }

  String? _tryFormatUkDate(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      return DateFormat.yMMMMd('en_GB').format(d);
    } catch (_) {
      return iso.split('T').first;
    }
  }

  String _formatLongDate(String? iso) {
    if (iso == null || iso.trim().isEmpty) return '—';
    try {
      final d = DateTime.parse(iso).toLocal();
      return DateFormat.yMMMMd('en_GB').format(d);
    } catch (_) {
      return iso.split('T').first;
    }
  }
}

class _OfficialHeader extends StatelessWidget {
  const _OfficialHeader({
    required this.schoolName,
    required this.logoUrl,
    required this.motto,
    required this.rawStatus,
    required this.statusLabel,
  });

  final String schoolName;
  final String? logoUrl;
  final String? motto;
  final String rawStatus;
  final String statusLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: ParentUiTokens.softCard(),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cardBorder),
                  color: Colors.white,
                ),
                clipBehavior: Clip.antiAlias,
                child: (logoUrl != null && logoUrl!.isNotEmpty)
                    ? _SafeNetworkImage(uri: logoUrl!, fit: BoxFit.contain)
                    : Icon(Icons.school_rounded,
                        color: AppColors.textSecondary.withValues(alpha: 0.5),
                        size: 36),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      schoolName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Student report card',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    if (motto != null && motto!.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        motto!.trim(),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                              fontStyle: FontStyle.italic,
                              height: 1.35,
                            ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: _statusBannerFill(rawStatus),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _statusBannerBorder(rawStatus)
                              .withValues(alpha: 0.55),
                        ),
                      ),
                      child: Text(
                        statusLabel,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: _statusBannerText(rawStatus),
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            fontWeight: FontWeight.w900,
            letterSpacing: 1.2,
            color: AppColors.textSecondary,
          ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.child,
    this.title,
  });

  final Widget child;
  final String? title;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: ParentUiTokens.softCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null) ...[
            Text(
              title!,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 10),
          ],
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    height: 1.35,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubjectResultCard extends StatelessWidget {
  const _SubjectResultCard({
    required this.line,
    required this.term,
    required this.schoolLevel,
    required this.rollup,
  });

  final ReportCardCommentRow line;
  final String term;
  final String schoolLevel;
  final MobileReportRollup? rollup;

  @override
  Widget build(BuildContext context) {
    final labels = examLabelsForTerm(term);
    final e1 = _parse(line.exam1Score);
    final e2 = _parse(line.exam2Score);
    final avg = termAverageFromComment(line);
    final grade = displayGradeForSubject(line, schoolLevel);
    final pos = displaySubjectPosition(line);
    final o1 = line.exam1ScoreOverridden == true;
    final o2 = line.exam2ScoreOverridden == true;

    final rRoll = rollup;
    final countsToward = rRoll != null &&
        rRoll.droppedSubjects &&
        rRoll.contributingSubjects.any(
          (s) => s.toLowerCase() == line.subject.trim().toLowerCase(),
        );

    return Container(
      decoration: ParentUiTokens.softCard(),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          title: Text(
            line.subject,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                _MiniChip('Avg ${formatPercentOrDash(avg)}'),
                _MiniChip('Grade $grade'),
                _MiniChip('Position $pos'),
                if (countsToward)
                  _MiniChip('Counts toward total', highlight: true),
              ],
            ),
          ),
          children: [
            _ScoreLine('${labels.exam1} (%)', formatPercentOrDash(e1), o1),
            _ScoreLine('${labels.exam2} (%)', formatPercentOrDash(e2), o2),
            if (line.comment?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 10),
              Text(
                'Teacher comment',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textSecondary,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                line.comment!.trim(),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      height: 1.45,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  double? _parse(double? v) => v;
}

class _ScoreLine extends StatelessWidget {
  const _ScoreLine(this.label, this.value, this.overridden);

  final String label;
  final String value;
  final bool overridden;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          Text(
            '$value${overridden ? ' *' : ''}',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}

class _MiniChip extends StatelessWidget {
  const _MiniChip(this.text, {this.highlight = false});

  final String text;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: highlight ? AppColors.successBg : AppColors.indigoWash,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: highlight
              ? AppColors.successBorder.withValues(alpha: 0.7)
              : AppColors.primary.withValues(alpha: 0.12),
        ),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: highlight ? AppColors.success : AppColors.primaryDark,
            ),
      ),
    );
  }
}

class _SignaturesFooter extends StatelessWidget {
  const _SignaturesFooter({
    required this.headSignatureUrl,
    required this.stampUrl,
  });

  final String? headSignatureUrl;
  final String? stampUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: ParentUiTokens.softCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Signatures & official stamp',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            'Head teacher signature (when provided by the school)',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 56,
            child: Align(
              alignment: Alignment.centerLeft,
              child: (headSignatureUrl != null &&
                      headSignatureUrl!.trim().isNotEmpty)
                  ? SizedBox(
                      height: 56,
                      width: 160,
                      child: _SafeNetworkImage(
                        uri: headSignatureUrl!.trim(),
                        fit: BoxFit.contain,
                      ),
                    )
                  : Text(
                      '—',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  'Official school stamp',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
              ),
              if (stampUrl != null && stampUrl!.trim().isNotEmpty)
                SizedBox(
                  width: 72,
                  height: 72,
                  child: _SafeNetworkImage(
                    uri: stampUrl!.trim(),
                    fit: BoxFit.contain,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SafeNetworkImage extends StatelessWidget {
  const _SafeNetworkImage({
    required this.uri,
    required this.fit,
  });

  final String uri;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final u = Uri.tryParse(uri);
    if (u == null || !u.hasScheme) return const SizedBox.shrink();
    return Image.network(
      uri,
      fit: fit,
      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
    );
  }
}

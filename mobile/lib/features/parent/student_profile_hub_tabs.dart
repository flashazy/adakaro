import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/currency_format.dart';
import '../../core/report_card_academic.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/attendance_record.dart';
import '../../data/models/fee_balance_row.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/report_card_comment_row.dart';
import '../../data/models/report_card_summary.dart';
import '../../data/models/student_profile_extra_data.dart';
import '../../data/models/student_summary.dart';
import '../../data/parent_data_repository.dart';
import '../../widgets/empty_state.dart';
import 'parent_publish_filter.dart';
import 'parent_report_card_detail_screen.dart';
import 'receipt_detail_screen.dart';

String _paymentMethodLabel(String? raw) {
  if (raw == null || raw.isEmpty) return 'Payment';
  return raw.replaceAll('_', ' ');
}

String _statusLabel(String s) {
  switch (s.toLowerCase()) {
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'late':
      return 'Late';
    default:
      return s;
  }
}

IconData _statusIcon(String s) {
  switch (s.toLowerCase()) {
    case 'present':
      return Icons.check_circle_rounded;
    case 'absent':
      return Icons.cancel_rounded;
    case 'late':
      return Icons.schedule_rounded;
    default:
      return Icons.help_outline_rounded;
  }
}

Color _statusColor(String s) {
  switch (s.toLowerCase()) {
    case 'present':
      return AppColors.success;
    case 'absent':
      return Colors.red.shade700;
    case 'late':
      return AppColors.warning;
    default:
      return AppColors.textSecondary;
  }
}

class ProfileAttendanceTab extends StatelessWidget {
  const ProfileAttendanceTab({
    super.key,
    required this.records,
    this.loading = false,
  });

  final List<AttendanceRecord> records;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    if (loading && records.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (records.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          EmptyState(
            icon: Icons.event_busy_rounded,
            title: 'No attendance yet',
            message:
                'When teachers record attendance for your child, you will see each day here.',
          ),
        ],
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
        ParentUiTokens.horizontalPadding,
        12,
        ParentUiTokens.horizontalPadding,
        24,
      ),
      itemCount: records.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final r = records[i];
        final date = r.attendanceDate.split('T').first;
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: ParentUiTokens.softCard(),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _statusColor(r.status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  _statusIcon(r.status),
                  color: _statusColor(r.status),
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      date,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _statusLabel(r.status),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: _statusColor(r.status),
                          ),
                    ),
                    if (r.subjectId != null && r.subjectId!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Subject record',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                        ),
                      ),
                    if (r.createdAt.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Recorded ${r.createdAt.split('T').first}',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class ProfileSubjectResultsTab extends StatelessWidget {
  const ProfileSubjectResultsTab({
    super.key,
    required this.reportCards,
    required this.comments,
    this.loading = false,
  });

  final List<ReportCardSummary> reportCards;
  final List<ReportCardCommentRow> comments;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final visible =
        commentsForParentSubjectResults(reportCards, comments);
    if (loading && visible.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (visible.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          EmptyState(
            icon: Icons.school_outlined,
            title: 'No subject results yet',
            message:
                'No results available for this student yet.\n\n'
                'Published subject lines from approved report cards will appear here.',
          ),
        ],
      );
    }

    final byTerm = <String, List<ReportCardCommentRow>>{};
    for (final c in visible) {
      final k = '${c.academicYear} · ${c.term}';
      byTerm.putIfAbsent(k, () => []).add(c);
    }
    final keys = byTerm.keys.toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        ParentUiTokens.horizontalPadding,
        12,
        ParentUiTokens.horizontalPadding,
        24,
      ),
      children: [
        for (final k in keys) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 4),
            child: Text(
              k,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryDark,
                  ),
            ),
          ),
          Builder(
            builder: (context) {
              final first = byTerm[k]!.first;
              final labels = examLabelsForTerm(first.term);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  '${labels.exam1} and ${labels.exam2}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                ),
              );
            },
          ),
          ...byTerm[k]!.map((c) {
            final labels = examLabelsForTerm(c.term);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: ParentUiTokens.softCard(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.subject,
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (c.exam1Score != null)
                          _ResultChip(
                            label: labels.exam1,
                            value: c.exam1Score!.toStringAsFixed(0),
                          ),
                        if (c.exam2Score != null)
                          _ResultChip(
                            label: labels.exam2,
                            value: c.exam2Score!.toStringAsFixed(0),
                          ),
                        if (c.calculatedScore != null)
                          _ResultChip(
                            label: 'Average',
                            value: c.calculatedScore!.toStringAsFixed(1),
                          ),
                        if (c.scorePercent != null)
                          _ResultChip(
                            label: '%',
                            value: '${c.scorePercent!.toStringAsFixed(0)}%',
                          ),
                        if (c.calculatedGrade != null &&
                            c.calculatedGrade!.trim().isNotEmpty)
                          _ResultChip(
                            label: 'Grade',
                            value: c.calculatedGrade!,
                          )
                        else if (c.letterGrade != null &&
                            c.letterGrade!.trim().isNotEmpty)
                          _ResultChip(
                            label: 'Grade',
                            value: c.letterGrade!,
                          ),
                        if (c.position != null)
                          _ResultChip(
                            label: 'Position',
                            value: '${c.position}',
                          ),
                      ],
                    ),
                    if (c.comment != null &&
                        c.comment!.trim().isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        c.comment!.trim(),
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  height: 1.45,
                                  color: AppColors.textSecondary,
                                ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          }),
        ],
      ],
    );
  }
}

class _ResultChip extends StatelessWidget {
  const _ResultChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.indigoWash,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.2),
        ),
      ),
      child: Text(
        '$label: $value',
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.primaryDark,
              height: 1.2,
            ),
      ),
    );
  }
}

class ProfileExamResultsTab extends StatelessWidget {
  const ProfileExamResultsTab({
    super.key,
    required this.student,
    required this.balances,
    required this.cards,
    required this.comments,
    this.loading = false,
  });

  final StudentSummary student;
  final List<FeeBalanceRow> balances;
  final List<ReportCardSummary> cards;
  final List<ReportCardCommentRow> comments;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    if (loading && cards.isEmpty && comments.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    final published = approvedReportCards(cards);
    if (published.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          EmptyState(
            icon: Icons.assignment_turned_in_outlined,
            title: 'No exam results yet',
            message:
                'Term exam marks appear here after a report card is approved by your school.\n\n'
                'Subject lines are listed under Subject results; open Report cards for the full official document.',
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        ParentUiTokens.horizontalPadding,
        12,
        ParentUiTokens.horizontalPadding,
        24,
      ),
      children: [
        for (final card in published) ...[
          _ExamReportPeriodCard(
            card: card,
            lines: comments
                .where((x) => x.reportCardId == card.id)
                .toList()
              ..sort(
                (a, b) =>
                    a.subject.toLowerCase().compareTo(b.subject.toLowerCase()),
              ),
            student: student,
            balances: balances,
          ),
          const SizedBox(height: 14),
        ],
      ],
    );
  }
}

class _ExamReportPeriodCard extends StatelessWidget {
  const _ExamReportPeriodCard({
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
  Widget build(BuildContext context) {
    final schoolLevel = normalizeSchoolLevel(card.schoolLevel);
    final labels = examLabelsForTerm(card.term);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: ParentUiTokens.softCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.fact_check_rounded,
                  color: AppColors.primary, size: 26),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${card.term} · ${card.academicYear}',
                      style:
                          Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w900,
                              ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Published exam period',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (lines.isEmpty) ...[
            const SizedBox(height: 14),
            Text(
              'No subject marks are on file for this report yet.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
            ),
          ] else ...[
            const SizedBox(height: 12),
            Text(
              '${labels.exam1} / ${labels.exam2}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            ...lines.map((line) {
              final avg = termAverageFromComment(line);
              final grade = displayGradeForSubject(line, schoolLevel);
              final e1 = line.exam1Score;
              final e2 = line.exam2Score;
              final pos = displaySubjectPosition(line);
              final o1 = line.exam1ScoreOverridden == true;
              final o2 = line.exam2ScoreOverridden == true;

              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Theme(
                  data: Theme.of(context)
                      .copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: const EdgeInsets.only(bottom: 8),
                    title: Text(
                      line.subject,
                      style:
                          Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w900,
                              ),
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          _ExamSubtitleChip(
                            'Avg ${formatPercentOrDash(avg)}',
                          ),
                          _ExamSubtitleChip('Grade $grade'),
                          _ExamSubtitleChip('Position $pos'),
                        ],
                      ),
                    ),
                    children: [
                      _ExamScoreLine(
                        '${labels.exam1} (%)',
                        formatPercentOrDash(e1),
                        o1,
                      ),
                      _ExamScoreLine(
                        '${labels.exam2} (%)',
                        formatPercentOrDash(e2),
                        o2,
                      ),
                      if (line.comment?.trim().isNotEmpty == true) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Teacher comment',
                          style:
                              Theme.of(context).textTheme.labelSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textSecondary,
                                  ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          line.comment!.trim(),
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    height: 1.45,
                                  ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ],
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ParentReportCardDetailScreen(
                    card: card,
                    lines: lines,
                    student: student,
                    balances: balances,
                  ),
                ),
              );
            },
            icon: const Icon(Icons.article_rounded),
            label: const Text('Open full report card'),
          ),
        ],
      ),
    );
  }
}

class _ExamSubtitleChip extends StatelessWidget {
  const _ExamSubtitleChip(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.indigoWash,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.15),
        ),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.primaryDark,
            ),
      ),
    );
  }
}

class _ExamScoreLine extends StatelessWidget {
  const _ExamScoreLine(this.label, this.value, this.overridden);

  final String label;
  final String value;
  final bool overridden;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 3,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              '$value${overridden ? ' · adjusted' : ''}',
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileReportCardsTab extends StatelessWidget {
  const ProfileReportCardsTab({
    super.key,
    required this.student,
    required this.balances,
    required this.cards,
    required this.comments,
    this.loading = false,
  });

  final StudentSummary student;
  final List<FeeBalanceRow> balances;
  final List<ReportCardSummary> cards;
  final List<ReportCardCommentRow> comments;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    if (loading && cards.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (cards.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          EmptyState(
            icon: Icons.description_outlined,
            title: 'No report cards',
            message:
                'Official report cards will appear when your school publishes them for this student.',
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
        ParentUiTokens.horizontalPadding,
        12,
        ParentUiTokens.horizontalPadding,
        24,
      ),
      itemCount: cards.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, i) {
        final c = cards[i];
        final lines = comments.where((x) => x.reportCardId == c.id).toList();
        return Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(ParentUiTokens.radiusLg),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ParentReportCardDetailScreen(
                    card: c,
                    lines: lines,
                    student: student,
                    balances: balances,
                  ),
                ),
              );
            },
            child: Ink(
              padding: const EdgeInsets.all(18),
              decoration: ParentUiTokens.softCard(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.article_rounded,
                          color: AppColors.primary, size: 26),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Official report card',
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                      ),
                      _ReportStatusChip(status: c.status),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '${c.term} · ${c.academicYear}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  if (c.submittedAt != null &&
                      c.submittedAt!.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Submitted ${c.submittedAt!.split('T').first}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                  if (c.adminNote != null &&
                      c.adminNote!.trim().isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      c.adminNote!.trim(),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            height: 1.45,
                          ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Text(
                        '${lines.length} subject line${lines.length == 1 ? '' : 's'}',
                        style:
                            Theme.of(context).textTheme.labelMedium?.copyWith(
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                      ),
                      const Spacer(),
                      Text(
                        'View details',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      Icon(Icons.chevron_right_rounded,
                          color: AppColors.primary),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ReportStatusChip extends StatelessWidget {
  const _ReportStatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final label = status.replaceAll('_', ' ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.indigoWash,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.primaryDark,
            ),
      ),
    );
  }
}

class ProfileFeesTab extends StatelessWidget {
  const ProfileFeesTab({
    super.key,
    required this.student,
    required this.balances,
    required this.payments,
  });

  final StudentSummary student;
  final List<FeeBalanceRow> balances;
  final List<PaymentRow> payments;

  @override
  Widget build(BuildContext context) {
    final totalDue = balances.fold<double>(0, (a, b) => a + b.balance);
    final totalFees = balances.fold<double>(0, (a, b) => a + b.totalFee);
    final totalPaid = balances.fold<double>(0, (a, b) => a + b.totalPaid);

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        ParentUiTokens.horizontalPadding,
        12,
        ParentUiTokens.horizontalPadding,
        24,
      ),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: ParentUiTokens.softCard(),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _MoneyCol(
                      label: 'Total fees',
                      value: formatCurrency(totalFees, student.currencyCode),
                    ),
                  ),
                  Container(width: 1, height: 44, color: AppColors.cardBorder),
                  Expanded(
                    child: _MoneyCol(
                      label: 'Paid',
                      value: formatCurrency(totalPaid, student.currencyCode),
                      valueColor: AppColors.success,
                    ),
                  ),
                  Container(width: 1, height: 44, color: AppColors.cardBorder),
                  Expanded(
                    child: _MoneyCol(
                      label: 'Balance',
                      value: formatCurrency(totalDue, student.currencyCode),
                      valueColor:
                          totalDue > 0 ? AppColors.warning : AppColors.success,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Fee items',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 10),
        if (balances.isEmpty)
          EmptyState(
            icon: Icons.receipt_long_outlined,
            title: 'No fee lines',
            message: 'Fee breakdown will show when your school assigns fees.',
          )
        else
          ...balances.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: ParentUiTokens.softCard(),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            b.feeName,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          if (b.dueDate != null)
                            Text(
                              'Due ${b.dueDate!.split('T').first}',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelMedium
                                  ?.copyWith(color: AppColors.textSecondary),
                            ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          formatCurrency(b.balance, student.currencyCode),
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: b.balance > 0
                                        ? AppColors.warning
                                        : AppColors.success,
                                  ),
                        ),
                        Text(
                          'of ${formatCurrency(b.totalFee, student.currencyCode)}',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        const SizedBox(height: 20),
        Text(
          'Recent payments',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 10),
        if (payments.isEmpty)
          Text(
            'No payments recorded yet.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          )
        else
          ...payments.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: ParentUiTokens.softCard(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          formatCurrency(p.amount, student.currencyCode),
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        Text(
                          p.paymentDate.split('T').first,
                          style:
                              Theme.of(context).textTheme.labelMedium?.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                        ),
                      ],
                    ),
                    Text(
                      '${_paymentMethodLabel(p.paymentMethod)} · ${p.feeStructureName ?? 'Fees'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (p.hasReceiptForView) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.of(context).push<void>(
                              MaterialPageRoute<void>(
                                builder: (_) => ReceiptDetailScreen(
                                  payment: p,
                                  student: student,
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.receipt_long_rounded),
                          label: const Text('View receipt'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MoneyCol extends StatelessWidget {
  const _MoneyCol({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          label.toUpperCase(),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w900,
                color: valueColor ?? const Color(0xFF0F172A),
              ),
        ),
      ],
    );
  }
}

class ProfileMessagesTab extends StatefulWidget {
  const ProfileMessagesTab({
    super.key,
    required this.parentUserId,
    required this.extra,
    required this.onSent,
    this.loadingExtra = false,
  });

  final String parentUserId;
  final StudentProfileExtraData extra;
  final Future<void> Function() onSent;
  final bool loadingExtra;

  @override
  State<ProfileMessagesTab> createState() => _ProfileMessagesTabState();
}

class _ProfileMessagesTabState extends State<ProfileMessagesTab> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final convId = widget.extra.primaryConversationId;
    if (convId == null) return;
    setState(() => _sending = true);
    final ok = await ParentDataRepository(Supabase.instance.client)
        .sendParentChatMessage(
      conversationId: convId,
      text: _controller.text,
    );
    if (!mounted) return;
    setState(() => _sending = false);
    if (ok) {
      _controller.clear();
      await widget.onSent();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not send message. You may need an active conversation with the class teacher.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final convId = widget.extra.primaryConversationId;
    final msgs = widget.extra.messages;

    if (widget.loadingExtra && convId == null && msgs.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (convId == null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          EmptyState(
            icon: Icons.forum_outlined,
            title: 'No conversation yet',
            message:
                'Your class teacher can start a message thread with you for this class. Once it exists, you will see the history here.',
          ),
        ],
      );
    }

    return Column(
      children: [
        Expanded(
          child: msgs.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      'No messages yet. Say hello below when you are ready.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.45,
                          ),
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(
                    ParentUiTokens.horizontalPadding,
                    12,
                    ParentUiTokens.horizontalPadding,
                    12,
                  ),
                  itemCount: msgs.length,
                  itemBuilder: (context, i) {
                    final m = msgs[i];
                    final isParent = m.senderId == widget.parentUserId;
                    return Align(
                      alignment: isParent
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.sizeOf(context).width * 0.82,
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: isParent
                              ? AppColors.primary
                              : AppColors.indigoWash,
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(16),
                            topRight: const Radius.circular(16),
                            bottomLeft: Radius.circular(isParent ? 16 : 4),
                            bottomRight: Radius.circular(isParent ? 4 : 16),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              m.message,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    color: isParent
                                        ? Colors.white
                                        : const Color(0xFF0F172A),
                                    height: 1.35,
                                  ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              m.createdAt.split('T').first,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: isParent
                                        ? Colors.white.withValues(alpha: 0.85)
                                        : AppColors.textSecondary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                top: BorderSide(color: AppColors.cardBorder),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    minLines: 1,
                    maxLines: 4,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: 'Write a message…',
                      filled: true,
                      fillColor: AppColors.surface,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _sending ? null : _send,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(52, 52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _sending
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

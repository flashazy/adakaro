import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/currency_format.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/attendance_record.dart';
import '../../data/models/chat_message_row.dart';
import '../../data/models/fee_balance_row.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/report_card_comment_row.dart';
import '../../data/models/report_card_summary.dart';
import '../../data/models/student_profile_extra_data.dart';
import '../../data/models/student_summary.dart';
import '../../data/parent_data_repository.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/status_chip.dart';
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

class ProfileOverviewTab extends StatelessWidget {
  const ProfileOverviewTab({
    super.key,
    required this.student,
    required this.balances,
    required this.extra,
    required this.loadingExtra,
  });

  final StudentSummary student;
  final List<FeeBalanceRow> balances;
  final StudentProfileExtraData? extra;
  final bool loadingExtra;

  @override
  Widget build(BuildContext context) {
    final totalDue = balances.fold<double>(0, (a, b) => a + b.balance);
    final totalFees = balances.fold<double>(0, (a, b) => a + b.totalFee);
    final totalPaid = balances.fold<double>(0, (a, b) => a + b.totalPaid);
    final att = extra?.attendance ?? const <AttendanceRecord>[];
    final latestAtt = att.isNotEmpty ? att.first : null;
    final comments = extra?.reportComments ?? const <ReportCardCommentRow>[];
    final latestResult = comments.isNotEmpty ? comments.first : null;
    final msgs = extra?.messages ?? const <ChatMessageRow>[];
    final latestMsg = msgs.isNotEmpty ? msgs.last : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        ParentUiTokens.horizontalPadding,
        12,
        ParentUiTokens.horizontalPadding,
        24,
      ),
      children: [
        if (loadingExtra)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: LinearProgressIndicator(minHeight: 3),
          ),
        _OverviewCard(
          icon: Icons.account_balance_wallet_rounded,
          title: 'Fee balance',
          child: balances.isEmpty
              ? Text(
                  'No fee lines yet.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _MiniMoney(
                            label: 'Total',
                            value: formatCurrency(
                              totalFees,
                              student.currencyCode,
                            ),
                          ),
                        ),
                        Expanded(
                          child: _MiniMoney(
                            label: 'Paid',
                            value: formatCurrency(
                              totalPaid,
                              student.currencyCode,
                            ),
                            color: AppColors.success,
                          ),
                        ),
                        Expanded(
                          child: _MiniMoney(
                            label: 'Due',
                            value: formatCurrency(
                              totalDue,
                              student.currencyCode,
                            ),
                            color: totalDue > 0
                                ? AppColors.warning
                                : AppColors.success,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: totalDue > 0
                          ? StatusChip.balanceDue('Balance outstanding')
                          : StatusChip.paidUp(),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        _OverviewCard(
          icon: Icons.event_available_rounded,
          title: 'Latest attendance',
          child: latestAtt == null
              ? Text(
                  'No attendance records yet, or your school has not published them here.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                )
              : Row(
                  children: [
                    Icon(
                      _statusIcon(latestAtt.status),
                      color: _statusColor(latestAtt.status),
                      size: 28,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            latestAtt.attendanceDate.split('T').first,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          Text(
                            _statusLabel(latestAtt.status),
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        _OverviewCard(
          icon: Icons.workspace_premium_rounded,
          title: 'Latest results',
          child: latestResult == null
              ? Text(
                  'Subject and exam results appear here when teachers submit report cards.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      latestResult.subject,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${latestResult.term} · ${latestResult.academicYear}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                    if (latestResult.calculatedGrade != null &&
                        latestResult.calculatedGrade!.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Grade: ${latestResult.calculatedGrade}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ] else if (latestResult.letterGrade != null &&
                        latestResult.letterGrade!.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Grade: ${latestResult.letterGrade}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 12),
        _OverviewCard(
          icon: Icons.chat_bubble_outline_rounded,
          title: 'Messages',
          child: latestMsg == null
              ? Text(
                  'No conversation yet. When your class teacher starts a thread, messages will show here.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                )
              : Text(
                  latestMsg.message,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
        ),
        const SizedBox(height: 12),
        _OverviewCard(
          icon: Icons.person_outline_rounded,
          title: 'Student info',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (student.gender?.trim().isNotEmpty == true)
                _InfoLine('Gender', student.gender!.trim()),
              if (student.dateOfBirth?.trim().isNotEmpty == true)
                _InfoLine(
                  'Date of birth',
                  student.dateOfBirth!.split('T').first,
                ),
              if (student.status?.trim().isNotEmpty == true)
                _InfoLine('Status', student.status!.trim()),
              if (student.parentPhone?.trim().isNotEmpty == true)
                _InfoLine('Contact on file', student.parentPhone!.trim()),
            ],
          ),
        ),
      ],
    );
  }
}

class _MiniMoney extends StatelessWidget {
  const _MiniMoney({
    required this.label,
    required this.value,
    this.color,
  });

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w900,
                color: color ?? const Color(0xFF0F172A),
              ),
        ),
      ],
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
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
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({
    required this.icon,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: ParentUiTokens.softCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: 8),
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
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

class ProfileResultsTab extends StatelessWidget {
  const ProfileResultsTab({
    super.key,
    required this.comments,
    this.loading = false,
  });

  final List<ReportCardCommentRow> comments;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    if (loading && comments.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (comments.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          EmptyState(
            icon: Icons.school_outlined,
            title: 'No published results',
            message:
                'Results from report cards will show here when your teachers submit them for review or approval.',
          ),
        ],
      );
    }

    final byTerm = <String, List<ReportCardCommentRow>>{};
    for (final c in comments) {
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
          ...byTerm[k]!.map((c) => Padding(
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
                              label: 'Exam 1',
                              value: c.exam1Score!.toStringAsFixed(0),
                            ),
                          if (c.exam2Score != null)
                            _ResultChip(
                              label: 'Exam 2',
                              value: c.exam2Score!.toStringAsFixed(0),
                            ),
                          if (c.calculatedScore != null)
                            _ResultChip(
                              label: 'Score',
                              value: c.calculatedScore!.toStringAsFixed(1),
                            ),
                          if (c.scorePercent != null)
                            _ResultChip(
                              label: '%',
                              value:
                                  '${c.scorePercent!.toStringAsFixed(0)}%',
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
                      if (c.comment != null && c.comment!.trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          c.comment!.trim(),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                height: 1.45,
                                color: AppColors.textSecondary,
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
              )),
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
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.primaryDark,
            ),
      ),
    );
  }
}

class ProfileReportCardsTab extends StatelessWidget {
  const ProfileReportCardsTab({
    super.key,
    required this.cards,
    required this.comments,
    this.loading = false,
  });

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
        final lines =
            comments.where((x) => x.reportCardId == c.id).toList();
        return Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(ParentUiTokens.radiusLg),
            onTap: () => _openReportCardSheet(context, c, lines),
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
                          'Report card',
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
                  if (c.adminNote != null && c.adminNote!.trim().isNotEmpty) ...[
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
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
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

void _openReportCardSheet(
  BuildContext context,
  ReportCardSummary card,
  List<ReportCardCommentRow> lines,
) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.55,
        maxChildSize: 0.92,
        minChildSize: 0.35,
        builder: (_, scroll) {
          return ListView(
            controller: scroll,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppColors.cardBorder,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                Text(
                  '${card.term} · ${card.academicYear}',
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const SizedBox(height: 8),
                _ReportStatusChip(status: card.status),
                if (card.adminNote != null &&
                    card.adminNote!.trim().isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    'School note',
                    style: Theme.of(ctx).textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textSecondary,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    card.adminNote!.trim(),
                    style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                        ),
                  ),
                ],
                const SizedBox(height: 20),
                Text(
                  'Subjects',
                  style: Theme.of(ctx).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 10),
                if (lines.isEmpty)
                  Text(
                    'No subject lines on file for this card.',
                    style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                  )
                else
                  ...lines.map(
                    (l) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: ParentUiTokens.insetWell(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l.subject,
                              style: Theme.of(ctx)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                if (l.calculatedGrade != null &&
                                    l.calculatedGrade!.trim().isNotEmpty)
                                  Text(
                                    'Grade ${l.calculatedGrade}',
                                    style: Theme.of(ctx)
                                        .textTheme
                                        .labelMedium
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                if (l.scorePercent != null)
                                  Text(
                                    '${l.scorePercent!.toStringAsFixed(0)}%',
                                    style: Theme.of(ctx)
                                        .textTheme
                                        .labelMedium
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                              ],
                            ),
                            if (l.comment != null &&
                                l.comment!.trim().isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                l.comment!.trim(),
                                style: Theme.of(ctx)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      color: AppColors.textSecondary,
                                      height: 1.4,
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
        },
      );
    },
  );
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
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
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
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
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

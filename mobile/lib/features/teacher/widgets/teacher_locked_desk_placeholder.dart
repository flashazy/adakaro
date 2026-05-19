import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/teacher_ui_tokens.dart';
import '../../../data/models/teacher_models.dart';

/// Opens the best available channel to reach the school admin (phone, then email),
/// or copies details / shows a snackbar when nothing can be launched.
Future<void> openTeacherAdministratorContact(
  BuildContext context,
  TeacherLockedContact? contact,
) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  void snack(String message) {
    messenger?.showSnackBar(SnackBar(content: Text(message)));
  }

  if (contact == null) {
    snack(
      'Contact details are not available yet. Try refresh, or reach out through your school.',
    );
    return;
  }

  final phone = contact.adminPhone?.trim() ?? '';
  final email = contact.adminEmail?.trim() ?? '';

  if (phone.isNotEmpty) {
    final uri = Uri(scheme: 'tel', path: phone.replaceAll(RegExp(r'\s+'), ''));
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }
  }

  if (email.isNotEmpty) {
    final uri = Uri(scheme: 'mailto', path: email);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }
  }

  final lines = <String>[
    contact.adminName,
    if (email.isNotEmpty) email,
    if (phone.isNotEmpty) phone,
  ].where((e) => e.trim().isNotEmpty).toList();

  if (lines.length <= 1 && email.isEmpty && phone.isEmpty) {
    snack('No email or phone is on file for your administrator yet.');
    return;
  }

  await Clipboard.setData(ClipboardData(text: lines.join('\n')));
  snack('Copied');
}

bool teacherLockedContactIsReachable(TeacherLockedContact? c) {
  if (c == null) return false;
  final p = c.adminPhone?.trim() ?? '';
  final e = c.adminEmail?.trim() ?? '';
  return p.isNotEmpty || e.isNotEmpty;
}

class TeacherLockedDeskPlaceholder extends StatelessWidget {
  const TeacherLockedDeskPlaceholder({
    super.key,
    required this.contact,
    required this.onRefreshStatus,
    required this.onSignOut,
    required this.isRefreshing,
  });

  final TeacherLockedContact? contact;
  final VoidCallback onRefreshStatus;
  final VoidCallback onSignOut;
  final bool isRefreshing;

  static const _footerReassurance =
      'Your class lists, marks, plans, and documents will appear automatically once access is granted.';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final showContactButton = teacherLockedContactIsReachable(contact);

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 10, 24, 16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _WaitingStatusBadge(theme: theme),
              const SizedBox(height: 18),
              Text(
                "You're not assigned yet",
                textAlign: TextAlign.center,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.35,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Your school administrator needs to connect you to a class or '
                'subject before your teaching desk opens.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 20),
              if (contact != null) ...[
                _AdminContactCard(contact: contact!),
              ] else
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFFCBD5E1).withValues(alpha: 0.85),
                    ),
                    boxShadow: TeacherUiTokens.cardLift,
                  ),
                  child: Text(
                    'We could not load your school contact card. Pull to '
                    'refresh or use Sign out — you are not stuck here.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.45,
                    ),
                  ),
                ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: isRefreshing ? null : onRefreshStatus,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: isRefreshing
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.25,
                              color: theme.colorScheme.onPrimary,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            'Checking access…',
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: theme.colorScheme.onPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      )
                    : const Text('Refresh status'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: onSignOut,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  side: BorderSide(
                    color: AppColors.cardBorder.withValues(alpha: 0.95),
                  ),
                ),
                child: const Text('Sign out'),
              ),
              if (showContactButton) ...[
                const SizedBox(height: 6),
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      alignment: WrapAlignment.center,
                      spacing: 0,
                      runSpacing: 2,
                      children: [
                        Text(
                          'Need help? ',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: const Color(0xFF64748B)
                                .withValues(alpha: 0.88),
                            fontWeight: FontWeight.w500,
                            height: 1.25,
                          ),
                        ),
                        Semantics(
                          button: true,
                          label: 'Contact admin',
                          child: GestureDetector(
                            onTap: () =>
                                openTeacherAdministratorContact(
                                    context, contact),
                            behavior: HitTestBehavior.opaque,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: 4,
                                horizontal: 2,
                              ),
                              child: Text(
                                'Contact admin',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: AppColors.primaryDark,
                                  fontWeight: FontWeight.w600,
                                  height: 1.25,
                                  decoration: TextDecoration.underline,
                                  decorationColor: AppColors.primaryDark
                                      .withValues(alpha: 0.32),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Text(
                _footerReassurance,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontSize: 12.5,
                  color: const Color(0xFF64748B).withValues(alpha: 0.72),
                  height: 1.42,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ]),
          ),
        ),
      ],
    );
  }
}

class _WaitingStatusBadge extends StatelessWidget {
  const _WaitingStatusBadge({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        decoration: BoxDecoration(
          color: AppColors.indigoWash.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.14),
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.05),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.space_dashboard_outlined,
              size: 19,
              color: AppColors.primary.withValues(alpha: 0.62),
            ),
            const SizedBox(width: 10),
            Text(
              'Waiting for classroom assignment',
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.15,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdminContactCard extends StatelessWidget {
  const _AdminContactCard({required this.contact});

  final TeacherLockedContact contact;

  Future<void> _copyContactField(
    BuildContext context,
    String value,
    String snackMessage,
  ) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(snackMessage),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        duration: const Duration(milliseconds: 2200),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final email = contact.adminEmail?.trim();
    final phone = contact.adminPhone?.trim();

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFAF8),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(0xFFE8E4E1).withValues(alpha: 0.9),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E293B).withValues(alpha: 0.035),
            blurRadius: 32,
            offset: const Offset(0, 12),
            spreadRadius: -8,
          ),
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 6),
            spreadRadius: -4,
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Administrator',
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 14),
          _InfoRow(
            icon: Icons.school_outlined,
            label: 'School',
            value: contact.schoolName,
            dense: true,
          ),
          const SizedBox(height: 12),
          _InfoRow(
            icon: Icons.person_outline_rounded,
            label: 'Name',
            value: contact.adminName,
            dense: true,
          ),
          if ((email != null && email.isNotEmpty) ||
              (phone != null && phone.isNotEmpty)) ...[
            Padding(
              padding: const EdgeInsets.only(top: 16, bottom: 8),
              child: Divider(
                height: 1,
                color: AppColors.cardBorder.withValues(alpha: 0.75),
              ),
            ),
            Text(
              'Contact',
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 10),
            if (email != null && email.isNotEmpty)
              _ContactActionRow(
                icon: Icons.mail_outline_rounded,
                label: 'Email',
                value: email,
                onTap: () =>
                    _copyContactField(context, email, 'Email copied'),
              ),
            if (email != null && email.isNotEmpty && phone != null && phone.isNotEmpty)
              const SizedBox(height: 8),
            if (phone != null && phone.isNotEmpty)
              _ContactActionRow(
                icon: Icons.phone_outlined,
                label: 'Phone',
                value: phone,
                onTap: () =>
                    _copyContactField(context, phone, 'Phone copied'),
              ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.dense = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          icon,
          size: dense ? 22 : 24,
          color: AppColors.primary.withValues(alpha: 0.75),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              SelectableText(
                value,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ContactActionRow extends StatefulWidget {
  const _ContactActionRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  State<_ContactActionRow> createState() => _ContactActionRowState();
}

class _ContactActionRowState extends State<_ContactActionRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerUp: (_) => setState(() => _pressed = false),
      onPointerCancel: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.987 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Material(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(14),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: widget.onTap,
            borderRadius: BorderRadius.circular(14),
            splashColor: AppColors.primary.withValues(alpha: 0.14),
            highlightColor: AppColors.primary.withValues(alpha: 0.07),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(
                    widget.icon,
                    size: 22,
                    color: AppColors.primary.withValues(alpha: 0.82),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.label,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.value,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: AppColors.primaryDark,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.copy_rounded,
                    size: 20,
                    color: AppColors.textSecondary.withValues(alpha: 0.55),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

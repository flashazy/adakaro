import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/parent_ui_tokens.dart';
import '../../data/models/parent_overview.dart';
import '../../data/models/student_summary.dart';
import '../../data/parent_data_repository.dart';
import '../auth/login_screen.dart';
import 'parent_child_feature_screen.dart';
import 'parent_child_payments_screen.dart';
import 'parent_child_picker_sheet.dart';
import 'parent_quick_action.dart';
import 'student_profile_screen.dart';
import 'tabs/dashboard_tab.dart';
import 'tabs/fees_tab.dart';
import 'tabs/messages_tab.dart';
import 'tabs/payments_tab.dart';

String _parentToolbarConnectionLine(ParentOverview overview) {
  final schoolNames = overview.students
      .map((s) => s.schoolName?.trim())
      .whereType<String>()
      .where((n) => n.isNotEmpty)
      .toSet()
      .toList()
    ..sort();
  if (schoolNames.isEmpty) {
    return 'Last synced just now';
  }
  if (schoolNames.length == 1) {
    final name = schoolNames.single;
    if (name.length > 40) {
      return 'Connected to ${name.substring(0, 37)}…';
    }
    return 'Connected to $name';
  }
  return 'Connected to ${schoolNames.length} schools';
}

class ParentMainScaffold extends StatefulWidget {
  const ParentMainScaffold({super.key, required this.user});

  final User user;

  @override
  State<ParentMainScaffold> createState() => _ParentMainScaffoldState();
}

class _ParentMainScaffoldState extends State<ParentMainScaffold> {
  int _index = 0;
  int _reloadGeneration = 0;
  ParentOverview? _overview;
  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  String? _refreshError;
  final Map<ParentQuickAction, DateTime> _optimisticSeenAt = {};

  DateTime? _tryParseIso(String? v) {
    if (v == null) return null;
    final t = v.trim();
    if (t.isEmpty) return null;
    return DateTime.tryParse(t);
  }

  DateTime? _serverSeenAt(ParentQuickAction action) {
    final seen = _overview?.seen;
    if (seen == null) return null;
    return switch (action) {
      ParentQuickAction.messages => _tryParseIso(seen.lastSeenMessagesAt),
      ParentQuickAction.subjectResults =>
        _tryParseIso(seen.lastSeenSubjectResultsAt),
      ParentQuickAction.reportCards => _tryParseIso(seen.lastSeenReportCardsAt),
      ParentQuickAction.fees => _tryParseIso(seen.lastSeenFeesAt),
      ParentQuickAction.paymentsReceipts => _tryParseIso(seen.lastSeenReceiptsAt),
      ParentQuickAction.attendance => null,
      ParentQuickAction.examResults => _tryParseIso(seen.lastSeenSubjectResultsAt),
      ParentQuickAction.profile => null,
    };
  }

  Map<ParentQuickAction, DateTime?> _effectiveSeenAtMap() {
    DateTime? eff(ParentQuickAction a) => _optimisticSeenAt[a] ?? _serverSeenAt(a);
    return {
      ParentQuickAction.messages: eff(ParentQuickAction.messages),
      ParentQuickAction.subjectResults: eff(ParentQuickAction.subjectResults),
      ParentQuickAction.reportCards: eff(ParentQuickAction.reportCards),
      ParentQuickAction.fees: eff(ParentQuickAction.fees),
      ParentQuickAction.paymentsReceipts: eff(ParentQuickAction.paymentsReceipts),
      ParentQuickAction.attendance: eff(ParentQuickAction.attendance),
    };
  }

  Future<void> _markAttentionSeen(ParentQuickAction action) async {
    final ov = _overview;
    final att = ov?.attention;
    DateTime? latest;
    if (att != null) {
      latest = switch (action) {
        ParentQuickAction.messages => _tryParseIso(att.messagesLatestAt),
        ParentQuickAction.subjectResults =>
          _tryParseIso(att.subjectResultsLatestAt),
        ParentQuickAction.reportCards =>
          _tryParseIso(att.reportCardsLatestApprovedAt),
        ParentQuickAction.fees => _tryParseIso(att.feesLatestAt),
        ParentQuickAction.paymentsReceipts =>
          _tryParseIso(att.paymentsLatestAt),
        ParentQuickAction.attendance =>
          _tryParseIso(att.attendanceConcernLatestAt),
        ParentQuickAction.examResults => _tryParseIso(att.subjectResultsLatestAt),
        ParentQuickAction.profile => null,
      };
    }
    setState(() {
      _optimisticSeenAt[action] = latest ?? DateTime.now();
    });

    // Persist to Supabase so it survives restart/logout/device changes.
    final parentId = widget.user.id;
    final repo = ParentDataRepository(Supabase.instance.client);
    final column = switch (action) {
      ParentQuickAction.messages => 'last_seen_messages_at',
      ParentQuickAction.subjectResults => 'last_seen_subject_results_at',
      ParentQuickAction.reportCards => 'last_seen_report_cards_at',
      ParentQuickAction.fees => 'last_seen_fees_at',
      ParentQuickAction.paymentsReceipts => 'last_seen_receipts_at',
      ParentQuickAction.attendance => null,
      ParentQuickAction.examResults => 'last_seen_subject_results_at',
      ParentQuickAction.profile => null,
    };
    if (column != null) {
      await repo.markParentSectionSeen(parentId: parentId, column: column);
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final isRefresh = _overview != null;
    if (isRefresh) {
      setState(() {
        _refreshing = true;
        _refreshError = null;
      });
    } else {
      setState(() {
        _loading = true;
        _error = null;
        _refreshError = null;
      });
    }
    try {
      final repo = ParentDataRepository(Supabase.instance.client);
      final data = await repo.loadOverview(widget.user.id);
      if (!mounted) return;
      setState(() {
        _overview = data;
        _loading = false;
        _refreshing = false;
        _error = null;
        _refreshError = null;
        _reloadGeneration++;
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

  Map<String, StudentSummary> _studentLookup() {
    final m = <String, StudentSummary>{};
    for (final s in _overview?.students ?? <StudentSummary>[]) {
      m[s.id] = s;
    }
    return m;
  }

  void _openStudentProfile(StudentSummary student) {
    final ov = _overview;
    if (ov == null) return;
    final balances =
        ov.balances.where((b) => b.studentId == student.id).toList();
    final payments =
        ov.payments.where((p) => p.studentId == student.id).toList();
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => StudentProfileScreen(
          parentUserId: widget.user.id,
          student: student,
          balances: balances,
          recentPayments: payments.take(12).toList(),
        ),
      ),
    );
  }

  Future<void> _openQuickAction(ParentQuickAction action) async {
    final ov = _overview;
    if (ov == null) return;
    final students = ov.students;
    if (students.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Link a student to use this shortcut.')),
      );
      return;
    }

    final StudentSummary student;
    if (students.length == 1) {
      student = students.first;
    } else {
      final picked = await showParentChildPicker(
        context,
        students: students,
        subtitle: action.title,
      );
      if (!mounted || picked == null) return;
      student = picked;
    }

    final balances =
        ov.balances.where((b) => b.studentId == student.id).toList();
    final recentPayments =
        ov.payments.where((p) => p.studentId == student.id).take(12).toList();

    if (!mounted) return;

    // Clear indicator as soon as the parent intentionally opens that section.
    if (action != ParentQuickAction.profile) {
      // Intentional fire-and-forget behavior: UI clears instantly.
      // ignore: unawaited_futures
      _markAttentionSeen(action);
    }

    switch (action) {
      case ParentQuickAction.profile:
        _openStudentProfile(student);
        return;
      case ParentQuickAction.paymentsReceipts:
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => ParentChildPaymentsScreen(
              student: student,
              payments: paymentsForStudent(ov, student.id),
              onRefresh: _load,
              loadError: _refreshError,
            ),
          ),
        );
        return;
      case ParentQuickAction.attendance:
      case ParentQuickAction.subjectResults:
      case ParentQuickAction.examResults:
      case ParentQuickAction.reportCards:
      case ParentQuickAction.fees:
      case ParentQuickAction.messages:
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => ParentChildFeatureScreen(
              parentUserId: widget.user.id,
              student: student,
              balances: balances,
              recentPayments: recentPayments.toList(),
              feature: action,
            ),
          ),
        );
        return;
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
        backgroundColor: AppColors.surface,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 48,
                    height: 48,
                    child: CircularProgressIndicator(
                      strokeWidth: 3,
                      color: AppColors.primary,
                      backgroundColor: AppColors.indigoWash,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    'Loading your dashboard…',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                        ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Fetching students, fees, and payments.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (_error != null && _overview == null) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(title: const Text('Adakaro')),
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.cloud_off_rounded,
                  size: 56,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(height: 20),
                Text(
                  'Could not load dashboard',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        height: 1.45,
                        color: AppColors.textSecondary,
                      ),
                ),
                const SizedBox(height: 28),
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

    final overview = _overview!;
    final lookup = _studentLookup();

    final tabs = <Widget>[
      DashboardTab(
        overview: overview,
        onOpenStudent: _openStudentProfile,
        onNavigateToTab: (i) => setState(() => _index = i),
        onRefresh: _load,
        refreshError: _refreshError,
        onQuickAction: _openQuickAction,
        effectiveSeenAt: _effectiveSeenAtMap(),
      ),
      FeesTab(
        overview: overview,
        onOpenStudent: _openStudentProfile,
        onRefresh: _load,
        loadError: _refreshError,
      ),
      PaymentsTab(
        overview: overview,
        studentLookup: lookup,
        onRefresh: _load,
        loadError: _refreshError,
      ),
      ParentMessagesTab(
        overview: overview,
        parentUserId: widget.user.id,
        reloadGeneration: _reloadGeneration,
        isVisible: _index == 3,
      ),
    ];

    return Scaffold(
      backgroundColor: ParentUiTokens.parentHomeCanvas,
      appBar: AppBar(
        centerTitle: true,
        toolbarHeight: 70,
        title: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Parent',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.35,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              _parentToolbarConnectionLine(overview),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontSize: 10.75,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.02,
                    height: 1.15,
                    color: AppColors.textSecondary.withValues(alpha: 0.68),
                  ),
            ),
          ],
        ),
        surfaceTintColor: Colors.transparent,
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
              if (v == 'out') {
                _signOut();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'out', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: tabs),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Divider(
            height: 1,
            thickness: 1,
            color: const Color(0xFF0F172A).withValues(alpha: 0.047),
          ),
          NavigationBarTheme(
            data: NavigationBarThemeData(
              elevation: 0,
              indicatorColor: AppColors.primary.withValues(alpha: 0.044),
              indicatorShape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(19),
              ),
              overlayColor: WidgetStateProperty.all(Colors.transparent),
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                final sel = states.contains(WidgetState.selected);
                return TextStyle(
                  fontWeight: sel ? FontWeight.w600 : FontWeight.w500,
                  fontSize: 10.75,
                  letterSpacing: 0.015,
                  height: 1.05,
                  color: sel
                      ? AppColors.primaryDark
                      : AppColors.textSecondary.withValues(alpha: 0.79),
                );
              }),
              iconTheme: WidgetStateProperty.resolveWith((states) {
                final sel = states.contains(WidgetState.selected);
                return IconThemeData(
                  color: sel
                      ? AppColors.primary
                      : AppColors.textSecondary.withValues(alpha: 0.80),
                  size: 22,
                );
              }),
              height: 60,
              backgroundColor: Colors.white,
              shadowColor: Colors.transparent,
            ),
            child: NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (i) {
                setState(() => _index = i);
                // Bottom-nav sections should also clear indicators.
                switch (i) {
                  case 1:
                    // ignore: unawaited_futures
                    _markAttentionSeen(ParentQuickAction.fees);
                    break;
                  case 2:
                    // ignore: unawaited_futures
                    _markAttentionSeen(ParentQuickAction.paymentsReceipts);
                    break;
                  case 3:
                    // ignore: unawaited_futures
                    _markAttentionSeen(ParentQuickAction.messages);
                    break;
                  default:
                    break;
                }
              },
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined),
                  selectedIcon: Icon(Icons.account_balance_wallet_rounded),
                  label: 'Fees',
                ),
                NavigationDestination(
                  icon: Icon(Icons.receipt_long_outlined),
                  selectedIcon: Icon(Icons.receipt_long_rounded),
                  label: 'Payments',
                ),
                NavigationDestination(
                  icon: Icon(Icons.chat_bubble_outline_rounded),
                  selectedIcon: Icon(Icons.chat_bubble_rounded),
                  label: 'Messages',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

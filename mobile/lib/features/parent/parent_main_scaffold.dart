import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/errors/load_error_mapper.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/parent_overview.dart';
import '../../data/models/student_summary.dart';
import '../../data/parent_data_repository.dart';
import '../auth/login_screen.dart';
import 'notifications_screen.dart';
import 'student_profile_screen.dart';
import 'tabs/dashboard_tab.dart';
import 'tabs/fees_tab.dart';
import 'tabs/payments_tab.dart';

class ParentMainScaffold extends StatefulWidget {
  const ParentMainScaffold({super.key, required this.user});

  final User user;

  @override
  State<ParentMainScaffold> createState() => _ParentMainScaffoldState();
}

class _ParentMainScaffoldState extends State<ParentMainScaffold> {
  int _index = 0;
  ParentOverview? _overview;
  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  String? _refreshError;

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
    final balances = ov.balances.where((b) => b.studentId == student.id).toList();
    final payments = ov.payments.where((p) => p.studentId == student.id).toList();
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
      const NotificationsScreen(embedded: true),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Adakaro'),
            Text(
              'Parent',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                  ),
            ),
          ],
        ),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
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
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications_rounded),
            label: 'Alerts',
          ),
        ],
      ),
    );
  }
}

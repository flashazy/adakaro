import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/theme/app_theme.dart';
import 'features/auth/set_new_password_screen.dart';
import 'features/splash/splash_screen.dart';

class AdakaroApp extends StatefulWidget {
  const AdakaroApp({super.key});

  @override
  State<AdakaroApp> createState() => _AdakaroAppState();
}

class _AdakaroAppState extends State<AdakaroApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  StreamSubscription<AuthState>? _authSub;
  bool _recoveryRouteOpen = false;

  @override
  void initState() {
    super.initState();
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen(
      _onAuthState,
    );
  }

  void _onAuthState(AuthState data) {
    if (data.event != AuthChangeEvent.passwordRecovery) return;
    if (_recoveryRouteOpen) return;
    _recoveryRouteOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final nav = _navigatorKey.currentState;
      if (nav == null || !nav.mounted) {
        _recoveryRouteOpen = false;
        return;
      }
      nav
          .push<void>(
        MaterialPageRoute<void>(
          fullscreenDialog: true,
          builder: (_) => const SetNewPasswordScreen(),
        ),
      )
          .whenComplete(() {
        _recoveryRouteOpen = false;
      });
    });
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      title: 'Adakaro',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const SplashScreen(),
    );
  }
}

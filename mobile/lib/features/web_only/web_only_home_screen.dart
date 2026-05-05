import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/theme/app_colors.dart';
import '../auth/login_screen.dart';

enum WebOnlyKind { admin, superAdmin }

class WebOnlyHomeScreen extends StatelessWidget {
  const WebOnlyHomeScreen({super.key, required this.kind});

  final WebOnlyKind kind;

  String get _title => switch (kind) {
        WebOnlyKind.admin => 'School admin',
        WebOnlyKind.superAdmin => 'Platform admin',
      };

  String get _body => switch (kind) {
        WebOnlyKind.admin =>
          'Full school administration (students, fees, settings) runs on the Adakaro website. Sign in there from your browser.',
        WebOnlyKind.superAdmin =>
          'Super admin tools are available on the Adakaro website only.',
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          TextButton(
            onPressed: () async {
              await Supabase.instance.client.auth.signOut();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
                  (r) => false,
                );
              }
            },
            child: const Text('Sign out'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.laptop_rounded,
              size: 48,
              color: AppColors.primary.withOpacity(0.9),
            ),
            const SizedBox(height: 20),
            Text(
              'Continue on the web',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 12),
            Text(
              _body,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

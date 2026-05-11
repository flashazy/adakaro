import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/config/env.dart';
import '../../core/network/supabase_ping.dart';

/// Manual checks for emulator DNS, VPN, missing INTERNET permission, etc.
class SupabaseNetworkDiagnosticsScreen extends StatefulWidget {
  const SupabaseNetworkDiagnosticsScreen({super.key});

  @override
  State<SupabaseNetworkDiagnosticsScreen> createState() =>
      _SupabaseNetworkDiagnosticsScreenState();
}

class _SupabaseNetworkDiagnosticsScreenState
    extends State<SupabaseNetworkDiagnosticsScreen> {
  String _connectivity = '…';
  String _dns = 'Tap “Run all checks”.';
  SupabasePingOutcome? _rest;
  SupabasePingOutcome? _auth;
  String _plainHttp = 'Not run yet.';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _refreshConnectivity();
  }

  Future<void> _refreshConnectivity() async {
    try {
      final r = await Connectivity().checkConnectivity();
      final parts = r.map((e) => e.name).join(', ');
      setState(() {
        _connectivity = r.contains(ConnectivityResult.none)
            ? 'none (offline radio?)'
            : parts;
      });
    } catch (e) {
      setState(() => _connectivity = 'Error: $e');
    }
  }

  Future<void> _runPlainGoogleHead() async {
    setState(() => _plainHttp = 'Running…');
    try {
      final req = http.Request('GET', Uri.parse('https://www.google.com'));
      final sw = Stopwatch()..start();
      final streamed = await http.Client().send(req).timeout(
            const Duration(seconds: 12),
          );
      final code = streamed.statusCode;
      await streamed.stream.drain();
      sw.stop();
      setState(() {
        _plainHttp =
            'GET https://www.google.com → HTTP $code in ${sw.elapsedMilliseconds}ms '
            '(proves general HTTPS/DNS on device)';
      });
    } catch (e) {
      setState(() => _plainHttp = 'GET https://www.google.com failed: $e');
    }
  }

  Future<void> _runAll() async {
    setState(() {
      _busy = true;
      _dns = 'Resolving…';
      _rest = null;
      _auth = null;
    });
    await _refreshConnectivity();
    final dns = await dnsLookupSupabaseHost();
    final rest = await pingSupabaseRestRoot();
    final auth = await pingSupabaseAuthSettings();
    if (!mounted) return;
    setState(() {
      _dns = dns;
      _rest = rest;
      _auth = auth;
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final url = Env.supabaseUrl.trim();
    final keyOk = Env.supabaseAnonKey.trim().isNotEmpty;
    final authUrl = expectedAuthTokenUrl;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Connection diagnostics'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Supabase URL in use',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 6),
          SelectableText(url, style: const TextStyle(fontSize: 13)),
          const SizedBox(height: 8),
          Text(
            'Anon key: ${keyOk ? 'loaded (length ${Env.supabaseAnonKey.trim().length})' : 'MISSING'}',
            style: TextStyle(
              color: keyOk ? null : Theme.of(context).colorScheme.error,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Sign-in (password) endpoint',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 6),
          SelectableText(
            '$authUrl\n(method POST, body JSON email + password — see console logs)',
            style: const TextStyle(fontSize: 12),
          ),
          const SizedBox(height: 20),
          Text(
            'Device connectivity (radio)',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 6),
          Text(_connectivity),
          const SizedBox(height: 8),
          Text(
            'Note: “connected” here does not guarantee DNS or that the emulator can reach the internet.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 20),
          Text('DNS', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          SelectableText(_dns, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 20),
          if (_rest != null) _outcomeCard(context, _rest!),
          if (_auth != null) _outcomeCard(context, _auth!),
          const SizedBox(height: 12),
          Text(
            'Plain HTTPS check',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 6),
          SelectableText(_plainHttp, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _busy ? null : _runAll,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.wifi_find),
            label: Text(_busy ? 'Running…' : 'Ping Supabase (REST + Auth)'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _busy ? null : _runPlainGoogleHead,
            icon: const Icon(Icons.public),
            label: const Text('Test generic HTTPS (google.com)'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _busy ? null : _refreshConnectivity,
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh connectivity only'),
          ),
          const SizedBox(height: 24),
          Text(
            'Flutter / Android tips',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 8),
          Text(
            '• Release builds need android.permission.INTERNET in the main manifest (fixed in this repo).\n'
            '• Emulator: cold boot, disable “airplane”, try 8.8.8.8 DNS, or test on a physical device.\n'
            '• VPN / corporate proxy can block *.supabase.co.\n'
            '• Detailed Supabase HTTP logs: filter console for log name `adakaro.auth` (status + redacted bodies in debug).',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4),
          ),
          if (kDebugMode) ...[
            const SizedBox(height: 16),
            Text(
              'Debug builds also print Supabase HTTP lines during sign-in.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }

  Widget _outcomeCard(BuildContext context, SupabasePingOutcome o) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: o.ok
          ? Theme.of(context).colorScheme.surfaceContainerHighest
          : Theme.of(context)
              .colorScheme
              .errorContainer
              .withOpacity(0.35),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  o.ok ? Icons.check_circle : Icons.error,
                  size: 20,
                  color: o.ok ? Colors.green : Theme.of(context).colorScheme.error,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    o.label,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SelectableText(
              o.detail,
              style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
            ),
          ],
        ),
      ),
    );
  }
}

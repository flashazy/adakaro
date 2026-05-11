import 'dart:async';
import 'dart:io' show InternetAddress;

Future<String> dnsLookupHost(String host) async {
  if (host.isEmpty) return '(empty host)';
  try {
    final addrs = await InternetAddress.lookup(host).timeout(
      const Duration(seconds: 10),
    );
    if (addrs.isEmpty) return '$host → no addresses';
    final ips = addrs.map((a) => a.address).join(', ');
    return '$host → $ips';
  } catch (e) {
    return '$host → FAILED: $e';
  }
}

import 'dns_lookup_stub.dart'
    if (dart.library.io) 'dns_lookup_io.dart' as impl;

Future<String> dnsLookupHost(String host) => impl.dnsLookupHost(host);

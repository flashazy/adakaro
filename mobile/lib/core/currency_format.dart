import 'package:intl/intl.dart';

/// Supported school fee currencies (matches web `lib/currency.ts`).
const List<String> schoolCurrencies = ['TZS', 'KES', 'UGX', 'USD'];

const String defaultSchoolCurrency = 'KES';

String normalizeSchoolCurrency(String? value) {
  final u = (value ?? '').toUpperCase().trim();
  if (schoolCurrencies.contains(u)) return u;
  return defaultSchoolCurrency;
}

String _localeForCode(String code) {
  switch (code) {
    case 'TZS':
      return 'sw_TZ';
    case 'KES':
      return 'en_KE';
    case 'UGX':
      return 'en_UG';
    case 'USD':
      return 'en_US';
    default:
      return 'en_KE';
  }
}

String formatCurrency(num amount, String? currencyCode) {
  final code = normalizeSchoolCurrency(currencyCode);
  final locale = _localeForCode(code);
  final fraction = code == 'USD' ? 2 : 0;
  return NumberFormat.currency(
    locale: locale,
    name: code,
    decimalDigits: fraction,
  ).format(amount);
}

import '../../core/currency_format.dart';

/// Privacy-aware labels for balances on the parent home dashboard.
abstract final class ParentPrivacyMoney {
  /// Visible amount counts (e.g. number of linked children): never masked here.
  static String maskedTotalsLine(String currencyCode) {
    final c = normalizeSchoolCurrency(currencyCode);
    return '$c ••••••';
  }

  /// Full formatted amount only when [revealed] is true.
  static String amountOrMasked(
    num amount,
    String? currencyCode,
    bool revealed,
  ) {
    if (revealed) return formatCurrency(amount, currencyCode);
    return maskedTotalsLine(currencyCode ?? defaultSchoolCurrency);
  }
}

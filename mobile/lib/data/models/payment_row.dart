class PaymentRow {
  PaymentRow({
    required this.id,
    required this.studentId,
    required this.amount,
    this.paymentMethod,
    required this.paymentDate,
    this.referenceNumber,
    this.feeStructureName,
    this.receiptId,
    this.receiptNumber,
  });

  final String id;
  final String studentId;
  final double amount;
  final String? paymentMethod;
  final String paymentDate;
  final String? referenceNumber;
  final String? feeStructureName;
  final String? receiptId;
  final String? receiptNumber;

  /// True when the school issued a receipt record (number and/or id from API).
  bool get hasReceiptForView {
    final id = receiptId?.trim() ?? '';
    final num = receiptNumber?.trim() ?? '';
    return id.isNotEmpty || num.isNotEmpty;
  }

  static PaymentRow fromJson(Map<String, dynamic> j) {
    double n(dynamic v) => (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
    final fs = j['fee_structure'];
    String? feeName;
    if (fs is Map<String, dynamic>) {
      feeName = fs['name'] as String?;
    } else if (fs is List && fs.isNotEmpty && fs.first is Map) {
      feeName = (fs.first as Map)['name'] as String?;
    }
    final rec = j['receipt'];
    String? rid;
    String? rnum;
    if (rec is Map<String, dynamic>) {
      rid = rec['id'] as String?;
      rnum = rec['receipt_number'] as String?;
    } else if (rec is List && rec.isNotEmpty && rec.first is Map) {
      final m = rec.first as Map;
      rid = m['id'] as String?;
      rnum = m['receipt_number'] as String?;
    }
    return PaymentRow(
      id: j['id'] as String,
      studentId: j['student_id'] as String,
      amount: n(j['amount']),
      paymentMethod: j['payment_method'] as String?,
      paymentDate: j['payment_date'] as String,
      referenceNumber: j['reference_number'] as String?,
      feeStructureName: feeName,
      receiptId: rid,
      receiptNumber: rnum,
    );
  }
}

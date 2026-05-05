class FeeBalanceRow {
  FeeBalanceRow({
    required this.studentId,
    required this.feeStructureId,
    required this.feeName,
    required this.totalFee,
    required this.totalPaid,
    required this.balance,
    this.dueDate,
  });

  final String studentId;
  final String feeStructureId;
  final String feeName;
  final double totalFee;
  final double totalPaid;
  final double balance;
  final String? dueDate;

  static FeeBalanceRow fromJson(Map<String, dynamic> j) {
    double n(dynamic v) => (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
    return FeeBalanceRow(
      studentId: j['student_id'] as String,
      feeStructureId: j['fee_structure_id'] as String,
      feeName: (j['fee_name'] as String?) ?? 'Fee',
      totalFee: n(j['total_fee']),
      totalPaid: n(j['total_paid']),
      balance: n(j['balance']),
      dueDate: j['due_date'] as String?,
    );
  }
}

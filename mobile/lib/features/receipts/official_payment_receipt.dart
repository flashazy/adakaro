import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/currency_format.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/payment_row.dart';
import '../../data/models/student_summary.dart';

/// On-device receipt body aligned with web parent receipt layout and typography.
class OfficialPaymentReceipt extends StatelessWidget {
  const OfficialPaymentReceipt({
    super.key,
    required this.payment,
    required this.student,
  });

  final PaymentRow payment;
  final StudentSummary? student;

  @override
  Widget build(BuildContext context) {
    final st = student;
    final currency = st?.currencyCode;
    final schoolName = (st?.schoolName?.trim().isNotEmpty ?? false)
        ? st!.schoolName!.trim()
        : 'School';
    final logoUrl = st?.schoolLogoUrl?.trim();
    final stampUrl = st?.schoolStampUrl?.trim();

    final issuedSource = (payment.receiptIssuedAt?.trim().isNotEmpty ?? false)
        ? payment.receiptIssuedAt!.trim()
        : payment.paymentDate;

    final dateIssuedFormatted = _formatReceiptLongDate(issuedSource);
    final paymentDateShort = _formatPaymentDateShort(payment.paymentDate);

    final methodDisplay = _paymentMethodLabel(payment.paymentMethod);

    final receiptNum = payment.receiptNumber?.trim();
    final badgeLabel = paymentStatusBadgeLabel(payment.status);

    final titleStyle = Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: _slate900,
              letterSpacing: -0.3,
              height: 1.2,
            ) ??
        TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: _slate900);

    final subtitleReceiptStyle =
        Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: _slate500,
                  letterSpacing: 2.4,
                ) ??
            const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: _slate500,
              letterSpacing: 2.4,
            );

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [
            BoxShadow(
              color: const Color(0x0D000000),
              blurRadius: 25,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            const Positioned.fill(
              child: IgnorePointer(
                child: _PaidWatermark(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 32, 20, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Column(
                    children: [
                      _SchoolLogoCircle(
                        logoUrl: logoUrl,
                        schoolName: schoolName,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        schoolName.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: titleStyle,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'OFFICIAL PAYMENT RECEIPT',
                        textAlign: TextAlign.center,
                        style: subtitleReceiptStyle,
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const _HorizontalDashedLine(color: Color(0xFFD1D5DB)),
                  const SizedBox(height: 20),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Receipt Number',
                              style: _fieldCaption(context),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              (receiptNum != null && receiptNum.isNotEmpty)
                                  ? receiptNum
                                  : '—',
                              style: _receiptNumberStyle(context),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'Date Issued',
                              textAlign: TextAlign.right,
                              style: _fieldCaption(context),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              dateIssuedFormatted,
                              textAlign: TextAlign.right,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: _slate800,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const _HorizontalDashedLine(color: Color(0xFFD1D5DB)),
                  const SizedBox(height: 24),
                  Column(
                    children: [
                      Text(
                        'TOTAL AMOUNT PAID',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.6,
                              color: _slate600,
                            ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        formatCurrency(payment.amount, currency),
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: _slate900,
                              letterSpacing: -0.6,
                            ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.successBg,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: AppColors.successBorder
                                    .withValues(alpha: 0.9),
                              ),
                            ),
                            child: Text(
                              badgeLabel,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.success,
                                    letterSpacing: 0.4,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const _HorizontalDashedLine(color: Color(0xFFD1D5DB)),
                  const SizedBox(height: 4),
                  _ReceiptFieldRow(
                    label: 'Student name',
                    value: st?.fullName ?? '—',
                  ),
                  if (st != null &&
                      (st.admissionNumber?.trim().isNotEmpty ?? false))
                    _ReceiptFieldRow(
                      label: 'Admission number',
                      value: st.admissionNumber!.trim(),
                    ),
                  if (st != null && (st.className?.trim().isNotEmpty ?? false))
                    _ReceiptFieldRow(
                      label: 'Class/Grade',
                      value: st.className!.trim(),
                    ),
                  _ReceiptFieldRow(
                    label: 'Fee description',
                    value: payment.feeStructureName?.trim().isNotEmpty ?? false
                        ? payment.feeStructureName!.trim()
                        : '—',
                  ),
                  _ReceiptFieldRow(
                    label: 'Payment method',
                    value: methodDisplay,
                  ),
                  _ReceiptFieldRow(
                      label: 'Payment date', value: paymentDateShort),
                  if (payment.referenceNumber?.trim().isNotEmpty ?? false)
                    _ReceiptFieldRow(
                      label: 'Reference',
                      value: payment.referenceNumber!.trim(),
                    ),
                  if (payment.notes?.trim().isNotEmpty ?? false)
                    _ReceiptFieldRow(
                      label: 'Notes',
                      value: payment.notes!.trim(),
                    ),
                  const SizedBox(height: 20),
                  const _HorizontalDashedLine(color: Color(0xFFD1D5DB)),
                  const SizedBox(height: 22),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'This is a computer-generated receipt. '
                        'No signature is required.',
                        textAlign: TextAlign.center,
                        style: _footerItalic(context),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Generated via Adakaro Mobile App.',
                        textAlign: TextAlign.center,
                        style: _footerItalic(context),
                      ),
                      if (stampUrl != null && stampUrl.isNotEmpty)
                        _StampImage(uri: stampUrl),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  TextStyle _fieldCaption(BuildContext context) {
    return Theme.of(context).textTheme.bodySmall?.copyWith(
              color: _slate500,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ) ??
        const TextStyle(
            fontSize: 12, fontWeight: FontWeight.w600, color: _slate500);
  }

  TextStyle _footerItalic(BuildContext context) {
    return TextStyle(
      fontSize: 10,
      height: 1.45,
      fontStyle: FontStyle.italic,
      color: _slate400,
    );
  }

  TextStyle _receiptNumberStyle(BuildContext context) {
    return Theme.of(context).textTheme.bodyLarge?.copyWith(
              fontFamily: 'monospace',
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
              fontSize: 15,
              letterSpacing: -0.2,
            ) ??
        TextStyle(
          fontFamily: 'monospace',
          fontWeight: FontWeight.w800,
          fontSize: 15,
          color: AppColors.primary,
        );
  }
}

String _paymentMethodLabel(String? raw) {
  if (raw == null || raw.isEmpty) return 'Not specified';
  return raw.replaceAll('_', ' ');
}

String paymentStatusBadgeLabel(String? raw) {
  if (raw == null || raw.trim().isEmpty) return 'PAID';
  final trimmed = raw.trim();
  final s = trimmed.toLowerCase();
  if (s.contains('fully') && s.contains('paid')) return 'FULLY PAID';
  if (s == 'completed' || s == 'paid' || s == 'success' || s == 'succeeded') {
    return 'PAID';
  }
  return trimmed.replaceAll('_', ' ');
}

String _formatReceiptLongDate(String iso) {
  try {
    final d = DateTime.parse(iso).toLocal();
    return DateFormat.yMMMMd('en_US').format(d);
  } catch (_) {
    final v = iso.split('T').first;
    try {
      return DateFormat.yMMMMd('en_US').format(DateTime.parse(v));
    } catch (_) {
      return iso;
    }
  }
}

String _formatPaymentDateShort(String iso) {
  try {
    final d = DateTime.parse(iso).toLocal();
    return DateFormat.yMMMd('en_US').format(d);
  } catch (_) {
    return iso.split('T').first;
  }
}

const Color _slate900 = Color(0xFF111827);
const Color _slate800 = Color(0xFF1F2937);
const Color _slate600 = Color(0xFF4B5563);
const Color _slate500 = Color(0xFF6B7280);
const Color _slate400 = Color(0xFF9CA3AF);

class _PaidWatermark extends StatelessWidget {
  const _PaidWatermark();

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: -0.43633,
      child: Align(
        alignment: Alignment.center,
        child: FittedBox(
          fit: BoxFit.contain,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              'PAID',
              maxLines: 1,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 112,
                height: 0.9,
                letterSpacing: 4,
                color: const Color(0xFFE5E7EB).withValues(alpha: 0.4),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SchoolLogoCircle extends StatelessWidget {
  const _SchoolLogoCircle({
    required this.logoUrl,
    required this.schoolName,
  });

  final String? logoUrl;
  final String schoolName;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 60,
        height: 60,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFFF9FAFB),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D000000),
              blurRadius: 6,
              offset: Offset(0, 1),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: (logoUrl != null && logoUrl!.isNotEmpty)
            ? _NetworkBrandImage(
                uri: logoUrl!,
                fit: BoxFit.cover,
              )
            : _LogoLetterPlaceholder(schoolName: schoolName),
      ),
    );
  }
}

class _LogoLetterPlaceholder extends StatelessWidget {
  const _LogoLetterPlaceholder({required this.schoolName});

  final String schoolName;

  @override
  Widget build(BuildContext context) {
    final trimmed = schoolName.trim();
    final ch = trimmed.isEmpty ? '' : trimmed[0];
    final letter = RegExp(r'\S').hasMatch(ch) ? ch.toUpperCase() : '';
    if (letter.isEmpty) {
      return Icon(
        Icons.business_rounded,
        size: 32,
        color: _slate400,
      );
    }
    return Center(
      child: Text(
        letter,
        style: TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 22,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

/// Simple dashed rule matching web receipt separators.
class _HorizontalDashedLine extends StatelessWidget {
  const _HorizontalDashedLine({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 1,
      width: double.infinity,
      child: CustomPaint(
        painter: _DashedHorizontalPainter(color: color),
      ),
    );
  }
}

class _DashedHorizontalPainter extends CustomPainter {
  _DashedHorizontalPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const dashLen = 5.0;
    const gap = 4.0;
    var x = 0.0;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1
      ..strokeCap = StrokeCap.round;

    final y = size.height / 2;
    while (x < size.width) {
      final end = math.min(x + dashLen, size.width);
      canvas.drawLine(Offset(x, y), Offset(end, y), paint);
      x += dashLen + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _DashedHorizontalPainter oldDelegate) =>
      oldDelegate.color != color;
}

class _ReceiptFieldRow extends StatelessWidget {
  const _ReceiptFieldRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Color(0xFFF3F4F6)),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: _slate500,
                      fontWeight: FontWeight.w500,
                      fontSize: 12,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                value,
                textAlign: TextAlign.right,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                      color: _slate800,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StampImage extends StatefulWidget {
  const _StampImage({required this.uri});

  final String uri;

  @override
  State<_StampImage> createState() => _StampImageState();
}

class _StampImageState extends State<_StampImage> {
  bool _loadFailed = false;

  void _fail() {
    if (!mounted || _loadFailed) return;
    setState(() => _loadFailed = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_loadFailed) return const SizedBox.shrink();

    final u = Uri.tryParse(widget.uri);
    if (u == null || !u.hasScheme) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fail());
      return const SizedBox.shrink();
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        var w = constraints.maxWidth;
        if (!w.isFinite || w <= 0) {
          w = MediaQuery.sizeOf(context).width;
        }
        final dim = (w * 0.22).clamp(76.0, 92.0);

        return Padding(
          padding: const EdgeInsets.only(top: 30),
          child: Align(
            alignment: Alignment.centerRight,
            child: SizedBox(
              width: dim,
              height: dim,
              child: Image.network(
                widget.uri,
                fit: BoxFit.contain,
                alignment: Alignment.bottomRight,
                errorBuilder: (_, __, ___) {
                  WidgetsBinding.instance.addPostFrameCallback((_) => _fail());
                  return const SizedBox.shrink();
                },
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary.withValues(alpha: 0.55),
                        value: loadingProgress.expectedTotalBytes != null
                            ? loadingProgress.cumulativeBytesLoaded /
                                loadingProgress.expectedTotalBytes!
                            : null,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

class _NetworkBrandImage extends StatelessWidget {
  const _NetworkBrandImage({
    required this.uri,
    required this.fit,
  });

  final String uri;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final u = Uri.tryParse(uri);
    if (u == null || !u.hasScheme) {
      return const SizedBox.expand();
    }
    return Image.network(
      uri,
      fit: fit,
      errorBuilder: (_, __, ___) => Icon(
        Icons.image_not_supported_outlined,
        size: fit == BoxFit.cover ? 28 : 22,
        color: _slate400,
      ),
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.primary.withValues(alpha: 0.6),
              value: loadingProgress.expectedTotalBytes != null
                  ? loadingProgress.cumulativeBytesLoaded /
                      loadingProgress.expectedTotalBytes!
                  : null,
            ),
          ),
        );
      },
    );
  }
}

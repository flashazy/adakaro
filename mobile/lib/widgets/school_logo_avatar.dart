import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

String? _normalizeSchoolLogoHttpsUrl(String? raw) {
  final u = raw?.trim();
  if (u == null || u.isEmpty) return null;
  final lower = u.toLowerCase();
  if (!(lower.startsWith('http://') || lower.startsWith('https://'))) {
    return null;
  }
  return u;
}

String _schoolMarkLetters(String? name) {
  final t = name?.trim();
  if (t == null || t.isEmpty) return '';
  final parts = t.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '';
  if (parts.length == 1) {
    final p0 = parts.single;
    if (p0.length >= 2) return p0.substring(0, 2).toUpperCase();
    return p0.toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/// Inner padding heuristic after decode — opens the drawable region for chunky canvases & banners.
double _paddingRatioForDecoded(double w, double h) {
  final minD = math.min(w, h);
  final maxD = math.max(w, h);
  if (minD <= 0 || maxD <= 0) return 0.118;
  final ar = maxD / minD;

  if (ar <= 1.22 && maxD >= 440) return 0.062;
  if (ar <= 1.3 && maxD >= 320) return 0.071;
  if (ar <= 1.42) return 0.086;

  if (ar >= 4.2) return 0.058;
  if (ar >= 3.2) return 0.069;
  if (ar >= 2.55) return 0.079;

  return 0.108;
}

/// Circular school emblem: tolerates uneven uploads via adaptive padding post-decode.
class SchoolLogoAvatar extends StatefulWidget {
  const SchoolLogoAvatar({
    super.key,
    required this.logoUrl,
    required this.schoolName,
    this.size = 50,
    this.fallbackIcon,
    this.softChrome = false,
  });

  final String? logoUrl;
  final String? schoolName;
  final double size;
  /// When initials cannot be derived, shown instead of the default emblem icon.
  final IconData? fallbackIcon;
  /// Lighter ring/shadow for dark or tinted backgrounds (e.g. teacher hero).
  final bool softChrome;

  @override
  State<SchoolLogoAvatar> createState() => _SchoolLogoAvatarState();
}

class _SchoolLogoAvatarState extends State<SchoolLogoAvatar> {
  double? _decodeW;
  double? _decodeH;
  bool _streamFailed = false;
  String? _trackedUrlKey;

  ImageStream? _imageStream;
  late final ImageStreamListener _listener;

  @override
  void initState() {
    super.initState();
    _listener = ImageStreamListener(_onImageDecoded, onError: _onStreamError);
  }

  @override
  void dispose() {
    _detachDecodeListener();
    super.dispose();
  }

  void _detachDecodeListener() {
    final s = _imageStream;
    if (s != null) {
      s.removeListener(_listener);
      _imageStream = null;
    }
    _trackedUrlKey = null;
  }

  void _onImageDecoded(ImageInfo info, bool _) {
    if (!mounted) return;
    final img = info.image;
    setState(() {
      _streamFailed = false;
      _decodeW = img.width.toDouble();
      _decodeH = img.height.toDouble();
    });
  }

  void _onStreamError(Object _, StackTrace? __) {
    if (!mounted) return;
    setState(() {
      _streamFailed = true;
      _decodeW = null;
      _decodeH = null;
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _primeDecodeProbe();
  }

  @override
  void didUpdateWidget(SchoolLogoAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldNorm = _normalizeSchoolLogoHttpsUrl(oldWidget.logoUrl);
    final newNorm = _normalizeSchoolLogoHttpsUrl(widget.logoUrl);
    if (oldNorm != newNorm ||
        oldWidget.size != widget.size ||
        oldWidget.schoolName != widget.schoolName ||
        oldWidget.fallbackIcon != widget.fallbackIcon ||
        oldWidget.softChrome != widget.softChrome) {
      setState(() {
        _decodeW = null;
        _decodeH = null;
        _streamFailed = false;
      });
      _primeDecodeProbe(force: true);
    }
  }

  void _primeDecodeProbe({bool force = false}) {
    final u = _normalizeSchoolLogoHttpsUrl(widget.logoUrl);
    if (u == null) {
      _detachDecodeListener();
      return;
    }
    if (!force && u == _trackedUrlKey && _imageStream != null) {
      return;
    }

    _detachDecodeListener();
    _trackedUrlKey = u;

    final provider = NetworkImage(u);
    final stream = provider.resolve(
      createLocalImageConfiguration(
        context,
        size: Size.square(widget.size),
      ),
    );
    stream.addListener(_listener);
    _imageStream = stream;
  }

  double _innerPaddingPx(double diameter, double? decodedW, double? decodedH) {
    final w = decodedW;
    final h = decodedH;
    if (w == null || h == null || w <= 0 || h <= 0) {
      return (diameter * 0.117).clamp(4.75, diameter * 0.21);
    }
    final ratio = _paddingRatioForDecoded(w, h);
    return (diameter * ratio).clamp(4.25, diameter * 0.2);
  }

  Widget _fallback() {
    final theme = Theme.of(context);
    final letters = _schoolMarkLetters(widget.schoolName);

    final iconSize = math.min(26.0, widget.size * 0.44).clamp(16.0, 30.0);
    final content = letters.isNotEmpty
        ? FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              letters,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.fade,
              textAlign: TextAlign.center,
              style: theme.textTheme.labelLarge?.copyWith(
                color: const Color(0xFF475569),
                fontWeight: FontWeight.w800,
                letterSpacing: 0.08,
              ),
            ),
          )
        : Icon(
            widget.fallbackIcon ?? Icons.workspace_premium_rounded,
            size: iconSize,
            color: AppColors.primary.withValues(alpha: 0.86),
          );

    return Center(child: content);
  }

  @override
  Widget build(BuildContext context) {
    final normalized = _normalizeSchoolLogoHttpsUrl(widget.logoUrl);
    final diameter = widget.size.clamp(32.0, 160.0);
    final showGraphic = normalized != null && !_streamFailed;
    final innerPad = showGraphic
        ? _innerPaddingPx(diameter, _decodeW, _decodeH)
        : (diameter * 0.094).clamp(5.75, diameter * 0.18);

    Widget innerChild;
    if (!showGraphic) {
      innerChild = _fallback();
    } else {
      final provider = NetworkImage(normalized);
      innerChild = LayoutBuilder(
        builder: (context, constraints) {
          final cw = constraints.maxWidth;
          final ch = constraints.maxHeight;
          if (cw <= 0 || ch <= 0) return const SizedBox.shrink();

          return Image(
            image: provider,
            fit: BoxFit.contain,
            alignment: Alignment.center,
            filterQuality: FilterQuality.medium,
            gaplessPlayback: true,
            width: cw,
            height: ch,
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) {
                return child;
              }
              final total = loadingProgress.expectedTotalBytes;
              final loaded = loadingProgress.cumulativeBytesLoaded;
              double? progress;
              if (total != null && total > 0) {
                progress = loaded / total;
              }
              return Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    value: progress,
                    color: AppColors.primary.withValues(alpha: 0.55),
                    backgroundColor:
                        const Color(0xFFE2E8F0).withValues(alpha: 0.92),
                  ),
                ),
              );
            },
            errorBuilder: (context, error, stackTrace) {
              return _fallback();
            },
          );
        },
      );
    }

    final soft = widget.softChrome;
    return SizedBox(
      width: diameter,
      height: diameter,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: soft ? 0.22 : 0.40),
            width: soft ? 1 : 1.5,
          ),
          boxShadow: soft
              ? [
                  BoxShadow(
                    color: Colors.white.withValues(alpha: 0.12),
                    blurRadius: 10,
                    spreadRadius: -2,
                    offset: const Offset(0, 1),
                  ),
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.085),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        child: ClipOval(
          clipBehavior: Clip.antiAlias,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: soft ? 0.90 : 0.955),
              border: Border.all(
                color: Colors.white.withValues(alpha: soft ? 0.32 : 0.52),
              ),
            ),
            child: Padding(
              padding: EdgeInsets.all(innerPad),
              child: SizedBox.expand(
                child: innerChild,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

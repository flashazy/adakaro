import 'package:flutter/material.dart';

enum ParentAttentionKind { dot, count, pulse }

class ParentAttentionIndicator extends StatefulWidget {
  const ParentAttentionIndicator({
    super.key,
    required this.kind,
    required this.color,
    this.count,
    this.size = 9.0,
    this.visible = true,
  });

  final ParentAttentionKind kind;
  final Color color;
  final int? count;

  /// Dot diameter (kept small: 8–10px).
  final double size;

  final bool visible;

  @override
  State<ParentAttentionIndicator> createState() =>
      _ParentAttentionIndicatorState();
}

class _ParentAttentionIndicatorState extends State<ParentAttentionIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    if (widget.kind == ParentAttentionKind.pulse && widget.visible) {
      _pulse.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant ParentAttentionIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    final shouldPulse =
        widget.visible && widget.kind == ParentAttentionKind.pulse;
    if (shouldPulse) {
      if (!_pulse.isAnimating) _pulse.repeat();
    } else {
      if (_pulse.isAnimating) _pulse.stop();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color;
    final visible = widget.visible;
    final size = widget.size.clamp(8.0, 10.0);

    Widget core;
    switch (widget.kind) {
      case ParentAttentionKind.count:
        final c = (widget.count ?? 0).clamp(0, 999);
        final label = c > 99 ? '99+' : '$c';
        core = Container(
          constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
          padding: const EdgeInsets.symmetric(horizontal: 5),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.22),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.clip,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.98),
                  fontWeight: FontWeight.w800,
                  fontSize: 10.25,
                  height: 1.0,
                  letterSpacing: -0.1,
                ),
          ),
        );
        break;
      case ParentAttentionKind.pulse:
      case ParentAttentionKind.dot:
        core = Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withValues(alpha: 0.90),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.20),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
        );
        break;
    }

    if (widget.kind == ParentAttentionKind.pulse) {
      core = AnimatedBuilder(
        animation: _pulse,
        builder: (context, child) {
          final t = Curves.easeOutCubic.transform(_pulse.value);
          final ringOpacity = (0.18 * (1.0 - t)).clamp(0.0, 0.18);
          final ringScale = 1.0 + 1.05 * t;
          return Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Transform.scale(
                scale: ringScale,
                child: Opacity(
                  opacity: ringOpacity,
                  child: Container(
                    width: size,
                    height: size,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color,
                    ),
                  ),
                ),
              ),
              if (child != null) child,
            ],
          );
        },
        child: core,
      );
    }

    // Smooth, calm appearance. (No layout shift, no card height changes.)
    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: const Duration(milliseconds: 170),
      curve: Curves.easeOutCubic,
      child: AnimatedScale(
        scale: visible ? 1 : 0.88,
        duration: const Duration(milliseconds: 190),
        curve: Curves.easeOutCubic,
        child: core,
      ),
    );
  }
}


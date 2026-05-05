import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

bool _isHttpUrl(String? url) {
  if (url == null) return false;
  final u = url.trim();
  return u.startsWith('https://') || u.startsWith('http://');
}

/// Circle avatar from [imageUrl] when it is a usable HTTP(S) URL; otherwise initials.
class StudentAvatar extends StatelessWidget {
  const StudentAvatar({
    super.key,
    required this.imageUrl,
    required this.fallbackName,
    this.radius = 28,
  });

  final String? imageUrl;
  final String fallbackName;
  final double radius;

  String get _letter {
    final t = fallbackName.trim();
    if (t.isEmpty) return '?';
    return t[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final url = imageUrl?.trim();
    if (_isHttpUrl(url)) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: AppColors.primary.withValues(alpha: 0.12),
        child: ClipOval(
          child: Image.network(
            url!,
            width: radius * 2,
            height: radius * 2,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _FallbackLetter(
              letter: _letter,
              radius: radius,
            ),
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return SizedBox(
                width: radius * 2,
                height: radius * 2,
                child: Center(
                  child: SizedBox(
                    width: radius * 0.9,
                    height: radius * 0.9,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      value: loadingProgress.expectedTotalBytes != null
                          ? loadingProgress.cumulativeBytesLoaded /
                              loadingProgress.expectedTotalBytes!
                          : null,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      );
    }
    return _FallbackLetter(letter: _letter, radius: radius);
  }
}

class _FallbackLetter extends StatelessWidget {
  const _FallbackLetter({
    required this.letter,
    required this.radius,
  });

  final String letter;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
      foregroundColor: AppColors.primary,
      child: Text(
        letter,
        style: TextStyle(
          fontSize: radius * 0.85,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
